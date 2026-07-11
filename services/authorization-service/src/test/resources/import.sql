INSERT INTO user_patient_assignments (assignment_id, username, patient_id, assignment_type, active) VALUES
    ('A0000000001', 'dr.silva', 'P000001', 'ATTENDING', true),
    ('A0000000002', 'dr.silva', 'P000002', 'ATTENDING', false),
    ('A0000000003', 'estagiario.ana', 'P000001', 'TRAINEE', true);

INSERT INTO projects (project_id, title, researcher_username, target_condition_code, status, valid_until) VALUES
    ('PRJ01', 'Fatores de risco em Diabetes Tipo 2', 'pesquisador.souza', 'DIABETES', 'APPROVED', '2026-12-31'),
    ('PRJ02', 'Hipertensão em idosos', 'pesquisador.souza', 'HYPERTENSION', 'SUSPENDED', '2026-12-31'),
    ('PRJ03', 'Diabetes Tipo 2 — coorte histórica', 'pesquisador.lima', 'DIABETES', 'APPROVED', '2024-12-31');
