# ADR 0001 — Authorization Service: decisões técnicas

**Autor:** Felipe

---

## Contexto

O enunciado especificava Authorization Service em Java/Quarkus com Keycloak/OAuth2/OIDC, mas não definia build tool, forma de validação do JWT nem como extrair o papel do usuário. O ambiente de desenvolvimento não tinha Maven instalado.

## Decisões

### 1. Build tool: Gradle em vez de Maven

O ambiente de desenvolvimento não tinha Maven instalado nem rede liberada para instalá-lo. Gradle já estava disponível e o Quarkus tem suporte de primeira classe para os dois. Nenhuma regra de negócio depende da escolha.

### 2. Validação do JWT via `quarkus-smallrye-jwt`

O JWT chega dentro do corpo da mensagem gRPC (`jwt_token`), não no header HTTP `Authorization`. A validação automática do `quarkus-oidc` intercepta requisições HTTP, não mensagens gRPC — por isso foi usada a API programática `JWTParser` do `quarkus-smallrye-jwt`.

### 3. Papel extraído de `realm_access.roles`

O Keycloak publica os papéis de realm no claim `realm_access.roles`. Quando o token carrega mais de um papel, a prioridade é: médico > estagiário > pesquisador.

### 4. `resource_id` do pesquisador = `project_id`

O proto genérico usa `resource_id` tanto para `PATIENT` (id do paciente) quanto para `RESEARCH_PROJECT` (id do projeto). Para pesquisadores, o campo carrega o `project_id`, que é validado na tabela `projects`.

### 5. Migrations criadas do zero

A pasta `db/migrations/` não existia no repositório. Foi criada com as 2 tabelas que o serviço lê: `user_patient_assignments` e `projects`.

## Consequências

- Gradle Wrapper incluído no repositório — qualquer desenvolvedor pode rodar `./gradlew` sem instalar nada além do JDK 21.
- A validação do JWT é feita manualmente no servicer gRPC, o que exige atenção ao renovar a chave pública do Keycloak.
- O campo `resource_id` tem semântica dupla dependendo do `resource_type` — documentado no proto e no README.
