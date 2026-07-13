-- GetPatientsByCarer (services/patient-data-service/src/servicer.py) filtra
-- por (username, assignment_type, active) em toda chamada de
-- GET /me/patients — o endpoint mais quente do teste de carga (ver
-- docs/decisions/0005). Os índices existentes (idx_assign_username,
-- idx_assign_user_patient) não cobrem assignment_type/active: para usuários
-- com dezenas de milhares de vínculos, a query varria/filtrava todas as
-- linhas daquele username em vez de ir direto às que batem. Sob concorrência
-- isso satura o Postgres compartilhado do cluster (CPU do servidor, não dos
-- pods) e explica a queda em lockstep de todas as queries no dashboard
-- "Duração das consultas ao banco" — não é esgotamento do pool de conexões
-- (já descartado em 0005), é o próprio Postgres gastando CPU filtrando
-- linhas fora do índice.
CREATE INDEX IF NOT EXISTS idx_assign_username_type_active
    ON user_patient_assignments (username, assignment_type, active, patient_id);
