# Kubernetes

Manifests Kubernetes do projeto HU Observability.

## Frontend

Os manifests atuais implantam apenas o frontend em modo mock, porque a API
Gateway REST ainda não foi implementada.

Arquivos:

- `frontend-namespace.yaml`
- `frontend-configmap.yaml`
- `frontend-deployment.yaml`
- `frontend-service.yaml`
- `frontend-ingress.yaml`
- `frontend-hpa.yaml`
- `kustomization.yaml`

## Build da imagem

Na raiz do repositório:

```bash
docker build -t hu-frontend:latest -f frontend/Dockerfile .
```

Se o cluster não enxerga imagens locais, carregue a imagem no runtime usado
pelo cluster. Exemplos:

```bash
kind load docker-image hu-frontend:latest
```

ou publique a imagem em um registry acessível e altere
`k8s/frontend-deployment.yaml`.

## Aplicação dos manifests

```bash
kubectl apply -k k8s/
```

## Validação

```bash
kubectl -n hu-observability get pods
kubectl -n hu-observability get svc
kubectl -n hu-observability get ingress
kubectl -n hu-observability rollout status deployment/hu-frontend
```

O healthcheck usa:

```text
/health
```

## Acesso

O Ingress usa o host:

```text
hu-frontend.local
```

Em ambiente local, adicione o host no `/etc/hosts` apontando para o endereço do
Ingress controller.

## Integração futura com API Gateway

Quando a API Gateway estiver pronta:

1. Atualize `VITE_API_BASE_URL` em `frontend-configmap.yaml`.
2. Altere `VITE_AUTH_MODE` para `keycloak`.
3. Altere `VITE_ENABLE_MOCKS` para `false`.
4. Atualize `VITE_KEYCLOAK_URL` para a URL pública do Keycloak.
5. Rebuild a imagem, pois as variáveis `VITE_*` são usadas no build do Vite.

