# frontend

**Stack: a definir pelo grupo**

Responsabilidade: interface web para profissionais de saúde e pesquisadores
acessarem prontuários eletrônicos. Autenticação delegada ao Keycloak via
OIDC (redirect flow). Toda chamada de dados passa pelo API Gateway.

## Funcionalidades esperadas

- Login/logout via Keycloak
- Listagem e busca de pacientes (conforme permissão do perfil)
- Visualização de prontuário (FULL / PARTIAL / ANONYMIZED conforme `access_level` retornado pelo Authorization Service)
- Painel de pesquisa com dados agregados (perfil pesquisador)

## Decisão de stack

Registrar ADR em `docs/decisions/` antes de criar qualquer arquivo de projeto aqui.
