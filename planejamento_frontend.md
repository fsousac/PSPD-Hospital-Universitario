# Planejamento Frontend - HU Observability

## 1. Resumo do plano

A estrategia recomendada e implementar o frontend como uma SPA React em JavaScript com Vite, evoluindo em trilhas independentes: primeiro a fundacao visual, roteamento, autenticacao e mocks; depois a substituicao gradual dos mocks pela API Gateway REST real.

O caminho critico e:

1. Registrar a ADR do frontend e os contratos REST propostos.
2. Criar o scaffold React + Vite em `frontend/`.
3. Configurar Keycloak para SPA com Authorization Code Flow + PKCE.
4. Criar wrapper centralizado de `fetch`, MSW e modelos de dados mockados.
5. Implementar os fluxos de medico/estagiario e pesquisador com mocks.
6. Integrar com a API Gateway quando os endpoints REST existirem.
7. Empacotar com Docker/Nginx, integrar ao Compose, Kubernetes e observabilidade.

O frontend nao deve chamar gRPC diretamente, aplicar autorizacao real, anonimizar dados clinicos, armazenar JWT em `localStorage`, nem registrar tokens ou dados clinicos sensiveis em logs.

## 2. Premissas confirmadas

- O frontend ainda nao esta implementado. A pasta `frontend/` contem apenas `frontend/README.md`.
- O `frontend/README.md` define que toda chamada de dados deve passar pelo API Gateway e que uma ADR deve ser registrada antes da criacao do projeto.
- A API Gateway ainda nao esta implementada. `services/api-gateway/README.md` contem apenas documentacao e rotas esperadas.
- O `docker-compose.yml` tem `TODO` para `api-gateway` e `frontend`.
- O Authorization Service existe em Java/Quarkus, expoe gRPC e valida JWT/roles via Keycloak.
- O Patient Data Service existe em Python/gRPC e expoe RPCs para pacientes, atendimentos, eventos clinicos, coorte bruta e resumo clinico.
- O Data Transform Service existe em Python/gRPC e expoe RPCs para FHIR e agregacao de pesquisa.
- Os contratos gRPC estao em `proto/authorization.proto`, `proto/patient_data.proto` e `proto/data_transform.proto`.
- O Keycloak local usa realm `hu`, roles `medico`, `estagiario` e `pesquisador`, conforme `scripts/setup-keycloak.sh`.
- O client Keycloak criado atualmente e `authorization-service`; client publico especifico para frontend ainda nao foi confirmado.
- `k8s/` contem apenas `.gitkeep`.
- `observability/dashboards/` contem apenas `.gitkeep`.
- O estado Git estava limpo antes da criacao deste documento.

## 3. Pendencias nao confirmadas

- Contrato REST real da API Gateway: nao confirmado.
- Formato final das respostas REST: nao confirmado.
- Stack da API Gateway: nao confirmado.
- Client Keycloak publico para SPA: nao confirmado.
- Redirect URIs, Web Origins e CORS definitivos: nao confirmado.
- URLs finais por ambiente para frontend, Keycloak e API Gateway: nao confirmado.
- Estrategia final de Ingress/TLS no Kubernetes: nao confirmado.
- Prometheus scrape config para frontend/Nginx: nao confirmado.
- Ferramenta E2E final, como Playwright: nao confirmado.

## 4. Fases de execucao

### Fase 0 - Decisoes e contratos

Objetivo: registrar decisoes, delimitar contratos provisorios e permitir desenvolvimento com mocks sem depender da API Gateway pronta.

| ID | Prioridade | Tarefa | Arquivos | Dependencias | Criterio de aceite | Testes | Riscos |
|---|---|---|---|---|---|---|---|
| FE-001 | P0 - bloqueante | Criar ADR do frontend com React, JavaScript, Vite, React Router, keycloak-js, Material UI, Recharts, fetch, Vitest, RTL e MSW | `docs/decisions/0004-frontend-technical-decisions.md` | Analise atual do repo | ADR criada com decisao objetiva e limites de escopo | Revisao manual | Criar decisao desalinhada com equipe |
| FE-002 | P0 - bloqueante | Definir contratos REST propostos para mocks, marcando como provisiorios | `docs/frontend-api-contracts.md` ou secao na ADR | `proto/*.proto`, `services/api-gateway/README.md` | Endpoints propostos documentados sem afirmar que existem | Revisao manual contra protos | Frontend acoplar a contrato que mudara |
| FE-003 | P1 - essencial | Mapear perfis e niveis de acesso para exibicao visual | ADR/contratos | `proto/authorization.proto` | `medico`, `estagiario`, `pesquisador`, `FULL`, `PARTIAL`, `ANONYMIZED`, `AGGREGATED` documentados | Revisao manual | Confundir controle visual com autorizacao real |
| FE-004 | P1 - essencial | Definir estrategia de mocks com MSW e fixtures por perfil | ADR/contratos | Contratos REST propostos | Casos FULL/PARTIAL/ANONYMIZED/AGGREGATED definidos | Revisao manual | Mocks divergirem dos dados reais |
| FE-005 | P1 - essencial | Definir variaveis de ambiente do frontend | ADR/contratos | Keycloak e Gateway propostos | Lista minima: API base URL, Keycloak URL, realm, client id, modo mock | Revisao manual | Embutir URL fixa em codigo |

Contratos REST propostos, nao confirmados pela API Gateway:

- `GET /api/me`
- `GET /api/patients`
- `GET /api/patients/{patientId}`
- `GET /api/patients/{patientId}/summary`
- `GET /api/patients/{patientId}/encounters`
- `GET /api/patients/{patientId}/events?type=...`
- `GET /api/patients/{patientId}/fhir`
- `GET /api/research/projects`
- `GET /api/research/projects/{projectId}`
- `GET /api/research/projects/{projectId}/aggregate`
- `GET /api/research/projects/{projectId}/cohort`

### Fase 1 - Fundacao do frontend

Objetivo: criar a base executavel da SPA sem integrar ainda com backend real.

| ID | Prioridade | Tarefa | Arquivos | Dependencias | Criterio de aceite | Testes | Riscos |
|---|---|---|---|---|---|---|---|
| FE-006 | P0 - bloqueante | Criar scaffold React + JavaScript + Vite | `frontend/package.json`, `frontend/index.html`, `frontend/src/main.jsx`, `frontend/src/App.jsx`, `frontend/vite.config.js` | FE-001 | App inicia localmente com pagina minima | `npm run build` quando deps existirem | Criar TS por engano |
| FE-007 | P1 - essencial | Configurar scripts de dev, build, preview e test | `frontend/package.json` | FE-006 | Scripts padronizados | `npm run build`, `npm test` | Scripts inconsistentes com CI futuro |
| FE-008 | P1 - essencial | Instalar/configurar Material UI e baseline visual | `frontend/src/theme/`, `frontend/src/main.jsx` | FE-006 | Tema base aplicado | Teste de render basico | Visual excessivamente complexo |
| FE-009 | P1 - essencial | Configurar React Router | `frontend/src/routes/`, `frontend/src/App.jsx` | FE-006 | Rotas principais registradas | Testes de roteamento | Rotas protegidas antes da auth ficar pronta |
| FE-010 | P1 - essencial | Criar estrutura de pastas simples | `frontend/src/api`, `auth`, `components`, `layouts`, `pages`, `routes`, `utils`, `mocks` | FE-006 | Pastas criadas com responsabilidades claras | Revisao manual | Arquitetura pesada demais |
| FE-011 | P1 - essencial | Criar configuracao de ambiente | `frontend/.env.example`, `frontend/src/config/env.js` | FE-005 | Variaveis lidas centralmente | Teste unitario de config | URLs fixas espalhadas |
| FE-012 | P1 - essencial | Criar layout principal com menu lateral e topo | `frontend/src/layouts/AppLayout.jsx` | FE-008, FE-009 | Menu, topo e area de conteudo renderizam | Teste de componente | Menu depender de roles ainda ausentes |
| FE-013 | P1 - essencial | Criar paginas `Forbidden` e `NotFound` | `frontend/src/pages/Forbidden.jsx`, `NotFound.jsx` | FE-009 | `/forbidden` e fallback 404 funcionam | Teste de rota | UX pobre para erros |
| FE-014 | P1 - essencial | Criar componentes comuns de loading, erro e vazio | `frontend/src/components/LoadingState.jsx`, `ErrorState.jsx`, `EmptyState.jsx` | FE-008 | Componentes reutilizaveis disponiveis | Testes de render | Mensagens vazarem dados sensiveis |
| FE-015 | P2 - importante | Configurar Vitest, RTL e jest-dom | `frontend/vitest.config.js` ou `vite.config.js`, `frontend/src/setupTests.js` | FE-006 | Primeiro teste passa | `npm test` | Config ESM inconsistente |

### Fase 2 - Autenticacao

Objetivo: integrar Keycloak corretamente no frontend e preparar rotas protegidas.

| ID | Prioridade | Tarefa | Arquivos | Dependencias | Criterio de aceite | Testes | Riscos |
|---|---|---|---|---|---|---|---|
| FE-016 | P0 - bloqueante | Definir alteracao necessaria no Keycloak para client SPA publico | `scripts/setup-keycloak.sh`, ADR | FE-001 | Client proposto `hu-frontend` documentado com PKCE, redirect e web origins | Revisao manual | Alterar Keycloak de modo inseguro |
| FE-017 | P1 - essencial | Implementar configuracao `keycloak-js` no frontend | `frontend/src/auth/keycloak.js` | FE-011, FE-016 | Instancia criada por env vars | Teste com mock de keycloak | Config quebrar em Docker |
| FE-018 | P1 - essencial | Criar `AuthProvider` | `frontend/src/auth/AuthProvider.jsx` | FE-017 | Estado de auth, usuario, roles e token em memoria | Testes com mock | Token ir para localStorage |
| FE-019 | P1 - essencial | Implementar login, logout e renovacao de token | `frontend/src/auth/AuthProvider.jsx`, layout | FE-018 | Login/logout expostos na UI; `updateToken` usado | Testes de comportamento mockado | Loop de login |
| FE-020 | P1 - essencial | Criar `ProtectedRoute` | `frontend/src/auth/ProtectedRoute.jsx`, `frontend/src/routes` | FE-018 | Rotas exigem autenticacao | Teste de rota protegida | Bloquear pagina 403/404 sem necessidade |
| FE-021 | P1 - essencial | Controlar menus visualmente por perfil | `frontend/src/layouts/AppLayout.jsx`, `frontend/src/auth/roles.js` | FE-018 | Medico/estagiario/pesquisador veem menus corretos | Testes por role | Tratar isso como autorizacao real |
| FE-022 | P1 - essencial | Tratar `401` com renovacao ou logout seguro | `frontend/src/auth`, `frontend/src/api` | FE-019, FE-028 | 401 nao gera vazamento de token e encaminha fluxo correto | Testes de API mockada | Perder estado do usuario de forma confusa |

Alteracoes frontend: `keycloak-js`, provider, rotas protegidas, token em memoria, renovacao.

Alteracoes necessarias em `scripts/setup-keycloak.sh`: adicionar client publico de SPA, redirect URIs, web origins e PKCE. Essa tarefa deve ser feita em etapa propria, pois altera infraestrutura de auth.

### Fase 3 - Camada de integracao

Objetivo: criar uma camada de API substituivel, com mocks fortes ate a API Gateway ficar pronta.

| ID | Prioridade | Tarefa | Arquivos | Dependencias | Criterio de aceite | Testes | Riscos |
|---|---|---|---|---|---|---|---|
| FE-023 | P1 - essencial | Criar wrapper centralizado de `fetch` | `frontend/src/api/client.js` | FE-011 | Base URL, JSON e headers centralizados | Teste unitario | Repetir chamadas diretas espalhadas |
| FE-024 | P1 - essencial | Adicionar Bearer Token via callback do AuthProvider | `frontend/src/api/client.js`, `frontend/src/auth` | FE-018, FE-023 | `Authorization: Bearer` enviado quando autenticado | Teste com mock | Logar token em erro |
| FE-025 | P1 - essencial | Gerar e propagar `X-Correlation-ID` | `frontend/src/api/correlation.js`, `client.js` | FE-023 | Cada request recebe correlation id | Teste unitario | Usar identificador pessoal como correlation id |
| FE-026 | P1 - essencial | Normalizar erros HTTP | `frontend/src/api/errors.js`, `client.js` | FE-023 | 401/403/404/500 viram erro padrao | Testes por status | Mostrar mensagens internas ao usuario |
| FE-027 | P2 - importante | Implementar timeout e cancelamento com `AbortController` | `frontend/src/api/client.js` | FE-023 | Requests longas sao abortaveis | Teste unitario | Cancelar requests validas cedo demais |
| FE-028 | P1 - essencial | Criar servicos por dominio | `frontend/src/api/patients.js`, `research.js`, `me.js` | FE-023 | Paginas nao chamam `fetch` diretamente | Testes com mock | Modelos divergirem da API real |
| FE-029 | P1 - essencial | Configurar MSW | `frontend/src/mocks/browser.js`, `handlers.js`, `fixtures/` | FE-002, FE-004 | App roda com dados mockados | Testes usando MSW | Mocks virarem fonte de verdade |
| FE-030 | P1 - essencial | Criar fixtures por perfil e nivel de acesso | `frontend/src/mocks/fixtures/` | FE-004 | FULL, PARTIAL, ANONYMIZED e AGGREGATED cobertos | Testes de privacidade | Incluir CPF/CNS em caso pesquisador |

### Fase 4 - Medico e estagiario

Objetivo: implementar fluxo clinico com dados FULL e PARTIAL usando mocks.

| ID | Prioridade | Tarefa | Arquivos | Dependencias | Criterio de aceite | Testes | Riscos |
|---|---|---|---|---|---|---|---|
| FE-031 | P1 - essencial | Criar dashboard comum | `frontend/src/pages/Dashboard.jsx` | FE-012, FE-018 | Usuario ve perfil e atalhos permitidos | Teste por role | Exibir dados sensiveis no dashboard |
| FE-032 | P1 - essencial | Criar pagina de lista de pacientes | `frontend/src/pages/Patients.jsx` | FE-028, FE-029 | Lista pacientes mockados por medico/estagiario | Teste com MSW | Assumir endpoint real inexistente |
| FE-033 | P2 - importante | Adicionar busca e filtros simples | `Patients.jsx`, componentes | FE-032 | Busca local ou via query mockada funciona | Teste de interacao | Filtro incompatível com API real |
| FE-034 | P1 - essencial | Criar pagina de detalhes do paciente | `frontend/src/pages/PatientDetails.jsx` | FE-032 | Dados basicos renderizam | Teste de loading/error/empty | Campo ausente quebrar render |
| FE-035 | P1 - essencial | Implementar abas clinicas | `PatientDetails.jsx`, `components/PatientTabs.jsx` | FE-034 | Abas de resumo, atendimentos, diagnosticos, exames, medicamentos e FHIR | Teste de navegacao por aba | Tela ficar grande demais |
| FE-036 | P1 - essencial | Implementar resumo clinico | `PatientSummary.jsx` | FE-028, FE-035 | Resumo mostra dados FULL/PARTIAL corretamente | Testes FULL/PARTIAL | Exibir CPF/CNS para estagiario |
| FE-037 | P1 - essencial | Implementar atendimentos | `EncountersTab.jsx` | FE-028, FE-035 | Lista atendimentos | Testes de vazio/erro | Datas mal formatadas |
| FE-038 | P1 - essencial | Implementar eventos clinicos por tipo | `ClinicalEventsTab.jsx` | FE-028, FE-035 | Diagnosticos, exames e medicamentos separados | Testes por tipo | Misturar tipos FHIR/labels |
| FE-039 | P1 - essencial | Implementar visualizacao FHIR JSON | `FhirJsonTab.jsx` | FE-028, FE-035 | JSON formatado, copiavel opcionalmente, sem log | Teste de render | Expor identificadores em PARTIAL por erro de mock |
| FE-040 | P1 - essencial | Mostrar aviso de acesso parcial para estagiario | `PatientDetails.jsx`, componentes | FE-018, FE-030 | Aviso visivel quando `accessLevel=PARTIAL` | Teste por role | Aviso substituir autorizacao real |

### Fase 5 - Pesquisador

Objetivo: implementar fluxo de pesquisa com dados ANONYMIZED e AGGREGATED.

| ID | Prioridade | Tarefa | Arquivos | Dependencias | Criterio de aceite | Testes | Riscos |
|---|---|---|---|---|---|---|---|
| FE-041 | P1 - essencial | Criar lista de projetos de pesquisa | `frontend/src/pages/ResearchProjects.jsx` | FE-028, FE-029 | Projetos mockados aparecem com status e validade | Teste com MSW | Nao ha RPC atual de listagem de projetos |
| FE-042 | P1 - essencial | Criar detalhes do projeto | `ResearchProjectDetails.jsx` | FE-041 | Mostra titulo, status, validade e condicao | Testes aprovado/expirado/suspenso | Permitir acao em projeto invalido |
| FE-043 | P1 - essencial | Criar cards de agregados | `ResearchAggregate.jsx` | FE-028, FE-042 | Total, genero, idade, medicamentos | Testes AGGREGATED | Mostrar registros individuais em agregado |
| FE-044 | P1 - essencial | Criar graficos com Recharts | `ResearchCharts.jsx` | FE-043 | Graficos renderizam dados agregados | Teste de labels/dados | Graficos ilegíveis |
| FE-045 | P1 - essencial | Criar tabela de coorte pseudonimizada | `ResearchCohortTable.jsx` | FE-028, FE-042 | IDs pseudonimizados sem nome/CPF/CNS/cidade | Teste de ausencia de identificadores | Expor identificadores reais |
| FE-046 | P1 - essencial | Tratar estados aprovado, expirado e suspenso | `ResearchProjectDetails.jsx` | FE-042 | Projeto invalido mostra bloqueio visual | Teste por status | Divergir da regra real do backend |
| FE-047 | P1 - essencial | Criar testes de privacidade do pesquisador | `*.test.jsx` | FE-045 | Testes falham se CPF/CNS/nome real aparecer | Vitest/RTL | Fixtures conterem dados sensiveis por descuido |

### Fase 6 - Integracao com a API Gateway

Objetivo: substituir mocks por endpoints reais de forma incremental.

| ID | Prioridade | Tarefa | Arquivos | Dependencias | Criterio de aceite | Testes | Riscos |
|---|---|---|---|---|---|---|---|
| FE-048 | P0 - bloqueante | Validar quais endpoints REST foram implementados na API Gateway | `services/api-gateway/`, contratos | API Gateway pronta | Matriz endpoint x tela atualizada | Teste manual/API | Presumir endpoint inexistente |
| FE-049 | P1 - essencial | Criar adaptadores de resposta REST para modelos do frontend | `frontend/src/api/adapters/` | FE-048 | Frontend tolera formato real | Testes unitarios | Mudanca de contrato quebrar UI |
| FE-050 | P1 - essencial | Desabilitar MSW em ambiente real | `frontend/src/mocks`, config | FE-029, FE-048 | Mocks so em dev/test quando configurado | Teste de config | Usar mock em producao |
| FE-051 | P1 - essencial | Integrar endpoints de pacientes | `frontend/src/api/patients.js` | FE-048 | Fluxo medico/estagiario usa API real | Teste integrado/manual | API retornar PARTIAL diferente do mock |
| FE-052 | P1 - essencial | Integrar endpoints de FHIR | `patients.js`, `FhirJsonTab.jsx` | FE-048 | FHIR real renderiza | Teste integrado/manual | JSON payload vir como string ou objeto |
| FE-053 | P1 - essencial | Integrar endpoints de pesquisa | `frontend/src/api/research.js` | FE-048 | Projetos/agregados/coorte usam API real | Teste integrado/manual | Listagem de projetos nao existir |
| FE-054 | P1 - essencial | Validar fluxos por perfil com Keycloak real | Frontend + Keycloak + API Gateway | FE-051 a FE-053 | Medico, estagiario, pesquisador funcionam | Teste manual/E2E | Config OIDC/CORS quebrada |

Dependem de implementacao da API Gateway: FE-048 a FE-054.

### Fase 7 - Docker e Docker Compose

Objetivo: empacotar a SPA e executar localmente no Compose com Keycloak e API Gateway.

| ID | Prioridade | Tarefa | Arquivos | Dependencias | Criterio de aceite | Testes | Riscos |
|---|---|---|---|---|---|---|---|
| FE-055 | P1 - essencial | Criar build de producao validavel | `frontend/package.json`, Vite | FE-006 a FE-015 | `npm run build` gera `dist/` | Build | Build quebrar por env ausente |
| FE-056 | P1 - essencial | Criar Dockerfile multi-stage | `frontend/Dockerfile` | FE-055 | Imagem serve SPA | Build Docker | Imagem grande/desnecessaria |
| FE-057 | P1 - essencial | Criar Nginx com fallback SPA | `frontend/nginx.conf` | FE-056 | Reload em rotas internas funciona | Teste manual/curl | 404 em refresh de rota |
| FE-058 | P1 - essencial | Criar health endpoint simples | `nginx.conf` | FE-057 | `/health` retorna 200 sem auth | curl | Health expor dados |
| FE-059 | P1 - essencial | Implementar configuracao runtime | `frontend/public/config.js` ou entrypoint | FE-011, FE-056 | URLs variam sem rebuild quando possivel | Teste container | Config cacheada pelo navegador |
| FE-060 | P1 - essencial | Integrar frontend ao `docker-compose.yml` | `docker-compose.yml` | FE-056, API Gateway compose | `docker compose up` inclui frontend | Smoke test | Ordem de subida/CORS |

### Fase 8 - Kubernetes

Objetivo: criar manifests para executar o frontend no cluster.

| ID | Prioridade | Tarefa | Arquivos | Dependencias | Criterio de aceite | Testes | Riscos |
|---|---|---|---|---|---|---|---|
| FE-061 | P1 - essencial | Criar ConfigMap de runtime | `k8s/frontend-configmap.yaml` | FE-059 | URLs por ambiente configuradas | `kubectl apply --dry-run` | URL errada no cluster |
| FE-062 | P1 - essencial | Criar Deployment | `k8s/frontend-deployment.yaml` | FE-056, FE-061 | Pod sobe com imagem configurada | `kubectl rollout status` | Imagem nao acessivel pelo cluster |
| FE-063 | P1 - essencial | Criar Service | `k8s/frontend-service.yaml` | FE-062 | Service aponta para pod | `kubectl get svc` | Porta errada |
| FE-064 | P1 - essencial | Criar Ingress | `k8s/frontend-ingress.yaml` | FE-063, Ingress controller | URL externa abre SPA | Teste browser/curl | TLS/host nao definidos |
| FE-065 | P1 - essencial | Configurar readiness/liveness probes | Deployment | FE-058, FE-062 | Probes usam `/health` | `kubectl describe pod` | Probe agressiva reiniciar pod |
| FE-066 | P2 - importante | Definir requests e limits | Deployment | FE-062 | Recursos definidos | Revisao/kubectl | Limites baixos causarem instabilidade |
| FE-067 | P3 - melhoria ou ponto extra | Criar HPA | `k8s/frontend-hpa.yaml` | Metrics Server | HPA criado | `kubectl get hpa` | HPA sem metricas |

### Fase 9 - Observabilidade

Objetivo: contribuir com disponibilidade, rastreabilidade e diagnostico sem vazar dados sensiveis.

| ID | Prioridade | Tarefa | Arquivos | Dependencias | Criterio de aceite | Testes | Riscos |
|---|---|---|---|---|---|---|---|
| FE-068 | P1 - essencial | Definir politica de logs seguros | ADR/docs | FE-001 | Proibicao explicita de token/dados clinicos em logs | Revisao manual | Vazamento acidental |
| FE-069 | P1 - essencial | Propagar `X-Correlation-ID` ate API Gateway | `frontend/src/api/client.js` | FE-025, API Gateway | Header aparece nas requisicoes | Teste integrado | API Gateway ignorar header |
| FE-070 | P2 - importante | Monitorar disponibilidade do frontend | K8s/Prometheus docs | FE-058, FE-062 | Health e pod monitoraveis | Prometheus/manual | Scrape nao configurado |
| FE-071 | P2 - importante | Avaliar metricas Nginx | `frontend/nginx.conf`, observability docs | FE-057 | Decisao: exporter ou apenas pod/Ingress | Revisao manual | Complexidade desnecessaria |
| FE-072 | P2 - importante | Registrar erros JS sem dados clinicos | Frontend/docs | FE-068 | Handler global sanitizado ou decisao documentada | Teste manual | Capturar payload clinico |
| FE-073 | P3 - melhoria ou ponto extra | Criar dashboard Grafana do frontend | `observability/dashboards/` | FE-070 | Dashboard com uptime/status | Revisao Grafana | Escopo extra demais |

### Fase 10 - Validacao final

Objetivo: validar entrega, reduzir risco de regressao e preparar demonstracao.

| ID | Prioridade | Tarefa | Arquivos | Dependencias | Criterio de aceite | Testes | Riscos |
|---|---|---|---|---|---|---|---|
| FE-074 | P1 - essencial | Rodar suite unit/componentes | `frontend/src/**/*.test.jsx` | FE-015 | Testes passam | `npm test` | Cobertura insuficiente |
| FE-075 | P1 - essencial | Validar build | `frontend/` | FE-055 | Build passa | `npm run build` | Env quebrada em CI |
| FE-076 | P1 - essencial | Validar tres perfis | Frontend + Keycloak/API | FE-054 | Medico, estagiario e pesquisador acessam telas corretas | Manual/E2E | Dados seed diferentes |
| FE-077 | P1 - essencial | Validar quatro niveis de acesso | Frontend + API | FE-054 | FULL, PARTIAL, ANONYMIZED, AGGREGATED exibidos corretamente | Manual/E2E | Backend nao expor todos via REST |
| FE-078 | P1 - essencial | Validar Docker Compose | `docker-compose.yml` | FE-060 | Stack local acessivel | `docker compose up --build` | Portas/CORS |
| FE-079 | P1 - essencial | Validar Kubernetes | `k8s/` | FE-061 a FE-067 | SPA acessivel via Ingress | kubectl/browser | Cluster sem Ingress/TLS |
| FE-080 | P1 - essencial | Atualizar documentacao de execucao | `frontend/README.md`, `README.md` | FE-078, FE-079 | Passo a passo reproduzivel | Revisao manual | Docs ficarem desatualizadas |
| FE-081 | P2 - importante | Criar roteiro de demonstracao/video | `docs/demo-frontend.md` | FE-076 a FE-080 | Roteiro cobre perfis e fluxos | Ensaio manual | Roteiro depender de dado instavel |

## 5. Dependencias externas

API Gateway:

- Precisa definir stack, endpoints REST, CORS, validacao JWT, mapeamento REST -> gRPC e formatos de erro.
- Precisa expor rotas para pacientes, FHIR, pesquisa e usuario atual.
- Precisa aplicar autorizacao real e niveis de acesso; o frontend apenas reflete o resultado.

Keycloak:

- Precisa de client publico para SPA, preferencialmente `hu-frontend`.
- Precisa usar Authorization Code Flow com PKCE.
- Precisa configurar redirect URIs e web origins para dev, Docker Compose e Kubernetes.
- JWT deve ficar em memoria via `keycloak-js`, sem `localStorage`.

Contratos REST:

- Provisorios ate a API Gateway implementar.
- Devem ser versionados/documentados antes de substituir MSW por API real.
- Devem padronizar erro: status HTTP, codigo, mensagem segura e correlation id.

Docker Compose:

- Precisa incluir API Gateway antes do frontend real.
- Frontend precisa saber URL publica do Keycloak e URL da API Gateway.

Kubernetes:

- Precisa de imagem publicada/acessivel pelo cluster.
- Precisa de ConfigMap, Deployment, Service, Ingress e probes.
- HPA depende de Metrics Server e metricas adequadas.

Prometheus e Grafana:

- Backend ja expoe metricas em servicos internos.
- Frontend pode contribuir com health, metricas de pod/Ingress/Nginx e correlation id.
- Dashboards ainda nao existem.

## 6. Execucao paralela

Trilha do frontend, pode avancar sem API Gateway:

- FE-001 a FE-005: ADR, contratos propostos, mocks.
- FE-006 a FE-015: scaffold, layout, rotas, componentes comuns.
- FE-017 a FE-021: auth frontend com mocks/testes, exceto validacao real completa.
- FE-023 a FE-030: wrapper fetch, MSW, fixtures.
- FE-031 a FE-047: telas de medico, estagiario e pesquisador com mocks.
- FE-055 a FE-059: Dockerfile/Nginx podem avancar antes da API real, usando config mock/dev.

Trilha da API Gateway:

- Definir contratos REST finais.
- Implementar endpoints REST.
- Integrar com Authorization Service, Patient Data Service e Data Transform Service via gRPC.
- Implementar CORS, Bearer token, erros padronizados e correlation id.

Ponto de integracao:

- FE-048: validar endpoints reais.
- FE-049: adaptar respostas.
- FE-050: desligar MSW em runtime real.
- FE-051 a FE-054: trocar chamadas mockadas por API real e validar por perfil.

Dependencias claras:

- Telas podem usar MSW antes da API Gateway.
- Validacao real de 401/403 depende de Keycloak + API Gateway.
- Docker Compose final depende de API Gateway no Compose.
- Kubernetes final depende de imagem e URLs de ambiente.

## 7. Caminho critico

1. FE-001 - ADR do frontend.
2. FE-002 - contratos REST propostos.
3. FE-006 - scaffold Vite React JS.
4. FE-011 - ambiente/config.
5. FE-017 a FE-020 - Keycloak e rotas protegidas.
6. FE-023 a FE-030 - camada API + MSW.
7. FE-031 a FE-040 - medico/estagiario com mocks.
8. FE-041 a FE-047 - pesquisador com mocks.
9. FE-048 a FE-054 - API Gateway real.
10. FE-055 a FE-060 - Docker/Compose.
11. FE-061 a FE-067 - Kubernetes.
12. FE-074 a FE-081 - validacao final e documentacao.

## 8. Marcos do projeto

| Marco | Criterios objetivos de conclusao |
|---|---|
| Frontend inicial executando | Vite roda, `npm run build` passa, layout base abre sem backend |
| Autenticacao funcionando | Login/logout via Keycloak, token em memoria, rotas protegidas e roles disponiveis |
| Fluxo medico/estagiario com mocks | Lista de pacientes, detalhes, abas clinicas, FHIR JSON e aviso PARTIAL funcionando com MSW |
| Fluxo pesquisador com mocks | Projetos, status, validade, agregados, graficos e coorte pseudonimizada funcionando |
| Integracao com API Gateway | MSW desabilitado em ambiente real, endpoints REST validados, tres perfis funcionando |
| Execucao via Docker Compose | Frontend servido por Nginx, health 200, Keycloak/API Gateway acessiveis |
| Execucao no Kubernetes | Deployment, Service, Ingress, ConfigMap e probes funcionando no cluster |
| Entrega final validada | Testes passam, build passa, Compose e Kubernetes validados, docs e roteiro prontos |

## 9. Estrategia de testes

Fase 0:

- Revisao manual dos contratos propostos contra `proto/*.proto`.
- Checagem de que endpoints estejam marcados como propostos, nao existentes.

Fase 1:

- Teste de render do `App`.
- Testes de rotas 403/404.
- Testes de loading, erro e vazio.
- Build Vite.

Fase 2:

- Mock de `keycloak-js`.
- Testes de `AuthProvider`.
- Testes de `ProtectedRoute`.
- Testes de exibicao de menus por role.
- Testes de ausencia de uso de `localStorage` para token.

Fase 3:

- Testes unitarios do wrapper de `fetch`.
- Testes de Bearer header sem logar token.
- Testes de 401, 403, 404, 500.
- Testes de timeout e abort.
- Testes MSW para endpoints mockados.

Fase 4:

- Testes de lista de pacientes.
- Testes de estado vazio/erro/loading.
- Testes de detalhes e abas.
- Testes FULL e PARTIAL.
- Testes garantindo que estagiario nao ve CPF/CNS.

Fase 5:

- Testes de projetos aprovado/expirado/suspenso.
- Testes de graficos com dados agregados.
- Testes de coorte pseudonimizada.
- Testes garantindo ausencia de nome real, CPF, CNS e cidade para pesquisador.

Fase 6:

- Testes integrados contra API Gateway em ambiente local.
- Validacao manual por perfil.
- Testes de incompatibilidade de contrato.

Fase 7:

- `npm run build`.
- Build da imagem Docker.
- Smoke test com Nginx e `/health`.
- Teste de refresh em rota interna.

Fase 8:

- `kubectl apply --dry-run`.
- Rollout status.
- Testes de readiness/liveness.
- Acesso via Ingress.

Fase 9:

- Verificar correlation id nas requisicoes.
- Revisar logs para ausencia de token/dados clinicos.
- Validar metricas disponiveis no cluster.

Fase 10:

- Suite completa.
- Fluxos manuais dos tres perfis.
- Validacao dos quatro niveis de acesso.
- Roteiro de demonstracao.

## 10. Riscos e mitigacao

| Risco | Impacto | Mitigacao |
|---|---|---|
| Atraso da API Gateway | Frontend nao integra com backend real | Desenvolver com MSW, contratos propostos e adaptadores |
| Mudanca dos contratos REST | Retrabalho em telas | Centralizar API em `src/api` e usar adaptadores |
| Problemas de Keycloak | Login bloqueado | Separar auth em provider, documentar client SPA e testar com mock |
| Dados mockados diferentes dos reais | Bugs na integracao | Criar fixtures derivadas dos protos e validar na Fase 6 |
| Exposicao acidental de dados clinicos | Falha grave de privacidade | Testes de ausencia de CPF/CNS/nome real nos fluxos PARTIAL/ANONYMIZED |
| JWT em armazenamento inseguro | Falha de seguranca | Usar `keycloak-js` em memoria e teste/checagem contra `localStorage` |
| Falhas no Kubernetes | Entrega operacional comprometida | Criar manifests pequenos, probes simples e validar incrementalmente |
| Excesso de escopo | Atraso | Priorizar P0/P1; deixar HPA, dashboards e roteiro refinado como P2/P3 quando necessario |
| CORS/URLs por ambiente | App funciona local mas falha em Docker/K8s | Config runtime centralizada e validacao por ambiente |

## 11. Ordem recomendada de execucao

1. FE-001
2. FE-002
3. FE-003
4. FE-004
5. FE-005
6. FE-006
7. FE-007
8. FE-015
9. FE-008
10. FE-009
11. FE-010
12. FE-011
13. FE-012
14. FE-013
15. FE-014
16. FE-016
17. FE-017
18. FE-018
19. FE-019
20. FE-020
21. FE-021
22. FE-023
23. FE-024
24. FE-025
25. FE-026
26. FE-027
27. FE-028
28. FE-029
29. FE-030
30. FE-031
31. FE-032
32. FE-033
33. FE-034
34. FE-035
35. FE-036
36. FE-037
37. FE-038
38. FE-039
39. FE-040
40. FE-041
41. FE-042
42. FE-043
43. FE-044
44. FE-045
45. FE-046
46. FE-047
47. FE-048
48. FE-049
49. FE-050
50. FE-051
51. FE-052
52. FE-053
53. FE-054
54. FE-055
55. FE-056
56. FE-057
57. FE-058
58. FE-059
59. FE-060
60. FE-061
61. FE-062
62. FE-063
63. FE-064
64. FE-065
65. FE-066
66. FE-067
67. FE-068
68. FE-069
69. FE-070
70. FE-071
71. FE-072
72. FE-073
73. FE-074
74. FE-075
75. FE-076
76. FE-077
77. FE-078
78. FE-079
79. FE-080
80. FE-081

Tarefas do caminho critico: FE-001, FE-002, FE-006, FE-011, FE-017, FE-018, FE-020, FE-023, FE-029, FE-032, FE-034, FE-041, FE-048, FE-051, FE-053, FE-055, FE-056, FE-060, FE-062, FE-064, FE-074, FE-075.

Tarefas que podem ser adiadas: FE-027, FE-033, FE-067, FE-071, FE-072, FE-073, FE-081.

Funcionalidades minimas para primeira demonstracao:

- Login/logout ou auth mockada claramente sinalizada.
- Layout com menu.
- Lista e detalhes de pacientes com mocks.
- Aviso de acesso parcial para estagiario.
- Lista de projetos e grafico agregado com mocks.
- 403/404 e estados loading/erro/vazio.

Funcionalidades necessarias para entrega final:

- Keycloak real.
- API Gateway real.
- Fluxos dos tres perfis.
- Quatro niveis de acesso refletidos corretamente.
- Testes unitarios/componentes/integracao essenciais.
- Docker Compose.
- Kubernetes.
- Documentacao de execucao.

Funcionalidades extras que podem contribuir para a nota:

- HPA.
- Dashboard Grafana do frontend.
- Tratamento global de erros JavaScript sanitizado.
- Roteiro de demonstracao bem documentado.
- Testes E2E automatizados.

## 12. Primeira tarefa

Tarefa recomendada: FE-001 - Criar ADR do frontend.

Objetivo:

- Registrar oficialmente a decisao de stack e os limites arquiteturais do frontend antes de criar o projeto dentro de `frontend/`.

Arquivos que serao criados ou alterados:

- Criar `docs/decisions/0004-frontend-technical-decisions.md`.
- Opcionalmente nao alterar mais nada nesta primeira tarefa.

Comandos previstos:

```bash
sed -n '1,180p' frontend/README.md
sed -n '1,180p' services/api-gateway/README.md
sed -n '1,220p' proto/authorization.proto
sed -n '1,240p' proto/patient_data.proto
sed -n '1,220p' proto/data_transform.proto
```

Criterio de conclusao:

- ADR criada citando React, JavaScript, Vite, React Router, `keycloak-js`, Material UI, Recharts, `fetch`, Vitest, React Testing Library e MSW.
- ADR explicita que o frontend chama somente a API Gateway.
- ADR explicita que contratos REST ainda sao propostos, nao confirmados.
- ADR explicita que JWT nao deve ser salvo em `localStorage`.
- ADR explicita que autorizacao real, anonimização e agregacao pertencem ao backend.

Testes que deverao ser executados:

- Nenhum teste automatizado nesta primeira tarefa.
- Validacao manual do conteudo da ADR contra `frontend/README.md`, `services/api-gateway/README.md` e `proto/*.proto`.

