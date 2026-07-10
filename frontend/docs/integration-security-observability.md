# Integração, segurança e observabilidade

## Estado atual

- Modo mock: funcional e coberto por MSW.
- Cliente Keycloak: estruturado com Authorization Code Flow, PKCE S256 e token em memória.
- API Gateway: não implementada; contratos continuam provisórios.
- Autorização, anonimização, agregação e auditoria legal: responsabilidades do backend.

## Critérios para integração real

### Keycloak

- cliente público `hu-frontend` criado no realm correto;
- redirect URIs e web origins restritos por ambiente;
- roles `doctor`, `intern` e `researcher` presentes no token;
- HTTPS obrigatório fora do desenvolvimento;
- login, renovação, logout e expiração validados com Felipe;
- `VITE_AUTH_MODE=keycloak` e `VITE_ENABLE_MOCKS=false`.

### API Gateway

- OpenAPI confirmado e versionado;
- CORS restrito às origens do frontend;
- todos os endpoints aceitam JWT e `X-Correlation-ID`;
- erros usam contrato comum sem dados sensíveis;
- níveis `FULL`, `PARTIAL`, `ANONYMIZED` e `AGGREGATED` confirmados;
- auditoria de acesso clínico implementada no servidor;
- testes integrados executados com Eric antes de remover handlers MSW.

## Segurança implementada no frontend

- JWT real não é persistido em `localStorage` ou `sessionStorage`;
- erros técnicos são normalizados e exibem correlação segura;
- telemetria em memória registra apenas categoria e duração;
- Error Boundary não registra mensagem, stack, URL ou payload;
- Nginx envia CSP, `nosniff`, proteção contra frame, política de referência e restrição de recursos do navegador;
- nenhum serviço gRPC é chamado diretamente.

## Observabilidade

`src/observability/telemetry.js` coleta em memória erro por categoria, Largest Contentful Paint, layout shift, long tasks e sinais permitidos de abertura de prontuário, projeto e FHIR. Os sinais não incluem identificadores. O transporte permanece desabilitado até existir contrato aprovado na API Gateway. O futuro endpoint deve aceitar apenas métricas agregadas, nunca rota completa, query string, identificador, token ou conteúdo clínico.

## Auditoria

Eventos do navegador não constituem auditoria legal. O Gateway deve registrar sujeito autenticado, ação, recurso autorizado, resultado, horário e correlação conforme política institucional, mantendo dados mínimos e acesso restrito.
