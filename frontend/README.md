# frontend

SPA React + JavaScript + Vite para o projeto HU Observability.

## Stack

- React
- JavaScript
- Vite
- React Router
- `keycloak-js`
- Material UI
- Recharts
- `fetch` centralizado em `src/api/client.js`
- Vitest + React Testing Library
- MSW para mocks enquanto a API Gateway REST não estiver pronta

## Execução local

```bash
cd frontend
npm install
npm run dev
```

Por padrão o frontend usa autenticação e API mockadas:

```text
VITE_AUTH_MODE=mock
VITE_ENABLE_MOCKS=true
```

Perfis mockados podem ser alternados no dashboard ou pela query string:

```text
http://localhost:5173/?perfil=medico
http://localhost:5173/?perfil=estagiario
http://localhost:5173/?perfil=pesquisador
```

## Execução com Docker Compose

Enquanto a API Gateway REST não estiver pronta, o serviço `frontend` sobe em
modo mock:

```bash
docker compose up -d --build frontend
```

A aplicação ficará disponível em:

```text
http://localhost:8088
```

## Kubernetes

Os manifests do frontend ficam em `../k8s/` e sobem a aplicação em modo mock:

```bash
cd ..
docker build -t hu-frontend:latest -f frontend/Dockerfile .
kubectl apply -k k8s/
kubectl -n hu-observability rollout status deployment/hu-frontend
```

O Ingress padrão usa `hu-frontend.local`. Quando a API Gateway estiver pronta,
atualize `k8s/frontend-configmap.yaml` e reconstrua a imagem com mocks
desabilitados.

## Segurança

- O frontend chama somente a API Gateway REST.
- O frontend não chama serviços gRPC diretamente.
- O JWT não é salvo em `localStorage`.
- A autorização real, anonimização e agregação permanecem no backend.
- Tokens e dados clínicos sensíveis não devem ser registrados em logs.
