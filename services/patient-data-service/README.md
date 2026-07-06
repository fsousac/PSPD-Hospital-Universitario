# patient-data-service

**Stack: a definir pelo grupo**  
**Banco de dados: PostgreSQL** (definido)

Responsabilidade: executa consultas SQL sobre as 5 tabelas do domínio clínico
e retorna dados brutos ao Data Transform Service. Não aplica anonimização —
isso é responsabilidade do Data Transform Service.

## Tabelas (schema em `db/migrations/`)

- `patients` — dados demográficos do paciente
- `encounters` — internações / consultas
- `clinical_events` — eventos clínicos (diagnósticos, procedimentos, sinais vitais)
- `user_patient_assignments` — vínculo entre profissional e paciente
- `projects` — projetos de pesquisa com lista de pacientes autorizados

## Níveis de acesso recebidos

O serviço recebe o `access_level` do Authorization Service (via header ou campo gRPC)
e retorna apenas os campos permitidos:

- `FULL` — todos os campos
- `PARTIAL` — campos clínicos sem identificadores pessoais diretos
- `ANONYMIZED` — sem campos identificadores (CPF, nome, data de nascimento exata)
- `AGGREGATED` — apenas contagens / estatísticas, sem registros individuais

## Decisão de stack

Registrar ADR em `docs/decisions/` antes de criar qualquer arquivo de projeto aqui.
