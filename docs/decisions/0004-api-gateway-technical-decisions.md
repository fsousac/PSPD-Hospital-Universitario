# ADR 0004 — API Gateway: decisões técnicas

**Autor:** Eric

---

## Contexto

O enunciado especificava um API Gateway responsável por receber requisições
REST, validar tokens JWT, encaminhar aos microsserviços e consolidar respostas,
mas deixava a stack em aberto (README da pasta sugeria Nginx+Lua, Kong, Envoy,
Traefik ou um gateway dedicado). Os três serviços internos já expunham contratos
gRPC (`proto/`): Authorization (Quarkus, gRPC na porta HTTP 8080), Patient Data
(50052) e Data Transform (50053). O frontend (React) fala REST/JSON.

O foco de avaliação do projeto é **desempenho e observabilidade sob carga**
(testes com 10–1000 usuários, escalabilidade horizontal, HPA). O gateway é o
único ponto de entrada — logo, o gargalo de toda requisição.

## Decisões

### 1. Gateway próprio em Go, em vez de gateway pronto (Kong/Nginx/Envoy)

A lógica exigida não é roteamento puro: para cada requisição o gateway precisa
chamar o Authorization Service, obter o `access_level`, escolher o serviço de
destino e consolidar a resposta (padrão *Backend-for-Frontend*). Isso é lógica
de negócio, custosa de implementar em Lua/plugins. Um gateway próprio dá controle
total. Go foi escolhido por: concorrência nativa (goroutines) para aguentar a
carga dos testes, gRPC de primeira classe (grpc-go), binário estático pequeno
(imagem distroless ~15 MB → pod sobe rápido, bom para demonstrar HPA) e cliente
Prometheus oficial. Também adiciona Go ao stack poliglota (Java + Python×2 + Go).

### 2. Tradução REST ↔ gRPC no gateway

O frontend não fala gRPC. O gateway expõe REST/JSON para fora e consome os
serviços internos via gRPC, atuando como tradutor de protocolo além de
orquestrador.

### 3. Validação do JWT na borda (go-oidc) + decisão no Authorization Service

Dupla camada: (i) o gateway valida assinatura/expiração/emissor do JWT contra o
JWKS do Keycloak (`go-oidc`) em toda requisição e extrai `preferred_username` +
`realm_access.roles` — barato e necessário para roteamento; (ii) o
Authorization Service aplica as regras de negócio (ALLOW/DENY + nível de acesso)
consultando os vínculos no banco, chamado só nas rotas de recurso clínico. Evita
duplicar a lógica de autorização e mantém o gateway leve.

### 4. Roteador chi + net/http padrão

`chi` é um roteador idiomático e sem dependências pesadas, compatível com
`net/http`. Fornece middlewares (RequestID, Recoverer) e o padrão de rota
(`/api/v1/patients/{id}`) usado como label das métricas, evitando explosão de
cardinalidade por IDs.

### 5. Rate limiting via token bucket global (`golang.org/x/time/rate`)

Sob carga alta, o gateway devolve HTTP 429 em vez de repassar toda a pressão ao
backend. Configurável por env (`RATE_LIMIT_RPS`/`RATE_LIMIT_BURST`). Nos testes
de carga pode ser afrouxado para medir o limite real do backend.

### 6. Comunicação gRPC interna em plaintext (h2c)

As conexões aos serviços internos usam credenciais `insecure` — a rede é interna
ao cluster/compose e o TLS de borda fica no ingress do K8S. O Authorization
Service compartilha gRPC e HTTP na mesma porta 8080
(`quarkus.grpc.server.use-separate-server=false`), então o dial é direto nela.

### 7. Stubs gRPC gerados, não versionados

Os `*.pb.go` são gerados a partir de `proto/` (na raiz) por
`scripts/generate_protos.*` e pelo Dockerfile, com `--go_opt=module=` +
mapeamentos `M<arquivo>=<pacote>`. Assim os protos compartilhados não são
alterados (não têm `option go_package`) e ficam em `internal/pb/{authpb,
patientpb,transformpb}/`. `authorization.proto` e `data_transform.proto` definem
ambos o enum `AccessLevel`, resolvido por ficarem em pacotes Go distintos; a
conversão entre eles é um cast direto (mesmos valores inteiros).

## Consequências

- Requer `protoc` + Go 1.22 para desenvolvimento local; o Dockerfile encapsula
  ambos para o build.
- `go mod tidy` deve ser rodado após a primeira geração dos stubs (as imports de
  `internal/pb/*` só existem após a geração).
- O gateway depende do Keycloak estar acessível na inicialização para a
  descoberta OIDC — há retry (10 tentativas) para tolerar ordem de boot.
- A conversão de `AccessLevel` entre pacotes por cast pressupõe que os enums nos
  dois protos mantenham os mesmos valores; se divergirem, trocar por um switch.
