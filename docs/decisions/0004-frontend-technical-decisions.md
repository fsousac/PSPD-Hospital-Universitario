# ADR 0004 - Frontend: decisões técnicas

## Contexto

O repositório ainda não possui frontend implementado. A pasta `frontend/` tinha
apenas documentação, e a API Gateway REST ainda não existe em código. Os
serviços internos já expõem contratos gRPC em `proto/`, mas o frontend deve se
comunicar somente com a API Gateway.

## Decisões

### 1. Stack

O frontend será uma SPA com:

- React
- JavaScript
- Vite
- React Router
- `keycloak-js`
- Material UI
- Recharts
- `fetch` com wrapper centralizado
- Vitest
- React Testing Library
- MSW

TypeScript, Next.js, SSR, Redux e microfrontends não serão usados nesta etapa,
pois aumentam a complexidade sem necessidade comprovada para o escopo acadêmico.

### 2. Comunicação

O frontend chamará somente a API Gateway por REST/HTTP usando JWT no header
`Authorization: Bearer <token>`.

Ele não chamará diretamente os microsserviços gRPC, não aplicará autorização
real e não fará anonimização/agregação de dados clínicos. Essas
responsabilidades permanecem no backend.

### 3. Autenticação

A autenticação será delegada ao Keycloak via OIDC, Authorization Code Flow e
PKCE, usando `keycloak-js`. O token será mantido em memória pelo adapter e não
será salvo em `localStorage`.

O frontend pode ocultar ou exibir menus por perfil, mas isso é apenas controle
visual. A decisão de acesso real deve ser feita pelo backend.

### 4. Contratos provisórios e mocks

Como a API Gateway ainda não está implementada, o frontend usará contratos REST
propostos e MSW para desenvolvimento local. Esses contratos são provisórios até
serem confirmados pela implementação real da API Gateway.

### 5. Segurança e privacidade

O frontend não deve registrar tokens, CPF, CNS, nome completo de pacientes
protegidos, payloads clínicos ou FHIR completo em logs. As telas de pesquisador
devem usar apenas dados agregados ou pseudonimizados.

