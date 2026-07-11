-- Schema mínimo consumido pelo Authorization Service.
-- As tabelas patients / encounters / clinical_events pertencem ao escopo do
-- patient-data-service e não são criadas aqui.
--
-- Nomes de coluna e valores de enum aqui replicam EXATAMENTE o schema real
-- do banco pseudopep_gXX do cluster K8S da disciplina (confirmado via psql
-- ao vivo contra o Postgres do grupo10) — não é um schema inventado. Local
-- (hu_db) e cluster usam a mesma estrutura para que o código não precise de
-- dois caminhos diferentes. Ver docs/decisions/0006-schema-adaptation.md.

CREATE TABLE IF NOT EXISTS user_patient_assignments (
    assignment_id        VARCHAR(20)  PRIMARY KEY,
    username              VARCHAR(80)  NOT NULL,
    patient_id            VARCHAR(20)  NOT NULL,
    assignment_type       VARCHAR(20)  NOT NULL CHECK (assignment_type IN ('ATTENDING', 'TRAINEE')),
    -- username do médico supervisor, aplicável quando assignment_type = 'TRAINEE'.
    supervisor_username   VARCHAR(80),
    active                 BOOLEAN      NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_assign_username ON user_patient_assignments (username);
CREATE INDEX IF NOT EXISTS idx_assign_user_patient ON user_patient_assignments (username, patient_id);

CREATE TABLE IF NOT EXISTS projects (
    project_id             VARCHAR(20)  PRIMARY KEY,
    title                   VARCHAR(200) NOT NULL,
    researcher_username     VARCHAR(80)  NOT NULL,
    target_condition_code   VARCHAR(40)  NOT NULL,
    status                  VARCHAR(40)  NOT NULL CHECK (status IN ('APPROVED', 'EXPIRED', 'SUSPENDED', 'PENDING', 'REJECTED')),
    valid_until             DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_researcher ON projects (researcher_username);
CREATE INDEX IF NOT EXISTS idx_projects_condition ON projects (target_condition_code);

-- Seed mínimo para teste manual (docker compose up -d) — usernames batem
-- com os usuários de teste do realm "hu" local (scripts/setup-keycloak.sh).
INSERT INTO user_patient_assignments (assignment_id, username, patient_id, assignment_type, supervisor_username, active) VALUES
    ('A0000000001', 'dr.silva',       'P000001', 'ATTENDING', NULL,        true),
    ('A0000000002', 'dr.silva',       'P000002', 'ATTENDING', NULL,        false),
    ('A0000000003', 'estagiario.ana', 'P000001', 'TRAINEE',   'dr.silva',  true)
ON CONFLICT DO NOTHING;

INSERT INTO projects (project_id, title, researcher_username, target_condition_code, status, valid_until) VALUES
    ('PRJ01', 'Fatores de risco em Diabetes Tipo 2',  'pesquisador.souza', 'DIABETES',     'APPROVED',  '2026-12-31'),
    ('PRJ02', 'Hipertensão em idosos',                 'pesquisador.souza', 'HYPERTENSION', 'SUSPENDED', '2026-12-31'),
    ('PRJ03', 'Diabetes Tipo 2 — coorte histórica',     'pesquisador.lima',  'DIABETES',     'APPROVED',  '2024-12-31')
ON CONFLICT DO NOTHING;
