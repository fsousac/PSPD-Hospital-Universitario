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

(Valores acima são para o Keycloak local de dev, `docker compose up -d
keycloak` + `scripts/setup-keycloak.sh`. No cluster compartilhado da
disciplina, `VITE_KEYCLOAK_REALM=grupo10` e `VITE_KEYCLOAK_URL=https://kiriland.unb.br/keycloak`
— ver seção "Kubernetes" abaixo.)

### Modo `password` (workaround — client `hu-frontend` ainda não existe no cluster)

`VITE_AUTH_MODE=keycloak` faz o `keycloak-js` redirecionar para o fluxo
Authorization Code + PKCE, que exige um client OIDC registrado (`hu-frontend`)
com `redirect_uri` cadastrado. No realm real do cluster (`grupo10`) esse
client **não existe** — o Keycloak responde "Client not found" — e criá-lo
exige acesso de admin do realm, que o grupo não tem (bloqueio externo, ver
`docs/decisions/0005-k8s-observability-design.md`).

Enquanto isso não é resolvido pelo professor/monitor, `VITE_AUTH_MODE=password`
troca para um formulário de usuário/senha (`src/pages/Login.jsx`) que faz
`grant_type=password` direto contra o client público `admin-cli`
(`src/auth/passwordGrant.js`) — o mesmo client já validado pelo
`loadtests/k6-scenario.js`. Variáveis:

```text
VITE_AUTH_MODE=password
VITE_KEYCLOAK_URL=https://kiriland.unb.br/keycloak
VITE_KEYCLOAK_REALM=grupo10
VITE_PASSWORD_GRANT_CLIENT_ID=admin-cli   # default, raramente precisa mudar
```

Limitação aceita: o token fica só em memória (nunca `localStorage`/
`sessionStorage`), então um F5 na página derruba a sessão — trade-off de
segurança, não um bug. Voltar para `VITE_AUTH_MODE=keycloak` assim que o
client `hu-frontend` existir no realm `grupo10`.

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

Os manifests do frontend ficam em `../k8s/` e sobem no namespace `grupo-10`
do cluster compartilhado da disciplina (ver `../k8s/README.md` para o fluxo
completo, incluindo o build da imagem com os `--build-arg VITE_*` corretos —
o Vite embute essas variáveis no bundle em build time, não em runtime):

```bash
cd ..
docker build -t ghcr.io/fsousac/hu-frontend:latest \
  --build-arg VITE_AUTH_MODE=password \
  --build-arg VITE_KEYCLOAK_URL=https://kiriland.unb.br/keycloak \
  --build-arg VITE_KEYCLOAK_REALM=grupo10 \
  --build-arg VITE_BASE_PATH=/grupo10/ \
  -f frontend/Dockerfile .
docker push ghcr.io/fsousac/hu-frontend:latest
kubectl apply -k k8s/
kubectl -n grupo-10 rollout status deployment/hu-frontend
```

Acesso real em `https://kiriland.unb.br/grupo10` — host único
(`kiriland.unb.br`) compartilhado com o Ingress do api-gateway, dividido por
prioridade de path (o gateway atende só `/grupo10/(api/.*|healthz|readyz|metrics)`,
o frontend é o catch-all do resto). Atualize `k8s/frontend-configmap.yaml`
(referência apenas — não afeta uma imagem já construída) e reconstrua a
imagem com os `--build-arg` corretos se algum desses valores mudar.

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
