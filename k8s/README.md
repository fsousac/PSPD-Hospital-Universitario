# Kubernetes

Manifests Kubernetes do projeto HU Observability, para o cluster K8S (kubeadm,
4 nós) compartilhado da disciplina PSPD — **provisionado e mantido pelo
professor**, não pelo grupo (ver `orientacoes_sobre_clusterK8S.pdf`). O grupo
10 recebe um namespace próprio (`grupo-10`), um Postgres externo já criado
(`pseudopep_g10`) e um realm Keycloak externo já criado (`grupo10`) — nada
disso é instalado por este repositório. Ver
`../docs/decisions/0005-k8s-observability-design.md` para o histórico
completo de decisões.

## O que tem aqui

| Arquivo | O quê |
|---|---|
| `kustomization.yaml` | Entry point do `kubectl apply -k` — namespace `grupo-10`, labels comuns, lista de resources |
| `configmap.yaml` | `hu-config` — variáveis de ambiente compartilhadas pelos 3 microsserviços de backend |
| `secrets.env.example` | Template do `hu-db-credentials` (senha do Postgres do grupo) — **não** aplicado via kustomize, ver abaixo |
| `api-gateway.yaml`, `authorization-service.yaml`, `patient-data-service.yaml`, `data-transform-service.yaml` | Deployment + Service de cada microsserviço de backend |
| `ingress.yaml` | Ingress do api-gateway (`/grupo10/api/*`, `/healthz`, `/readyz`, `/metrics`) |
| `frontend-*.yaml` | Deployment/Service/ConfigMap/Ingress/HPA do frontend (React+Vite+Nginx) |
| `hpa.yaml` | 4 `HorizontalPodAutoscaler` (um por serviço de backend) — fora da lista de `resources`, aplicado manualmente só na fase (d) |
| `servicemonitors.yaml` | `ServiceMonitor` por serviço, para o Prometheus Operator do cluster descobrir os `/metrics` |
| `kubeconfig-grupo-10.kubeconfig` | Kubeconfig do grupo (fornecido pelo professor) |

## Pré-requisitos

- `kubectl` instalado (não precisa de root — dá para baixar o binário estático
  de `dl.k8s.io` para `~/bin` se não houver acesso via `apt`/`snap`).
- `export KUBECONFIG=$(pwd)/k8s/kubeconfig-grupo-10.kubeconfig` (evita repetir
  `--kubeconfig` em todo comando).
- Imagens já publicadas em `ghcr.io/fsousac/hu-*:latest` (build local + push
  manual até haver CI — ver ADR 0005) para os 4 microsserviços de backend e o
  frontend.

## Aplicando os manifests

```bash
# 1. Secret do Postgres — não versionado, criado à parte (nunca via kustomize)
cp secrets.env.example secrets.env   # preencher com a senha real do grupo10
kubectl create secret generic hu-db-credentials -n grupo-10 --from-env-file=secrets.env

# 2. Backend + frontend (tudo exceto HPA)
kubectl apply -k .

# 3. HPA — só na fase (d) da metodologia, ver ADR 0005 decisão 4
kubectl apply -f hpa.yaml
```

Depois de qualquer edição num `*.yaml`, reaplicar (`kubectl apply -k .`) antes
de assumir que o cluster reflete o repo — `kubectl diff -k .` mostra o que
está fora de sincronia sem aplicar nada.

**Serviços headless (`clusterIP: None`)**: `patient-data-service`,
`authorization-service` e `data-transform-service` usam Service headless, não
`ClusterIP` comum — necessário para que o cliente gRPC (api-gateway,
data-transform-service) consiga fazer `round_robin` entre réplicas via DNS
(ver "gRPC pinado numa única réplica" no ADR 0005). `clusterIP` é campo
imutável: se um desses Services já existir como `ClusterIP` no cluster,
`kubectl apply` sozinho falha — é preciso `kubectl delete service <nome>`
antes do `apply -k`.

## Build e publicação das imagens

Na raiz do repositório, para cada serviço:

```bash
docker build -t ghcr.io/fsousac/hu-<serviço>:latest -f services/<serviço>/Dockerfile .
docker push ghcr.io/fsousac/hu-<serviço>:latest
```

Para o frontend, os `VITE_*` são embutidos no bundle em build time (não em
runtime) — os build-args precisam bater com `frontend-configmap.yaml`:

```bash
docker build -t ghcr.io/fsousac/hu-frontend:latest \
  --build-arg VITE_API_BASE_URL= \
  --build-arg VITE_AUTH_MODE=password \
  --build-arg VITE_ENABLE_MOCKS=false \
  --build-arg VITE_KEYCLOAK_URL=https://kiriland.unb.br/keycloak \
  --build-arg VITE_KEYCLOAK_REALM=grupo10 \
  --build-arg VITE_KEYCLOAK_CLIENT_ID=hu-frontend \
  --build-arg VITE_PASSWORD_GRANT_CLIENT_ID=admin-cli \
  --build-arg VITE_BASE_PATH=/grupo10/ \
  -f frontend/Dockerfile .
docker push ghcr.io/fsousac/hu-frontend:latest
```

`VITE_AUTH_MODE=password` é um workaround: o client OIDC `hu-frontend`
(Authorization Code + PKCE) não existe no realm real `grupo10` ("Client not
found" no Keycloak — bloqueio externo). Enquanto isso, o login usa
`grant_type=password` contra o client público `admin-cli` — ver
`../frontend/README.md` e `../docs/decisions/0005-k8s-observability-design.md`.
Voltar para `VITE_AUTH_MODE=keycloak` assim que o client existir.

Como todos os Deployments usam `imagePullPolicy: Always`, um novo push só é
aplicado a um pod já rodando com `kubectl rollout restart deployment/<nome> -n
grupo-10` — um `kubectl apply -k .` que não mude o próprio manifesto do
Deployment reporta "unchanged" e **não** reinicia o pod.

## Validação

```bash
kubectl -n grupo-10 get pods
kubectl -n grupo-10 get svc
kubectl -n grupo-10 get ingress
kubectl -n grupo-10 get hpa
kubectl -n grupo-10 rollout status deployment/api-gateway
```

Healthcheck de cada serviço: `/healthz` (api-gateway), `/q/health/live`
(authorization-service), `/health` (patient-data-service,
data-transform-service, frontend).

## Acesso

Único host, `kiriland.unb.br`, com duas Ingress dividindo o path `/grupo10`
por prioridade (nginx-ingress): o gateway reivindica só
`/grupo10/(api/.*|healthz|readyz|metrics)` (prioridade 10) e o frontend é o
catch-all do resto (prioridade 20) — ver `ingress.yaml`/`frontend-ingress.yaml`.

```text
https://kiriland.unb.br/grupo10           → frontend
https://kiriland.unb.br/grupo10/api/v1/…  → api-gateway
```

## Autoscaling (HPA)

`hpa.yaml` define 4 `HorizontalPodAutoscaler` (`autoscaling/v2`), um por
serviço de backend, todos `minReplicas: 1` / `maxReplicas: 10` / CPU alvo 70%
de utilização média. Aplicado só na fase (d) da metodologia — se aplicado
antes, ele reverteria o `kubectl scale --replicas=N` manual usado na fase (c)
de escalabilidade horizontal, tornando as duas fases impossíveis de isolar.
Escala para baixo tem uma janela de estabilização (~5 min) para evitar
oscilação entre execuções sequenciais de teste de carga.

## Observabilidade

Prometheus e Grafana já estão instalados a nível de cluster pelo professor —
ver `../observability/README.md` para como o discovery (`ServiceMonitor`) e
os dashboards funcionam.
