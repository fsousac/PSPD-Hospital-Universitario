-- Schema mínimo consumido pelo Authorization Service.
-- As tabelas patients / encounters / clinical_events pertencem ao escopo do
-- patient-data-service (stack ainda "a definir") e não são criadas aqui.

CREATE TABLE IF NOT EXISTS user_patient_assignments (
    id                 BIGSERIAL PRIMARY KEY,
    username           VARCHAR(100) NOT NULL,
    patient_id         VARCHAR(50)  NOT NULL,
    tipo_vinculo       VARCHAR(20)  NOT NULL CHECK (tipo_vinculo IN ('medico', 'estagiario')),
    -- username do médico supervisor, aplicável quando tipo_vinculo = 'estagiario'
    -- (coluna do domínio, ver especificação; não usada na decisão de autorização em si).
    usuario_supervisor VARCHAR(100),
    status             VARCHAR(20)  NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upa_username_patient
    ON user_patient_assignments (username, patient_id, tipo_vinculo, status);

CREATE TABLE IF NOT EXISTS projects (
    id                 BIGSERIAL PRIMARY KEY,
    project_id         VARCHAR(50)  NOT NULL UNIQUE,
    titulo             VARCHAR(200) NOT NULL,
    username           VARCHAR(100) NOT NULL,
    clinical_condition VARCHAR(150) NOT NULL,
    status             VARCHAR(20)  NOT NULL CHECK (status IN ('Aprovado', 'Expirado', 'Suspenso', 'Pendente', 'Reprovado')),
    valid_from         DATE NOT NULL,
    valid_until        DATE NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_username_condition
    ON projects (username, clinical_condition, status);

-- Seed mínimo para teste manual (docker compose up -d).
INSERT INTO user_patient_assignments (username, patient_id, tipo_vinculo, usuario_supervisor, status) VALUES
    ('dr.silva',       'P000001', 'medico',     NULL,        'ativo'),
    ('dr.silva',       'P000002', 'medico',     NULL,        'inativo'),
    ('estagiario.ana', 'P000001', 'estagiario', 'dr.silva',  'ativo');

INSERT INTO projects (project_id, titulo, username, clinical_condition, status, valid_from, valid_until) VALUES
    ('PRJ01', 'Fatores de risco em Diabetes Tipo 2',  'pesquisador.souza', 'diabetes_tipo_2', 'Aprovado', '2026-01-01', '2026-12-31'),
    ('PRJ02', 'Hipertensão em idosos',                 'pesquisador.souza', 'hipertensao',      'Suspenso', '2026-01-01', '2026-12-31'),
    ('PRJ03', 'Diabetes Tipo 2 — coorte histórica',     'pesquisador.lima',  'diabetes_tipo_2',  'Aprovado', '2024-01-01', '2024-12-31');
