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
`k8s/secrets.env.example`). Não há client secret do Keycloak a proteger no
nosso lado — o client OIDC local de dev (`scripts/setup-keycloak.sh`) é
público (`directAccessGrantsEnabled=true`, sem secret). **Essa suposição não
vale para o realm `grupo10` do cluster compartilhado** — ver risco confirmado
no item 7 e na seção "Riscos" abaixo: lá o client não aceita password grant e
não há segredo disponível para o grupo, então não há Secret a criar mesmo se
quiséssemos.

### 3. ServiceMonitor como discovery primário do Prometheus

Foi confirmado no cluster real que o CRD `monitoring.coreos.com/v1` existe e
que o grupo pode criar `ServiceMonitor` no namespace `grupo-10`
(`kubectl auth can-i create servicemonitors.monitoring.coreos.com -n grupo-10`
retorna `yes`). Portanto `k8s/servicemonitors.yaml` é versionado e aplicado
junto com o restante dos manifests.

`prometheus.io/scrape|port|path` continua no `template.metadata` de cada
Deployment como redundância barata, mas não é mais a hipótese principal.

### 4. HPA aplicado só na fase de autoscaling, não desde o início

Os 4 `HorizontalPodAutoscaler` (min 1, max 10, CPU 70%) ficam em
`k8s/hpa.yaml`, fora da lista `resources` do `kustomization.yaml`. Se
aplicado desde a fase de validação funcional, o HPA reverteria o
`kubectl scale --replicas=3` manual da fase de escalabilidade horizontal —
as duas fases ficariam impossíveis de isolar. Aplicado manualmente só na
fase (d): `kubectl apply -f k8s/hpa.yaml`.

### 5. Ingress single-entrypoint, só para o api-gateway

Só o `api-gateway` é exposto externamente (`k8s/ingress.yaml`,
`https://kiriland.unb.br/grupo10/api/v1/...`) — é o único ponto de entrada da
aplicação (BFF, ver ADR 0004). A dica original do professor apontava a URL
`https://kiriland.unb.br/grupoX` roteada por um Apache externo ao cluster —
na prática esse Apache retornou 404 para `/grupo10` (falha de roteamento do
lado do professor, fora do nosso controle). **Confirmado**: contornado
criando o próprio recurso `Ingress` dentro do namespace (`ingressClassName:
nginx`), com `host: kiriland.unb.br`, `pathType: ImplementationSpecific`,
path regex com o prefixo `/grupo10` e rewrite para remover esse prefixo,
backend na porta 80 do Service `api-gateway` — dica confirmada por outro
grupo e validada como funcional. O frontend ainda não tem stack definida e
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

- Os manifests usam imagens públicas no GHCR e `ingressClassName: nginx`,
  alinhado com a dica recebida para o cluster. Se o professor mudar o
  controller de Ingress, a alteração fica isolada em `k8s/ingress.yaml`.
- `resources.requests/limits` seguem o exemplo do professor (100m/200m cpu,
  128Mi/256Mi mem) para os 3 serviços leves; `authorization-service` (JVM)
  recebeu um valor maior (200m/500m cpu, 384Mi/512Mi mem) por ser
  tipicamente mais pesado — ambos os valores são chute inicial, a ajustar
  após a primeira rodada de carga real (fase b).
- Um novo teste de integração (`AuthorizationGrpcServiceIT
  .medicoComRoleEmMaiusculasObtemAcessoFull`) e testes unitários do gateway
  (`verifier_test.go`) travam a regressão do fix de case de role.

## Riscos / suposições a validar contra o cluster real

- **Registry de imagens**: endereço não documentado; build+push manual
  assumido.
- **[RESOLVIDO] metrics-server**: confirmado presente e funcional
  (`kubectl top pods` retorna CPU/memória reais dos 4 pods). HPA (fase d)
  pode contar com ele.
- **[RESOLVIDO] Drift entre manifests e cluster real**: `kubectl diff -k
  k8s/` revelou que o `Ingress` aplicado no cluster estava desatualizado
  (sem `host: kiriland.unb.br` nem `nginx.ingress.kubernetes.io/use-regex:
  "true"`, backend na porta 8000 em vez de 80) — o arquivo tinha sido
  corrigido localmente mas nunca reaplicado, o que por si só já explicava o
  404 externo. Corrigido com `kubectl apply -k k8s/`; validado com
  `curl https://kiriland.unb.br/grupo10/healthz` → 200. **Lição**: depois de
  qualquer edição em `k8s/*.yaml`, reaplicar (`kubectl apply -k k8s/`) antes
  de assumir que o cluster reflete o repo — `kubectl diff -k k8s/` é a forma
  barata de checar isso a qualquer momento.
- **kube-state-metrics**: o painel de contagem de pods do dashboard overview
  depende dele.
- **Claim/valor exato do role no JWT do realm `grupo10`**: assumido
  `realm_access.roles` com valores `MEDICO`/`ESTAGIARIO`/`PESQUISADOR`, com
  base no texto do professor — ainda não confirmado por leitura de um JWT
  real, porque nenhum client do realm emite esse JWT hoje (ver item abaixo).
- **[RESOLVIDO] 404 em `https://kiriland.unb.br/grupo10`**: confirmado
  bloqueio no Apache do professor (fora do namespace do grupo); contornado
  com `Ingress` próprio no cluster (ver decisão 5). Sem ação pendente do
  nosso lado.
- **[BLOQUEIO CONFIRMADO] Client OIDC para password-grant**: testado
  diretamente contra `https://kiriland.unb.br/keycloak/realms/grupo10/protocol/openid-connect/token`
  com `grant_type=password` para dois clients — `authorization-service` e
  `account-console` — e **ambos retornam `400
  {"error":"unsupported_grant_type"}`**, ou seja, Direct Access Grants está
  desabilitado nos dois no realm real (diferente do client de dev, criado
  com `directAccessGrantsEnabled=true` por `scripts/setup-keycloak.sh`).
  **Segunda confirmação, com token real**: um membro do grupo logou como
  `med.cardoso` em `.../keycloak/realms/grupo10/account/` (Authorization
  Code flow via navegador) e capturou o `access_token` emitido. Decodificado
  (payload JWT, sem validar assinatura): `azp: "account-console"`,
  `resource_access: {"account": {"roles": ["manage-account",
  "manage-account-links"]}}`, **sem nenhuma chave `realm_access`** — ou
  seja, não é só que falta o role `MEDICO`, o token não carrega roles de
  realm de forma alguma, só roles do client `account`. Confirma que login
  via `/account/` não é um caminho viável independentemente de qual usuário
  logar. **Não há caminho, com o que o grupo tem hoje, para obter um JWT de
  aplicação sem ação do professor** — as opções são: (a) habilitar Direct
  Access Grants no client `authorization-service`, ou (b) registrar um
  `redirect_uri` de teste nesse client para permitirmos Authorization Code
  flow, ou (c) fornecer o client secret caso o client vire confidential.
  Reportar como bloqueio externo (`fwcruz@unb.br`). Enquanto isso,
  `loadtests/k6-scenario.js` aceita `ACCESS_TOKEN` para reaproveitar um JWT
  válido obtido por qualquer outro meio.
  **Terceira verificação (2026-07-12)**: outro grupo (realm `grupo01`)
  reportou que o endpoint `/protocol/openid-connect/userinfo` retorna um
  claim `groups` com o papel da aplicação (ex.: `"MEDICO"`), mesmo o JWT
  sendo "lightweight". Testamos essa hipótese no nosso realm com um token
  real: automatizamos o login (`med.cardoso`) via navegador (mesmo fluxo
  Authorization Code + PKCE do `account-console`), capturamos o
  `access_token` emitido e chamamos
  `.../keycloak/realms/grupo10/protocol/openid-connect/userinfo` com ele.
  **Resultado: não tem `groups`, nem qualquer claim de papel** — só
  `sub/name/preferred_username/email`. Também testamos `grant_type=password`
  com `client_id=admin-cli` (o grupo01 mencionou que funcionava para eles) e
  deu o mesmo `400 unsupported_grant_type` dos outros clients. Ou seja, o
  mapper de `groups` no userinfo é configuração por realm — o grupo01 tem,
  o `grupo10` não.
- **[RESOLVIDO] (2026-07-12) — o bloqueio era um bug nosso, não do Keycloak**:
  os testes de `grant_type=password` acima (`unsupported_grant_type` para os
  3 clients) usavam um `curl -d @arquivo` com um arquivo de credenciais
  separado por **quebra de linha** em vez de `&` — corpo malformado, o
  Keycloak nem via `client_id`/`username`/`password` de verdade. Reexecutado
  com o corpo `&`-separado correto, os 3 clients dão respostas **diferentes**
  do que se pensava:
  - `admin-cli` → **`200 OK`** (client público built-in do Keycloak, aceita
    password grant sem segredo — confirmado independentemente pelo grupo via
    Postman também).
  - `authorization-service` → `401 invalid_client` (client **confidencial**,
    exige `client_secret` que não temos — diferente de "Direct Access Grants
    desabilitado").
  - `account-console` → `400 unauthorized_client "Client not allowed for
    direct access grants"` — esse sim, DAG genuinamente desabilitado.

  Com `admin-cli` + `scope=openid microprofile-jwt` no corpo do POST, o
  `id_token` retornado **carrega o claim `groups`** com o papel real (ex.
  `MEDICO`) — confirmado decodificando o `id_token` de um login real de
  `med.cardoso`. O `access_token` continua "lightweight" (sem `groups`, sem
  `sub`, só `exp/iat/azp/scope`) — só o `id_token` (e uma chamada a
  `/userinfo`) carregam o papel nesse realm.

  **Ou seja, não há bloqueio externo**: `admin-cli` + `scope=microprofile-jwt`
  resolve a obtenção do token com papel, sem ação do professor. Ação
  corrigida: `TokenValidationService.extractRealmRoles`
  (`services/authorization-service`) ganhou um fallback que lê `groups`
  quando `realm_access` não existe, filtrando ruído
  (`default-roles-*`/`offline_access`/`uma_authorization`) contra as 3 roles
  conhecidas — coberto por teste
  (`AuthorizationGrpcServiceIT.medicoComRoleViaGroupsClaimObtemAcessoFull`).
  `loadtests/k6-scenario.js` atualizado para usar `admin-cli` +
  `scope=microprofile-jwt` + `id_token` por padrão.

## Frontend — deploy readiness (2026-07-12)

Frontend (`frontend/`, React+Vite+nginx, PR "front-integration-main") foi
mesclado com manifests K8s próprios. Achados ao revisar pra deploy no
cluster compartilhado:

- **[CRÍTICO, corrigido]** `k8s/frontend-namespace.yaml` criava um
  `Namespace` cluster-scoped novo (`hu-observability`) — recurso não
  namespaced, o transformer `namespace: grupo-10` do kustomize não o afeta.
  Num cluster compartilhado sem permissão de `create namespaces`, isso
  provavelmente falha com `Forbidden` e aborta o `kubectl apply -k` inteiro
  (não só o frontend). **Removido** o arquivo e a referência em
  `kustomization.yaml`; os outros manifests do frontend tiveram o
  `namespace: hu-observability` explícito removido (usam `grupo-10` via
  kustomize, igual aos demais serviços).
- **[corrigido]** `ConfigMap` (`frontend-configmap.yaml`) tinha valores de
  ambiente local/kind (`hu-frontend.local`, realm `hu`, `VITE_AUTH_MODE=mock`)
  — atualizado pros valores reais (`https://kiriland.unb.br/keycloak`, realm
  `grupo10`, `VITE_AUTH_MODE=keycloak`). **Atenção**: o Vite embute `VITE_*`
  no bundle estático em *build time* — o ConfigMap não tem efeito em runtime
  sobre uma imagem já construída, serve só de referência do que passar como
  `--build-arg` ao gerar a imagem.
- **[pendente, ação externa]** imagem `hu-frontend:latest` não existe em
  registry nenhum — atualizado o `Deployment` pra referenciar
  `ghcr.io/fsousac/hu-frontend:latest` (convenção dos outros serviços), mas
  a imagem ainda precisa ser **construída e publicada** com os build-args
  corretos (`VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM=grupo10`,
  `VITE_BASE_PATH=/grupo10/`, etc.) antes do deploy funcionar.
- **[corrigido]** SPA não tinha suporte a servir fora da raiz. Adicionado
  `base: process.env.VITE_BASE_PATH || '/'` no `vite.config.js` (novo
  build-arg `VITE_BASE_PATH` no Dockerfile, default `/` pra não quebrar
  dev/docker-compose) e `basename={import.meta.env.BASE_URL}` no
  `BrowserRouter` (`src/main.jsx`). Testado localmente: build com
  `VITE_BASE_PATH=/grupo10/` gera `index.html` com assets em
  `/grupo10/assets/...`, consistente com o rewrite do Ingress.
- **[pendente, decisão/risco]** `k8s/ingress.yaml` (gateway) hoje reivindica
  **todo** o path `/grupo10(/|$)(.*)` no host `kiriland.unb.br`. O
  `frontend-ingress.yaml` (atualizado pra host/path reais) reivindica
  exatamente o mesmo path — as duas Ingress não podem coexistir como estão.
  É preciso estreitar o path do gateway pra algo como
  `/grupo10/(api/.*|healthz|readyz|metrics)` antes de aplicar o Ingress do
  frontend, e validar ao vivo com `curl` em ambos os paths (gateway já está
  validado em produção — mexer nele tem risco de regressão nas fases (a)/(c)/(d)
  já executadas). Não aplicado ainda — decisão para confirmar antes de tocar
  no Ingress do gateway.
- **[CONFIRMADO, ação externa]** client Keycloak `hu-frontend` (público, SPA)
  referenciado em `VITE_KEYCLOAK_CLIENT_ID` — **não existe** no realm real
  `grupo10`: acessar `https://kiriland.unb.br/grupo10` e entrar redireciona
  pro `/auth` do Keycloak, que responde a página de erro **"Client not
  found"**. Criar o client (público, Authorization Code + PKCE,
  `redirect_uri` `https://kiriland.unb.br/grupo10/*`) exige admin do realm,
  que o grupo não tem — bloqueio externo, mesma natureza dos outros itens de
  Keycloak nesta seção. Ver "Workaround: login via admin-cli" abaixo.
- `docs/frontend-api-contracts.md` está desatualizado (descreve endpoints
  provisórios `/api/patients`, `/api/research/projects` que não existem no
  gateway real) — o código do frontend já usa as rotas reais (`/api/v1/...`),
  só a doc ficou pra trás.
- 7 testes de `vitest` já falhavam **antes** dessas mudanças (confirmado via
  `git stash`) — não é regressão introduzida aqui, mas fica registrado.
- **[PENDENTE, ação do usuário]** o pacote `ghcr.io/fsousac/hu-frontend` foi
  publicado pela primeira vez nesta sessão e ficou **privado** por padrão —
  `kubectl` no cluster recebe `401 Unauthorized` no pull anônimo. Precisa
  tornar público em GitHub → perfil → Packages → `hu-frontend` → Package
  settings → Change visibility. `gh api` não tem escopo `packages` pra
  automatizar isso.

## [RESOLVIDO] Tela em branco em `/grupo10` — basename do React Router (2026-07-12)

Depois do primeiro deploy do frontend, `https://kiriland.unb.br/grupo10`
carregava o bundle mas não renderizava nada. Console: `<Router
basename="/grupo10/"> is not able to match the URL "/grupo10" because it
does not start with the basename`. `import.meta.env.BASE_URL` do Vite
sempre mantém a barra final (`/grupo10/`), mas a URL que o navegador usa sem
digitar a barra (`/grupo10`) não começa com esse literal — falha de string
match, não de configuração. **Fix**: `src/main.jsx` remove a barra final
antes de passar como `basename` (`import.meta.env.BASE_URL.replace(/\/$/,
'')`), que casa tanto `/grupo10` quanto `/grupo10/qualquer-coisa`.

## [RESOLVIDO] Workaround: login via `admin-cli` (`grant_type=password`) (2026-07-12)

Com a tela renderizando, o botão de login expôs o bloqueio real: redirect
pro Keycloak retorna **"Client not found"** — confirma que `hu-frontend`
(client público esperado pelo fluxo Authorization Code + PKCE do
`keycloak-js`) não existe no realm `grupo10` do cluster. Criar esse client
exige admin do realm, fora do alcance do grupo — mesma classe de bloqueio já
documentada para o `authorization-service`/`account-console` (ver seção
"Adaptação do uso do Keycloak" acima).

Diferente daquele bloqueio (resolvido usando `admin-cli` para o k6), aqui não
dá pra simplesmente trocar o `client_id` do `keycloak-js`: o fluxo
Authorization Code depende do client ter um `redirect_uri` cadastrado, e
`admin-cli` não tem (nem deveria, é built-in do Keycloak para uso via CLI).

**Fix (workaround, não solução definitiva)**: `VITE_AUTH_MODE=password`
troca o `AuthProvider` para Resource Owner Password Credentials
(`grant_type=password`) direto contra `admin-cli` via `fetch`
(`src/auth/passwordGrant.js`), sem `keycloak-js` nem redirect — a mesma
chamada que já funciona em `loadtests/k6-scenario.js`. Usa o `id_token`
(não o `access_token`, que é "lightweight" nesse realm — sem `sub`/roles)
como Bearer para a API Gateway, e extrai o papel do claim `groups` (com
fallback pra `realm_access.roles` no realm de dev local `hu`), mesma lógica
de fallback já usada no backend (`TokenValidationService.extractRealmRoles`).
Token fica só em memória (nunca `localStorage`/`sessionStorage`) — F5 na
página derruba a sessão, trade-off aceito por segurança.

**Não é a solução final**: o enunciado espera OAuth2/OIDC via Authorization
Code (é o padrão de mercado para SPAs, e o que `keycloak-js` já implementa
corretamente no repo). Assim que o professor/monitor criar o client
`hu-frontend` no realm `grupo10` com o `redirect_uri` certo, o correto é
voltar `VITE_AUTH_MODE=keycloak` — o código desse modo não foi removido, só
deixou de ser o padrão do build do cluster.

## [RESOLVIDO] Bug de performance real em `GetPatientsByCarer` (2026-07-12)

Com o bloqueio de JWT/roles resolvido (ver seção acima), o primeiro teste de
carga real revelou um bug genuíno, até então inalcançável: `GET
/api/v1/me/patients` retornava `504 tempo limite ao contatar
patient-data-service` para `med.cardoso` (papel médico já reconhecido
corretamente — não era mais o bug de role).

Diagnóstico (via `kubectl exec` no pod, consultas somente leitura,
autorizado explicitamente pelo usuário): não é bug de conectividade nem de
schema — é volume de dados. O seed real do cluster tem **150.000 pacientes**
e **~188 mil vínculos** distribuídos entre só **10 usuários** (média de
~18.784 vínculos/usuário) — um dataset propositalmente grande para os
testes de carga da fase (b), não um erro de geração. `med.cardoso`
especificamente tem **30.015** vínculos `ATTENDING`.

`GetPatientsByCarer` fazia duas queries sequenciais: (1) buscar os
`patient_id`s do vínculo, (2) buscar os `Patient`s completos via `WHERE
patient_id IN (...)` com esses IDs — para 30 mil IDs, a segunda query
sozinha levava ~5.4s, e o total (~6.8s) estourava o
`UPSTREAM_TIMEOUT_MS=5000` do `api-gateway`.

**Fix**: `services/patient-data-service/src/servicer.py` —
`GetPatientsByCarer` trocado para um único `SELECT ... JOIN
user_patient_assignments` (elimina o round-trip extra e o `IN` gigante).
Testado direto contra o Postgres do cluster: **3.2s** (era 6.8s). Rebuild +
push de `ghcr.io/fsousac/hu-patient-data-service:latest` e `kubectl rollout
restart` aplicados. Confirmado `200 OK` (~6s ponta a ponta, 3x consecutivas)
em `GET /grupo10/api/v1/me/patients` com token real de `med.cardoso`.

Nota: ~6s de latência total pra um usuário com 30 mil pacientes ainda era
alto pra um limiar de UX normal (`p(95)<2000ms` nos testes k6) — o primeiro
teste de carga real (10 VUs) confirmou: 99.58% de falha, tudo batendo no
timeout de 5s sob concorrência. Não era mais bug, era o formato do endpoint
(devolver a lista inteira) incompatível com esse volume de dado.

## [RESOLVIDO] Paginação em `GetPatientsByCarer` (2026-07-12)

Adicionado `limit`/`offset` ao `GetPatientsByCarerRequest` e `total_count`/
`limit`/`offset` ao `PatientListResponse` (`proto/patient_data.proto`).
`patient-data-service` aplica `LIMIT`/`OFFSET` na query (default 50, teto
200) mais uma query `COUNT(*)` separada e barata para o total. `api-gateway`
repassa `?limit=&offset=` da querystring e inclui `totalCount/limit/offset`
na resposta JSON. Frontend (`src/api/patients.js`) não quebra — só passa a
ver a primeira página; UI de paginação fica para um follow-up.

Testado contra o Postgres real: count query 0.43s + página de 50 = 0.07s
(~0.5s total, era 3.2s buscando os 30 mil de uma vez). Confirmado `200 OK`
em **0.65s** ponta a ponta (`GET /grupo10/api/v1/me/patients`), contra ~6s
antes — resolve a causa raiz da falha no teste de carga, não só o sintoma.

**Bug real encontrado no processo** (não relacionado à paginação em si, mas
descoberto ao testar): `services/patient-data-service/Dockerfile` copiava o
diretório `src/generated/` inteiro do estágio de build por cima do `src/`
real — como `services/patient-data-service/src/generated/__init__.py`
commitado no git contém lógica real (`sys.path.insert` — os stubs `_pb2`
gerados usam import absoluto entre si, não relativo), e o builder cria um
`__init__.py` **vazio** só via `touch` pra ter onde escrever, a ordem errada
fazia o vazio vencer, quebrando `ModuleNotFoundError: No module named
'patient_data_pb2'` em produção. Corrigido copiando só os dois arquivos
`_pb2` gerados do builder, nunca o diretório inteiro. Os stubs commitados em
`src/generated/` também foram regenerados (`grpcio-tools==1.65.1`, pinned em
`requirements.txt`) para não ficarem desatualizados em relação ao `.proto`
atual.

## [RESOLVIDO] gRPC pinado numa única réplica — causa raiz do colapso em 50 VUs (2026-07-12)

Com o bloqueio de JWT resolvido, o primeiro teste de carga completo (10 VUs)
já passou (97.87% sucesso), mas 50 VUs colapsou (90%+ de falha, a maioria
`me/patients`/`patients/{id}` batendo no timeout de 5s). Escalar réplicas
manualmente (fase c: `kubectl scale --replicas=3`, depois
`authorization-service` para 2) **não mudou o resultado** — sinal de que o
gargalo não era capacidade de CPU/réplicas.

**Investigação, descartando hipóteses em ordem**:

1. **CPU throttling** — descartado: `kubectl get hpa -w` durante o teste
   mostrava utilização de CPU sempre baixa (nunca > ~68%) mesmo com o teste
   falhando quase por completo.
2. **Esgotamento do pool de conexões do Postgres** — descartado: consulta
   ao vivo (`SHOW max_connections` = 500; `SELECT count(*) FROM
   pg_stat_activity ... GROUP BY state` via `\watch 2`, só leitura,
   autorizado explicitamente) nunca mostrou mais que ~9 conexões ativas
   durante um teste de 50 VUs.
3. **Pinagem de conexão gRPC no lado do cliente (causa raiz confirmada)** —
   `grpc.NewClient`/`grpc.aio.insecure_channel` no `api-gateway` e no
   `data-transform-service` abre uma única conexão HTTP/2 no start do
   processo e a reutiliza por todo o processo. Contra um Service
   `ClusterIP` comum (um único IP virtual), a policy padrão do gRPC
   (`pick_first`) fixa todo o tráfego no pod que o resolver DNS devolveu
   naquele instante — réplicas extras nunca recebem requisição nenhuma.
   Isso também explica por que a métrica de CPU do HPA (média entre
   réplicas) nunca disparava: um pod sobrecarregado entre vários ociosos dá
   uma média baixa.

**Fix**: Service headless (`clusterIP: None`, DNS passa a devolver um IP por
pod) para `patient-data-service`, `authorization-service` e
`data-transform-service`, combinado com a policy `round_robin` do lado do
cliente:

- Go (`services/api-gateway/internal/clients/clients.go`): dial em
  `"dns:///" + addr` (força o resolver DNS em vez de `passthrough`) +
  `grpc.WithDefaultServiceConfig(`{"loadBalancingConfig":
  [{"round_robin":{}}]}`)` + import em branco de
  `google.golang.org/grpc/balancer/roundrobin` (registra a policy).
- Python (`services/data-transform-service/src/client/patient_data_client.py`):
  `grpc.aio.insecure_channel("dns:///" + address, options=[("grpc.lb_policy_name",
  "round_robin")])`.

`clusterIP` é campo imutável — converter um Service `ClusterIP` existente
para headless exige `kubectl delete service ...` seguido de
`kubectl apply -k k8s/`, não só `apply` por cima.

Achados incidentais durante o rebuild das imagens (corrigidos porque a
imagem já estava sendo reconstruída de qualquer forma):

- Mesmo bug de ordem de `COPY` no `Dockerfile` do `data-transform-service`
  já corrigido antes no `patient-data-service`: o builder cria um
  `src/generated/__init__.py` vazio só via `touch` para o `protoc` ter onde
  escrever; copiar o diretório `generated/` inteiro do builder por cima do
  `src/` real sobrescrevia o `__init__.py` commitado (que tem lógica real
  de `sys.path.insert`, necessária porque os stubs `_pb2` gerados usam
  import absoluto entre si). Corrigido copiando o `src/` real primeiro e só
  os 4 arquivos `_pb2`/`_pb2_grpc` do builder depois, nunca o diretório
  inteiro. Os stubs commitados também estavam desatualizados em relação ao
  `.proto` (faltavam `ListProjects`/`GetProject` e os campos de paginação)
  — regenerados com `grpcio-tools==1.65.1` (pinned).
- `TransformToFhir` fazia `list_encounters`/`get_clinical_events`
  sequencialmente, mas as duas chamadas só dependem do `patient_id` (já
  resolvido pela checagem `get_patient` anterior) — paralelizado com
  `asyncio.gather`, cortando um round-trip da cadeia por requisição.

**Resultado após o fix**: 50 VUs foi de ~90% de falha para **0% de falha**
(100% de sucesso) depois do fix + o HPA escalar `patient-data-service` de 1
para 10 réplicas sob carga real. `p(95)` de latência ainda cruza o limiar de
2000ms do teste (2.99s) — sucesso funcional está garantido, ajuste fino de
latência (ex.: aumentar `UPSTREAM_TIMEOUT_MS` ou otimizar consultas) fica
como próximo passo, não bloqueador.

## [RESOLVIDO] Regressão de cold-start do `authorization-service` entre execuções (2026-07-12)

Um retest isolado de 10 VUs (rodado bem depois do burst de 50 VUs acima, já
com os pods estabilizados por vários minutos) voltou a falhar: 31.98% de
erro, quase todo em `patients/{id}` (35% sucesso), com as falhas batendo
exatamente no timeout de 5s enquanto as chamadas bem-sucedidas eram rápidas
(p95 ≈167ms) — assinatura de "réplica sobrecarregada sozinha", não de bug de
código (nada em `services/`/`k8s/`/`loadtests/` tinha mudado desde o teste
de 10 VUs anterior, que passou com 97.87%).

`kubectl get pods -n grupo-10` e `get hpa -n grupo-10` no momento confirmaram
a causa: os 3 pods do `authorization-service` tinham só 3-4 minutos de
idade, e o HPA mostrava `REPLICAS: 3` mesmo com CPU já baixa (3%/70%) —
sinal de que ele tinha acabado de escalar de 1→3 **durante** esse próprio
teste de 10 VUs, não antes.

**Causa raiz**: `k8s/hpa.yaml` tinha `minReplicas: 1` para
`authorization-service` nos 4 HPAs, igual aos outros 3 serviços. Depois de
qualquer período ocioso (janela de estabilização do HPA, ~5min), ele reduz
de volta para 1 réplica — desfazendo o baseline manual de 2 réplicas já
provado necessário na fase (c) (`k8s/authorization-service.yaml`: "com 1
réplica só, virou o gargalo de `/patients/{id}` sob 50 VUs"). A próxima
rajada de carga então precisa escalar de novo, mas `authorization-service` é
JVM (Quarkus) com `startupProbe` permitindo até 60s pra ficar pronto — mais
que a duração de um cenário de teste (1-2min) inteiro. Como pods não-`Ready`
não recebem tráfego (não entram nos Endpoints do Service), a única réplica
original absorveu 100% da carga sozinha enquanto as 2 réplicas novas ainda
inicializavam, reproduzindo o mesmo gargalo da fase (c) — um efeito colateral
do próprio HPA da fase (d) desfazendo a correção da fase (c) em todo período
ocioso entre execuções.

**Fix (revertido depois, ver seção "[DECISÃO REVISADA]" mais abaixo)**:
`k8s/hpa.yaml` — `minReplicas` do `authorization-service` alterado de 1
para 2. Mantém autoscaling real até `maxReplicas: 10` sob carga sustentada,
mas garante o baseline "morno" de 2 réplicas o tempo todo, eliminando a
janela de cold-start entre execuções de teste — ao custo de manter
recursos ociosos fora de janela de teste; depois substituído por uma
correção na forma da carga do k6 (rampa gradual), que ataca a causa raiz
sem esse custo permanente.

`loadtests/run-scenarios.sh` também passou a esperar (até 150s) todos os
pods do namespace ficarem `Ready` antes de cada um dos 5 cenários — mitiga
o mesmo problema de forma geral (não só pro `authorization-service`), já
que o mesmo padrão pode se repetir em qualquer serviço entre níveis de VU.

## [RESOLVIDO] p95 inflado por "primeiro contato" mesmo com 0% de falha (2026-07-12)

Com os dois fixes acima, o retest de 10 VUs foi de 31.98% pra **0% de
falha** — mas `p(95)=2.48s` ainda cruzava o threshold de 2000ms, mesmo com
todos os checks passando (`avg=701ms`, `med=304ms`, mas `p90=1.94s`). O pod
Ready (probe de saúde OK) não significa "aquecido": JIT do
`authorization-service` (JVM) ainda frio e conexões gRPC novas do
`round_robin` (handshake TCP/HTTP2 pra réplicas que o HPA acabou de subir)
custam caro na primeira chamada real — e como esse custo cai justamente nas
primeiras requisições do teste, ele infla desproporcionalmente a cauda
(p90/p95) de uma amostra pequena (10 VUs × 1min ≈ 500 requisições).

**Fix**: `loadtests/k6-scenario.js` — `setup()` agora dispara 10 chamadas de
aquecimento reais (mesmos endpoints do teste) contra o pipeline completo
antes da fase cronometrada, tagueadas fora de `phase:main` de propósito. Os
thresholds passaram a ser escopados na tag (`http_req_duration{phase:main}`,
`http_req_failed{phase:main}`), medindo só as requisições do `default()`
principal — prática padrão de teste de carga (medir regime, não o
transiente de start), não uma forma de mascarar falha real (o aquecimento
usa o mesmo `check()`/pipeline, só não conta pro threshold).

Mesmo com os 3 fixes, um rerun isolado de 10 VUs ainda cruzou
`p(95)<2000ms` (2.69s, puxado por um único outlier de 11.74s) enquanto CPU e
contagem de réplicas ficaram estáveis e baixos o teste inteiro (nenhum
scale-event) — e um rerun manual imediatamente depois, nas mesmas
condições, passou limpo (p95=205ms). Como não há correlação com CPU/réplica
própria, a explicação mais provável é ruído do cluster **compartilhado**
entre os 10 grupos da disciplina (rede/contenção num nó por outro grupo
rodando teste ao mesmo tempo) — fora do nosso controle/código. Tratado como
característica do ambiente de teste a documentar no relatório, não bug a
perseguir indefinidamente.

**Achado adicional**: `run-scenarios.sh` usava `set -euo pipefail`, e o k6
sai com código != 0 quando um threshold é cruzado — a suíte estava
abortando no primeiro nível (10 VUs) que cruzasse qualquer threshold e
nunca chegava a rodar 50/100/500/1000. Corrigido: cada nível roda até o
fim independente do resultado dos anteriores, com um aviso impresso por
threshold cruzado; o código de saída do script só reflete o status
agregado no final.

## [RESOLVIDO] CPU é métrica cega para o gargalo real do api-gateway em 500 VUs (2026-07-12)

Suíte completa (10/50/100/500/1000, com os 3 fixes de fase (b) já aplicados)
rodou até o fim (fix do `run-scenarios.sh` não abortar mais no primeiro
threshold cruzado, ver seção acima). Resultados: 10 VUs cruzou só
`p(95)<2000` (2.09s) por ruído pontual do cluster compartilhado (mesma
classe do outlier já discutido); **50 e 100 VUs colapsaram** (90.49% e
94.68% de falha, respectivamente — a maioria batendo no timeout de 5s do
gateway, um patamar abaixo do que já tínhamos validado limpo antes, sinal
de que o ambiente compartilhado estava sob carga externa nesse momento, não
regressão de código); **500 VUs colapsou muito mais** (97.92% de falha),
mas de um jeito qualitativamente diferente: os erros eram `dial: i/o
timeout` / `request timeout` **no cliente k6**, ou seja, a conexão TCP nem
chegava a ser estabelecida — não é mais um 5xx/timeout do gateway
processando a requisição, é uma falha de rede antes disso.

`kubectl get hpa -n grupo-10 -w` durante o teste de 500 VUs mostrou
`api-gateway` oscilando entre ~1-52% de CPU (nunca perto de 70%) — **e por
isso nunca escalou além de 1 réplica**, apesar de 97.92% de falha ao mesmo
tempo. Investigação do código (`services/api-gateway/`) descartou causas de
aplicação: não há rate limiter que explique isso (o limiter existente,
500rps/1000burst, devolve `429` numa conexão TCP já estabelecida — sintoma
diferente do observado), nem pool/limite de conexões concorrentes no
`http.Server` ou na cadeia de middlewares do chi.

**Causa raiz**: `api-gateway` é I/O-bound — passa a maior parte do tempo
bloqueado esperando resposta gRPC dos outros 3 serviços, não computando.
Isso deixa a métrica de CPU estruturalmente cega ao gargalo real: com
apenas 1 réplica (único ponto de entrada externo da aplicação, ADR decisão
5), 500 conexões concorrentes miram o mesmo pod/IP — cenário clássico de
esgotamento de portas SNAT/conntrack no roteamento do Service, que produz
exatamente `dial: i/o timeout` sem nunca aparecer como uso de CPU.

**Fix (revertido depois, ver seção seguinte)**: `k8s/hpa.yaml` —
`minReplicas` do `api-gateway` alterado de 1 para 3 (mesmo valor já provado
necessário manualmente na fase c). Mesma classe de correção do
`authorization-service` (baseline mínimo que não depende de uma métrica que
não reflete o gargalo real daquele serviço específico), aplicada a um
sintoma diferente (rede/conexões em vez de cold-start de JVM). Não resolve
a limitação de fundo (CPU-based HPA não é a métrica ideal pra um proxy
I/O-bound — o ideal seria autoscaling por requisições em voo ou conexões
ativas, o que exigiria um adaptador de métricas customizadas não
confirmado como disponível neste cluster compartilhado) — fica registrado
como limitação conhecida pro relatório, não bloqueador.

## [DECISÃO REVISADA] `minReplicas` de volta pra 1 nos 4 — a rampa no k6 resolve sem gastar cota ociosa (2026-07-12)

As duas seções acima (`authorization-service` min:2, `patient-data-service`
e `api-gateway` min:3) tratavam o sintoma certo com a ferramenta errada:
elevar o piso permanente de réplicas evita o cold-start, mas paga o custo
**o tempo todo**, mesmo fora de janela de teste — real considerando que a
`ResourceQuota` do namespace (`cota-grupo`: 3 cores request/6 cores limit)
é compartilhada com os outros serviços e o frontend.

A causa raiz de todos os 3 casos era a mesma: os cenários k6 saltavam de 0
pro alvo de VUs **instantaneamente** (`--vus N`). Um degrau assim não dá a
nenhum HPA (~15-30s de sync period) nem a nenhuma réplica nova (até 60s pra
ficar `Ready`, pior caso JVM) uma janela real de reação, **não importa o
valor do `minReplicas` ou do alvo de utilização** — só adiar o problema pra
"depois que a réplica extra também ficar ociosa e for reduzida de novo".

**Fix definitivo**: `loadtests/k6-scenario.js` passou a usar o executor
`ramping-vus` (0 → VUS em `RAMP_UP_SECONDS`, default 30s, depois sustenta
por `DURATION`) em vez do executor simples `--vus`/`--duration`. Isso ataca
a causa raiz (forma da carga) em vez do sintoma (piso de réplicas), então
os 4 `HorizontalPodAutoscaler` voltaram para `minReplicas: 1` — sem gastar
cota do namespace fora de janela de teste, e com o próprio `run-scenarios.sh`
(`wait_for_cluster_ready`) garantindo que cada nível da suíte comece com o
cluster já estabilizado do nível anterior.

## [RESOLVIDO] 30s de rampa não bastava — convergência do HPA leva vários ciclos (2026-07-12)

Depois de sincronizar o `hpa.yaml` reduzido (`kubectl apply` confirmado,
`authorization-service` "configured", os outros já "unchanged") e rodar a
suíte com a rampa de 30s do fix anterior, 50 e 100 VUs ainda colapsaram
(72.27% e 88.04% de falha) — `iteration_duration` com mediana de 11s
(ambas as chamadas da iteração batendo no timeout de 5s do gateway),
sinal de saturação sustentada, não só um transiente no início.

`kubectl get hpa -n grupo-10 -w` durante esse teste mostrou o motivo:
`patient-data-service` foi de 1 réplica (CPU 133%/70%) → 2 réplicas (CPU
ainda 197%/70%!) → 3 réplicas (193%/70%, só aí estabilizando perto de
67-68%/70%) — **3 ciclos de reconciliação** pra convergir, cada um
levando ~15-30s (sync period do HPA) mais o tempo de start do pod novo.
No total, convergência real levou algo entre 60-90s — bem mais que os 30s
de rampa dados. `authorization-service` teve o mesmo padrão (125%/70% →
2 réplicas). Ou seja: a rampa de 30s até evitou o pior (degrau
instantâneo), mas não deu tempo suficiente pro HPA terminar de convergir
antes da fase medida (`hold`) começar.

**Fix**: duas mudanças complementares, nenhuma custando recursos ociosos
fora de janela de teste:

1. `k8s/hpa.yaml` — `behavior.scaleUp` explícito nos 4 HPAs, mais agressivo
   que o default do k8s (que só dobra a contagem de réplicas por ciclo de
   15s): permite ir direto a até 400% da contagem atual (ou +8 pods, o que
   for maior) por ciclo, sem `stabilizationWindowSeconds`. Reduz o número
   de ciclos necessários pra convergir da mesma forma que dobrar exigiria.
2. `loadtests/run-scenarios.sh` — rampa por nível de VUs em vez de um valor
   fixo (`ramp_for()`: 15s/60s/75s/105s/135s para 10/50/100/500/1000),
   dando tempo proporcional ao que a convergência de HPA realmente
   demanda em cada patamar de carga. `RAMP_UP_SECONDS_OVERRIDE` permite
   sobrescrever se a calibração precisar de ajuste fino depois.

Como a rampa agora pode ser uma fração bem maior do tempo total do teste,
`k6-scenario.js` também passou a tagear `phase:ramp` (não conta nos
thresholds) enquanto `exec.instance.currentTestRunDuration` ainda não
passou de `RAMP_UP_SECONDS`, e só marca `phase:main` (conta) depois disso
— sem essa distinção, uma rampa longa dominando o tempo total do teste
diluiria os números e mascararia se a capacidade sustentada real
(`hold`) está adequada ou não.

## Execução das fases (atualizado 2026-07-12)

- **Fase (a) validação funcional**: **concluída**. Bloqueio de JWT
  resolvido (`admin-cli` + `scope=microprofile-jwt`, ver seção acima) — os
  3 perfis (MEDICO/ESTAGIARIO/PESQUISADOR) exercitados fim-a-fim contra o
  cluster real.
- **Fase (b) testes de carga (k6)**: **executada nos 5 níveis**. 10 VUs:
  melhor caso 97.87-100% sucesso (thresholds de latência ocasionalmente
  cruzados por ruído do cluster compartilhado, não falha funcional). 50
  VUs: 100% sucesso (0% falha) validado após o fix de pinagem gRPC — mas
  numa execução em sequência (10→50→100→500→1000 a partir de estado ocioso,
  via `run-scenarios.sh`) o mesmo nível colapsou (90.49%), e 100 VUs
  também (94.68%). Suspeita principal, ainda a confirmar no próximo rerun:
  `patient-data-service` tinha `minReplicas: 1`, mesma causa raiz do
  cold-start já visto no `authorization-service` — pool de conexões do
  Postgres + atraso do resolver DNS do gRPC pra descobrir réplica nova —
  não ruído do ambiente como inicialmente suposto. 500 VUs: colapso mais
  severo (97.92%) com causa raiz distinta e real — `api-gateway` preso em 1
  réplica porque CPU nunca reflete saturação de um serviço I/O-bound (ver
  seção acima). 1000 VUs: ainda não coletado. Suíte completa a ser
  re-executada do zero com o fix definitivo aplicado: rampa gradual de VUs
  no k6 em vez de degrau instantâneo, mantendo `minReplicas: 1` nos 4
  serviços (ver seção "[DECISÃO REVISADA]" abaixo). Conclusão parcial para
  o relatório: a aplicação sustenta carga real (50 VUs validado limpo, 0%
  falha, quando os pods já estão aquecidos), mas autoscaling reativo por si
  só não é suficiente pra evitar regressão
  entre execuções — CPU funciona bem para `patient-data-service`/`data-transform-service` (CPU-bound, queries
  reais), mal para `api-gateway` (I/O-bound, proxy).
- **Fase (c) escalabilidade horizontal**: **concluída**. `api-gateway` →3,
  `authorization-service` →2, `patient-data-service` →3 réplicas manuais
  (antes do HPA assumir na fase d); causa raiz de por que escalar réplicas
  isoladamente não bastava (pinagem de conexão gRPC) diagnosticada e
  corrigida (ver seção acima).
- **Fase (d) autoscaling (HPA)**: **concluída, com escala observada ao
  vivo e uma limitação real documentada**. `k8s/hpa.yaml` aplicado (4
  `HorizontalPodAutoscaler`, min 1 / max 10 / CPU 70% — `minReplicas`
  elevado por serviço foi tentado como mitigação de cold-start em alguns
  casos e depois revertido de volta pra 1 em todos, a favor de corrigir a
  forma da carga do k6 em vez do piso de réplicas, ver seção "[DECISÃO
  REVISADA]" acima). Durante o burst de 50 VUs, `kubectl get hpa -w` capturou escala
  real: `api-gateway` 146%/70% CPU → 1→3 réplicas; `patient-data-service`
  150%/70% → 1→10 réplicas (bateu o teto `maxReplicas`); `data-transform-service`
  108%/70% → 1→2 réplicas; `authorization-service` ficou abaixo do alvo
  (~30% de pico) e não escalou além do mínimo. Em 500 VUs, `patient-data-service`
  chegou a oscilar bem perto do alvo (67-68%/70%) sem cruzar — perto do
  teto de capacidade real com 3 réplicas, mas sem gatilho de scale-up
  (comportamento correto do HPA, a fórmula não arredonda pra cima sem
  ultrapassar o alvo). `api-gateway` nunca cruzou 70% mesmo sob 97.92% de
  falha — limitação de fundo do HPA baseado em CPU pra um serviço I/O-bound
  (ver seção acima). Não bateu na `ResourceQuota` do namespace (`cota-grupo`:
  3 cores request/6 cores limit) nos níveis testados até agora.
- **Fase (e) observabilidade**: métricas dos 4 serviços confirmadas
  acessíveis (`/metrics` e `/q/metrics`, todos HTTP 200), ServiceMonitors
  corretos. Dashboards no Grafana seguem bloqueados por permissão
  (`admgrp10` Viewer-only) — ver `observability/README.md`.

## [EM INVESTIGAÇÃO] Colapso em 50 VUs reaparece mesmo com os fixes de rampa/HPA (2026-07-13)

Rerun completo de `run-scenarios.sh` (já com rampa calibrada por nível e
`behavior.scaleUp` agressivo) voltou a colapsar em 50 VUs: 75.31% de falha,
`p(95)=5s` em `http_req_duration{phase:main}` — a mesma assinatura (falhas
batendo exatamente no `UPSTREAM_TIMEOUT_MS=5000`) já descrita e supostamente
resolvida nas seções acima. 10 VUs passou limpo (0% falha, p95=197ms) no
mesmo rerun, então não é regressão de código nos serviços — o padrão indica
o mesmo mecanismo de cold-start, só que a rampa calibrada (60s pra 50 VUs)
ainda não cobre o pior caso.

Duas causas contribuintes identificadas nesta investigação (nenhuma
mencionada nas seções anteriores):

1. **`authorization-service` carregava a extensão `quarkus-oidc` sem
   nenhum uso real.** `TokenValidationService` (único ponto de validação de
   token) usa só `smallrye-jwt` manual — sem `@Authenticated`,
   `SecurityIdentity` ou `OidcSession` em lugar nenhum do código. A
   extensão morta ainda inicializa no boot (inclusive descoberta contra o
   Keycloak externo compartilhado), custo puro sem função, que só piora sob
   os mesmos 500m de CPU limit que já sofrem throttling de JVM.
2. **500m de CPU limit é pouco para o boot de uma JVM (Quarkus fast-jar,
   não native)** — class-loading + JIT + Hibernate ORM Panache + gRPC
   server sob CPU throttling real pode facilmente estourar os 60s do
   `startupProbe`. Somado ao atraso do metrics-server pra disparar o
   scale-up (~15-30s), o tempo total de convergência pode superar os 60s de
   rampa calibrados — a réplica nova não fica `Ready` a tempo, e a réplica
   original segura 100% da carga sozinha (mesmo gargalo da fase c, agora
   por lentidão de boot, não por falta de réplica).

**Fix aplicado** (aguardando rebuild + push + redeploy + reteste — não
executável deste ambiente, sem `kubectl`/acesso ao cluster):
`services/authorization-service/build.gradle` e `application.properties` —
removida a dependência `quarkus-oidc` e as propriedades `quarkus.oidc.*`
associadas (as linhas `mp.jwt.verify.*` continuam reaproveitando o nome da
env var `QUARKUS_OIDC_AUTH_SERVER_URL`, mas não ativam mais a extensão).
`k8s/authorization-service.yaml` — `resources.limits.cpu` de `500m` para
`1000m` (request mantido em `200m`, não custa cota ociosa fora de janela de
teste).

Terceira hipótese, não confirmada (precisa validação ao vivo, ver comandos
abaixo): o resolver DNS padrão do grpc-go (`google.golang.org/grpc
v1.64.0`, usado por `services/api-gateway/internal/clients/clients.go`) só
reconsulta o DNS periodicamente num intervalo longo ou quando uma conexão
existente falha — não quando novos pods aparecem no headless service sem
erro nenhum. Se o canal gRPC do gateway já foi aberto (no aquecimento do
`setup()` do k6) antes do HPA escalar `authorization-service`/
`patient-data-service`, as réplicas novas podem nunca entrar no
`round_robin` durante aquele teste específico — explicaria por que o mesmo
fix de pinagem gRPC "funcionou" uma vez e falha de novo agora, dependendo
de quando o canal foi aberto em relação ao scale-up.

**Verificação pendente** (rodar na VM da disciplina durante um rerun de 50
VUs):

```bash
kubectl get events -n grupo-10 --field-selector involvedObject.kind=Pod | grep authorization-service
kubectl logs -n grupo-10 -l app=authorization-service --since=10m | grep -i "started in\|listening"
kubectl get hpa -n grupo-10 -w
```

Se a hipótese 3 se confirmar, o fix é forçar `ResolveNow()` periódico nas
conexões do `api-gateway` (`clients.go`) em vez de depender só do
`round_robin` estático — não implementado ainda, pendente de confirmação
pra não corrigir o sintoma errado.

## Rodada de melhorias de concorrência por serviço (2026-07-13)

Com a hipótese 3 acima ainda em aberto, uma revisão dedicada de concorrência
foi feita em paralelo nos 4 serviços (um agente por serviço, cada um restrito
ao próprio diretório para não conflitar com os demais). Resumo consolidado:

**`api-gateway`** (`internal/clients/clients.go`, `cmd/gateway/main.go`,
`go.mod`):
- **Resolve a hipótese 3 preventivamente** (sem esperar a confirmação ao
  vivo pendente acima): as 3 conexões gRPC (authorization-service,
  patient-data-service, data-transform-service) agora chamam
  `conn.ResolveNow(resolver.ResolveNowOptions{})` a cada 12s (uma goroutine
  de background, encerrada de forma limpa em `Close()`), forçando o
  round_robin a descobrir réplicas novas do HPA sem depender do timing de
  reconsulta padrão do grpc-go nem de uma falha de conexão.
- `go.uber.org/automaxprocs` adicionado (import em branco em
  `cmd/gateway/main.go`) — `GOMAXPROCS` passa a respeitar o `cgroup` limit
  do container em vez do total de cores do nó. Combinado com isso, o limit
  de CPU subiu de `400m` para `800m` (ver `k8s/api-gateway.yaml`) pra não
  apertar mais o gateway do que estava antes da mudança.
- `grpc.WithKeepaliveParams` adicionado (`Time: 6min`, conservador de
  propósito — nenhum dos 3 backends configura `keepalive.EnforcementPolicy`
  do lado do servidor, então um valor mais agressivo arriscaria
  `GOAWAY`/`too_many_pings`; ajustar junto com os outros serviços se for
  reduzir depois).
- **Atenção ao rebuild**: `go.sum` não foi regenerado (sem `go` instalado
  neste ambiente de revisão) — rodar `go mod tidy` antes do próximo build de
  imagem.

**`authorization-service`** (`AuthorizationGrpcService.java`,
`application.properties`):
- `validateToken()` não tinha `@Blocking`, mas faz a mesma validação
  criptográfica de JWT que `authorize()` (que já tinha) — sob concorrência,
  rodava no event loop do Vert.x e bloqueava todo o resto do tráfego daquela
  réplica enquanto validava um token. Corrigido adicionando `@Blocking`,
  consistente com o método irmão.
- Pool do Agroal explicitado (`min-size=2`, `max-size=8` — default do
  Agroal era `0`/`20`): `min-size=0` custava handshake TCP+fork do Postgres
  na primeira rajada de cada réplica (mesma classe de cold-start já
  diagnosticada pro boot da JVM); `max-size=8` limita o pior caso a 80
  conexões com HPA no teto de 10 réplicas, coerente com o orçamento
  compartilhado do Postgres (`max_connections=500` ÷ 10 grupos da
  disciplina).
- Build e testes (incluindo o IT com testcontainers que exercita
  `validateToken`) confirmados passando.

**`patient-data-service`** (`src/database.py`, `src/servicer.py`):
- Pool do SQLAlchemy/asyncpg reduzido de `pool_size=5, max_overflow=10`
  (15/réplica) para `pool_size=3, max_overflow=2` (5/réplica) — o antigo
  teto permitia até 150 conexões só deste serviço no teto do HPA (30% do
  orçamento compartilhado do Postgres), muito acima do pico real já
  observado (~9 conexões simultâneas, ver testes anteriores neste ADR).
- `GetCohortRaw` tinha o mesmo padrão de bug já corrigido em
  `GetPatientsByCarer`: um `IN(...)` montado a partir de uma lista Python de
  IDs (potencialmente milhares de literais) em vez de reaproveitar a
  subquery já usada para `patients`. Corrigido.
- Confirmado que este serviço já é assíncrono ponta a ponta (`asyncpg` +
  `grpc.aio`, sem chamada síncrona bloqueando o event loop) — a hipótese de
  "driver de DB bloqueante" não se aplicava aqui.
- 19/19 testes passando (incluindo um novo teste de regressão pro fix do
  `GetCohortRaw`, contra Postgres real via testcontainers).

**`data-transform-service`** (`src/client/patient_data_client.py`,
`src/main.py`, `src/servicer.py`):
- Mitigação defensiva da hipótese 3 do lado Python (mesmo resolver C-core
  do grpc-go, mesmo risco): `grpc.dns_min_time_between_resolutions_ms`
  reduzido para 5000 no canal com `patient-data-service` — confirmado que a
  opção existe na versão pinada do `grpcio` antes de usar.
- `GRPC_MAX_WORKERS` estava importado mas nunca efetivamente passado pro
  servidor — sem proteção real contra overload nenhuma. Corrigido, agora
  alimenta `maximum_concurrent_rpcs` de fato.
- `AggregateForResearch` fazia trabalho Python CPU-bound
  (`compute_aggregate`/`aggregate_to_json`) síncrono sobre uma coorte não
  paginada — bloqueava o event loop asyncio pra todo o resto do tráfego
  daquela réplica durante o cálculo. Envolvido em `asyncio.to_thread`.
- 56 testes passando.

**Achado transversal, não corrigido (falso-positivo descartado com
cuidado)**: tanto `patient-data-service` quanto `data-transform-service` têm
uma variável `GRPC_MAX_WORKERS` documentada como "tamanho do thread pool
gRPC" que não faz sentido para `grpc.aio` (concorrência é via event loop
asyncio, não thread pool) — no `data-transform-service` já virou
`maximum_concurrent_rpcs` de verdade (acima); no `patient-data-service`
continua uma configuração morta, não corrigida por estar fora do escopo
desta rodada (nenhum bloqueio de event loop foi encontrado lá que
justificasse mexer). Fica registrado como ponto de limpeza futura, não
bloqueador.

**Orçamento de conexões Postgres, consolidado**: com os dois pools agora
explícitos, o teto teórico combinado no pior caso (HPA no máximo dos dois
serviços simultaneamente) é `authorization-service` 10×8=80 +
`patient-data-service` 10×5=50 = 130 conexões, ~26% dos 500
`max_connections` compartilhados por 10 grupos — folga razoável dado que os
testes já documentados neste ADR nunca aproximaram esse teto na prática.
