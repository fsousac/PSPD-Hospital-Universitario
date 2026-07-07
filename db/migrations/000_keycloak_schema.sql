-- O Keycloak (KC_DB_SCHEMA=keycloak no docker-compose.yml) espera que o
-- schema já exista antes de rodar suas próprias migrations Liquibase — ele
-- não cria o schema sozinho. Sem isso, o container encerra com erro:
-- "ERROR: schema \"keycloak\" does not exist".
CREATE SCHEMA IF NOT EXISTS keycloak;
