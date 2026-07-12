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
- **[pendente, ação externa]** client Keycloak `hu-frontend` (público, SPA)
  referenciado em `VITE_KEYCLOAK_CLIENT_ID` — nada no repo confirma que esse
  client existe no realm `grupo10` com `redirect_uri` correto pra
  `https://kiriland.unb.br/grupo10/*`. Precisa checar/criar no Keycloak.
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

## Execução das fases (atualizado 2026-07-11, sessão de verificação ao vivo)

- **Fase (a) validação funcional**: pods rodando e saudáveis, mas validação
  completa dos 3 perfis (MEDICO/ESTAGIARIO/PESQUISADOR) **bloqueada** pelo
  item acima — sem JWT de aplicação não dá pra exercitar as regras de
  autorização fim-a-fim contra o cluster real.
- **Fase (b) testes de carga (k6)**: **bloqueada** pelo mesmo motivo — o
  script de load test depende de um token de aplicação válido para chamar
  os endpoints protegidos.
- **Fase (c) escalabilidade horizontal**: **executada**. `kubectl scale
  deployment api-gateway authorization-service data-transform-service
  patient-data-service --replicas=3` — os 12 pods (3 por serviço) subiram
  `1/1 Running`, um por nó em cada um dos 4 nós do cluster
  (`k8s-master`, `k8s-worker-1/2/3`), confirmando distribuição uniforme do
  scheduler. Sem carga real (bloqueio do item b), não há dado de ganho de
  throughput para essa fase ainda — só a distribuição de pods está
  documentada.
- **Fase (d) autoscaling (HPA)**: `k8s/hpa.yaml` aplicado (4
  `HorizontalPodAutoscaler`, min 1 / max 10 / CPU 70%). Métricas reais
  confirmadas (`cpu: 1-2%/70%`) — bem abaixo do alvo, então o HPA reduz as 3
  réplicas manuais de volta para 1 (comportamento esperado e correto do
  HPA, não um bug). Falta ainda gerar carga real (bloqueada pelo item b)
  para observar o HPA escalando *para cima*.
- **Fase (e) observabilidade**: métricas dos 4 serviços confirmadas
  acessíveis (`/metrics` e `/q/metrics`, todos HTTP 200), ServiceMonitors
  corretos. Dashboards no Grafana seguem bloqueados por permissão
  (`admgrp10` Viewer-only) — ver `observability/README.md`.
