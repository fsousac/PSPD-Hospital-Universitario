# ADR 0005 — Kubernetes e observabilidade: decisões técnicas

**Autor:** Felipe de Sousa (Grupo 10)

---

## Contexto

O enunciado (`PSPD2026.1_PPesq.pdf`) exige implantar a aplicação num cluster
K8S em modo cluster, com autoscaling e observabilidade via Prometheus +
Grafana, e executar 5 fases de teste: validação funcional, testes de carga
(10/50/100/500/1000 usuários simultâneos), escalabilidade horizontal,
autoscaling (HPA) e observabilidade (≥5 métricas em dashboards).

O professor providenciou um cluster kubeadm de 4 nós compartilhado por 10
grupos (`orientacoes_sobre_clusterK8S.pdf`): cada grupo recebe um namespace
próprio (`grupo-10` para este grupo, via `kubeconfig-grupo-10.yaml`, RBAC
restrito ao namespace), um Postgres externo já provisionado
(`pseudopep_g10`), um realm Keycloak externo já provisionado (`grupo10`, com
usuários de teste reais) e Prometheus/Grafana já instalados a nível de
cluster — o grupo não instala essas ferramentas, só integra com elas.

A lógica de negócio dos 4 serviços (API Gateway, Authorization Service,
Patient Data Service, Data Transform Service) já estava pronta antes desta
entrega, cada um já expondo métricas Prometheus customizadas e endpoints de
health. O trabalho desta entrega cobriu duas frentes: (1) a infraestrutura
K8S/observabilidade em si, e (2) duas adaptações de código necessárias para a
aplicação (desenhada e testada contra um Keycloak local de dev) funcionar
corretamente contra o Keycloak real do cluster compartilhado.

## Decisões

### 1. Kustomize plano, sem overlays

Existe um único ambiente de deploy real (namespace `grupo-10`); overlays
(base/dev/prod) seriam abstração sem uso. Um `k8s/kustomization.yaml` plano
com `namespace:` e `commonLabels` já elimina a duplicação que importa (não
repetir namespace/labels em cada manifest).

### 2. ConfigMap único e Secret único, não um por serviço

`hu-config` concentra as variáveis que realmente mudam entre ambiente local
(docker-compose) e cluster (endereços internos, issuer OIDC do realm
`grupo10`, rate limit). Variáveis que nunca mudam (`GRPC_PORT`, `HEALTH_PORT`,
endereço interno fixo do PDS a partir do DTS) ficam como literais direto no
`env:` do Deployment, evitando um ConfigMap por serviço para 1-2 chaves.

`hu-db-credentials` é o único Secret — a única credencial real a proteger é a
senha do Postgres do grupo (`k8s/secrets.env`, gitignored, aplicado via
`kubectl create secret --from-env-file`; template versionado em
`k8s/secrets.env.example`). Não há client secret do Keycloak a proteger — o
client OIDC observado em dev é público (`directAccessGrantsEnabled=true`,
sem secret).

### 3. Annotations Prometheus em vez de ServiceMonitor

`prometheus.io/scrape|port|path` no `template.metadata` de cada Deployment,
em vez de criar recursos `ServiceMonitor` do Prometheus Operator. Motivo: o
RBAC do grupo é restrito ao namespace (kubeconfig fornecido), sem garantia de
permissão para CRDs de monitoramento nem de que o Prometheus Operator esteja
em uso (pode ser um Prometheus "vanilla" com `kubernetes_sd_configs`). Essa
convenção funciona com qualquer um dos dois modos mais comuns de
service-discovery (`role: pod`); se não funcionar, `ServiceMonitor` é o
próximo passo a investigar (ver Riscos).

### 4. HPA aplicado só na fase de autoscaling, não desde o início

Os 4 `HorizontalPodAutoscaler` (min 1, max 10, CPU 70%) ficam em
`k8s/hpa.yaml`, fora da lista `resources` do `kustomization.yaml`. Se
aplicado desde a fase de validação funcional, o HPA reverteria o
`kubectl scale --replicas=3` manual da fase de escalabilidade horizontal —
as duas fases ficariam impossíveis de isolar. Aplicado manualmente só na
fase (d): `kubectl apply -f k8s/hpa.yaml`.

### 5. Ingress single-entrypoint, só para o api-gateway

Só o `api-gateway` é exposto externamente (`k8s/ingress.yaml`,
`https://kiriland.unb.br/grupo10`) — é o único ponto de entrada da
aplicação (BFF, ver ADR 0004). O frontend ainda não tem stack definida e
está fora do escopo desta entrega; os testes de carga batem direto no
gateway.

### 6. k6 como ferramenta de carga, um script parametrizável

k6 já vem instalado na VM da disciplina (menos setup que Locust). Os 5
cenários de usuários simultâneos (10/50/100/500/1000) são cobertos por
`--vus`/`--duration` num único `loadtests/k6-scenario.js`, não 5 scripts
duplicados.

### 7. Adaptação do uso do Keycloak (achado durante a revalidação contra os documentos do professor)

Comparando o código com `orientacoes_sobre_clusterK8S.pdf`, duas
incompatibilidades reais foram encontradas entre o que a aplicação esperava
do Keycloak de dev local (realm `hu`, provisionado por
`scripts/setup-keycloak.sh`) e o que o Keycloak do cluster (realm `grupo10`)
realmente provê — sem corrigir, todo usuário real receberia `DENY`:

- **Case dos nomes de role**: o realm `hu` local usa roles minúsculas
  (`medico`/`estagiario`/`pesquisador`); o documento do professor especifica
  o realm `grupo10` com roles em maiúsculas (`MEDICO`/`ESTAGIARIO`/
  `PESQUISADOR`, citação literal: "role = MEDICO"). A comparação no código
  era case-sensitive em dois pontos —
  `TokenValidationService.extractRealmRoles` (authorization-service) e
  `Claims.PrimaryRole`/`Verifier.Verify` (api-gateway). Corrigido
  normalizando a role para minúsculas no ponto de extração do JWT (não
  espalhando `equalsIgnoreCase` pelos pontos de comparação). Retrocompatível
  com o realm `hu` local, que já usa minúsculas.
- **Usernames do seed local não existem no realm real**: `dr.silva`,
  `estagiario.ana` etc. (seed de dev em `db/migrations/001`/`002`) não
  correspondem aos usuários reais do grupo10 (`med.cardoso`, `est.ferreira`,
  `pes.mendes` etc.). Sem linhas em `user_patient_assignments`/`projects`
  referenciando os usernames reais, a decisão de autorização sempre nega por
  falta de vínculo, mesmo com o role correto. Resolvido com um novo arquivo
  `db/migrations/003_cluster_seed_grupo10.sql`, aplicado manualmente só no
  Postgres do cluster (nunca no `hu_db` local, que mantém o seed de dev
  intacto).

## Consequências

- Os manifests usam placeholders (`REGISTRY_PLACEHOLDER`, `ingressClassName:
  nginx`) para valores não documentados pelo professor (registry de imagens,
  IngressClass real) — substituíveis assim que confirmados contra o cluster
  real, sem redesenho.
- `resources.requests/limits` seguem o exemplo do professor (100m/200m cpu,
  128Mi/256Mi mem) para os 3 serviços leves; `authorization-service` (JVM)
  recebeu um valor maior (200m/500m cpu, 384Mi/512Mi mem) por ser
  tipicamente mais pesado — ambos os valores são chute inicial, a ajustar
  após a primeira rodada de carga real (fase b).
- Um novo teste de integração (`AuthorizationGrpcServiceIT
  .medicoComRoleEmMaiusculasObtemAcessoFull`) e testes unitários do gateway
  (`verifier_test.go`) travam a regressão do fix de case de role.

## Riscos / suposições a validar contra o cluster real

Nenhum destes itens bloqueia a escrita dos manifests/scripts, mas todos
precisam ser confirmados antes do primeiro `kubectl apply` real (ver ordem
de execução no plano da tarefa):

- **Registry de imagens**: endereço não documentado; build+push manual
  assumido.
- **IngressClass e path exato `/grupo10`**: suposição de `ingress-nginx` +
  `rewrite-target`, não confirmada.
- **metrics-server**: HPA (fase d) depende dele; presença não confirmada
  (`kubectl top nodes`).
- **kube-state-metrics**: o painel de contagem de pods do dashboard overview
  depende dele.
- **Claim/valor exato do role no JWT do realm `grupo10`**: assumido
  `realm_access.roles` com valores `MEDICO`/`ESTAGIARIO`/`PESQUISADOR`, com
  base no texto do professor — só a leitura de um JWT real confirma (pode
  ser role de client em vez de realm role).
- **Client OIDC para password-grant do k6**: `client_id` desconhecido, grupo
  sem acesso de realm-admin. Se nenhum candidato plausível funcionar, é
  bloqueio externo a reportar, não resolvível só no código.
