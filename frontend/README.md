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

## Segurança

- O frontend chama somente a API Gateway REST.
- O frontend não chama serviços gRPC diretamente.
- O JWT não é salvo em `localStorage`.
- A autorização real, anonimização e agregação permanecem no backend.
- Tokens e dados clínicos sensíveis não devem ser registrados em logs.
