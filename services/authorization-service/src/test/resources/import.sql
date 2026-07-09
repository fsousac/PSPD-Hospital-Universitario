INSERT INTO user_patient_assignments (username, patient_id, tipo_vinculo, status, created_at) VALUES
    ('dr.silva', 'P000001', 'medico', 'ativo', now()),
    ('dr.silva', 'P000002', 'medico', 'inativo', now()),
    ('estagiario.ana', 'P000001', 'estagiario', 'ativo', now());

INSERT INTO projects (project_id, username, clinical_condition, status, valid_from, valid_until, created_at) VALUES
    ('PRJ01', 'pesquisador.souza', 'diabetes_tipo_2', 'Aprovado', '2026-01-01', '2026-12-31', now()),
    ('PRJ02', 'pesquisador.souza', 'hipertensao', 'Suspenso', '2026-01-01', '2026-12-31', now()),
    ('PRJ03', 'pesquisador.lima', 'diabetes_tipo_2', 'Aprovado', '2024-01-01', '2024-12-31', now());
