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

Para desenvolvimento isolado, o frontend usa autenticação e API mockadas:

```text
VITE_AUTH_MODE=mock
VITE_ENABLE_MOCKS=true
```

Perfis mockados podem ser selecionados pela query string:

```text
http://localhost:5173/?perfil=medico
http://localhost:5173/?perfil=estagiario
http://localhost:5173/?perfil=pesquisador
```

O perfil selecionado fica salvo em `sessionStorage` apenas para facilitar a
demonstração local. Tokens reais não são salvos em `localStorage`.

## Integração real com a API Gateway

Com Keycloak e a Gateway disponíveis, use estas variáveis:

```text
VITE_API_BASE_URL=
VITE_AUTH_MODE=keycloak
VITE_ENABLE_MOCKS=false
VITE_KEYCLOAK_URL=http://localhost:8180
VITE_KEYCLOAK_REALM=hu
VITE_KEYCLOAK_CLIENT_ID=hu-frontend
```

O valor vazio de `VITE_API_BASE_URL` faz o navegador usar a própria origem. O
Vite, em desenvolvimento, e o Nginx, em produção, encaminham `/api` para a
API Gateway. Assim o frontend não chama gRPC nem depende de CORS no navegador.

## Execução com Docker Compose

O Compose configura o frontend em modo real, usando Keycloak e a API Gateway:

```bash
docker compose up -d --build frontend
```

A aplicação ficará disponível em:

```text
http://localhost:8088
```

## Kubernetes

Os manifests do frontend ficam em `../k8s/` e sobem a aplicação:

```bash
cd ..
docker build -t hu-frontend:latest -f frontend/Dockerfile .
kubectl apply -k k8s/
kubectl -n hu-observability rollout status deployment/hu-frontend
```

O Ingress padrão usa `hu-frontend.local`. Em um cluster, atualize
`k8s/frontend-configmap.yaml` com as URLs públicas do Keycloak e da API
Gateway, reconstrua a imagem e mantenha os mocks desabilitados.

## Segurança

- O frontend chama somente a API Gateway REST.
- O frontend não chama serviços gRPC diretamente.
- O JWT não é salvo em `localStorage`.
- A autorização real, anonimização e agregação permanecem no backend.
- Tokens e dados clínicos sensíveis não devem ser registrados em logs.

## Qualidade de produto

- Design system: `docs/design-system.md`
- Protocolo de UX clínica: `docs/ux-clinical-validation.md`
- Integração, segurança e observabilidade: `docs/integration-security-observability.md`

O contrato atual da Gateway já é usado pelo frontend para listar pacientes
vinculados (`GET /api/v1/me/patients`), abrir Bundle FHIR protegido
(`GET /api/v1/patients/{id}`) e consultar agregados de pesquisa
(`GET /api/v1/research/aggregate`). O catálogo de projetos e a coorte
anonimizada ainda não possuem endpoints REST na Gateway atual e permanecem
identificados como provisórios no frontend.

Testes ponta a ponta em Chrome real nos viewports de celular, tablet, notebook e tela hospitalar:

```bash
npm run test:e2e
```
