-- Tabelas clínicas do Patient Data Service.
-- Depende de 001_authorization_schema.sql (user_patient_assignments, projects).

CREATE TABLE IF NOT EXISTS patients (
    patient_id  VARCHAR(50)  PRIMARY KEY,
    full_name   VARCHAR(200) NOT NULL,
    birth_date  DATE         NOT NULL,
    gender      VARCHAR(10)  NOT NULL CHECK (gender IN ('male', 'female', 'other')),
    city        VARCHAR(100),
    state       VARCHAR(50),
    cpf         VARCHAR(14),
    cns         VARCHAR(20)
);

CREATE INDEX IF NOT EXISTS idx_patients_cpf ON patients (cpf);

CREATE TABLE IF NOT EXISTS encounters (
    encounter_id VARCHAR(50)  PRIMARY KEY,
    patient_id   VARCHAR(50)  NOT NULL REFERENCES patients(patient_id),
    start_date   TIMESTAMPTZ  NOT NULL,
    end_date     TIMESTAMPTZ,
    type         VARCHAR(50)  NOT NULL,   -- Ambulatorial, Emergência, Internação, Retorno
    department   VARCHAR(100)             -- Cardiologia, Endocrinologia, Pediatria...
);

CREATE INDEX IF NOT EXISTS idx_encounters_patient ON encounters (patient_id, start_date DESC);

CREATE TABLE IF NOT EXISTS clinical_events (
    event_id     VARCHAR(50)   PRIMARY KEY,
    patient_id   VARCHAR(50)   NOT NULL REFERENCES patients(patient_id),
    encounter_id VARCHAR(50)   REFERENCES encounters(encounter_id),
    event_type   VARCHAR(20)   NOT NULL CHECK (event_type IN ('Condição', 'Observação', 'Medicação')),
    event_code   VARCHAR(100)  NOT NULL,  -- diabetes_tipo_2, HbA1c, Losartana...
    description  VARCHAR(500),
    event_date   TIMESTAMPTZ   NOT NULL,
    value        DECIMAL(12,4),
    unit         VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_events_patient      ON clinical_events (patient_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_code_type    ON clinical_events (event_code, event_type);

-- ============================================================
-- Seed de teste (10 pacientes + atendimentos + eventos clínicos)
-- Inclui pacientes com vínculo nos user_patient_assignments do 001.
-- ============================================================

INSERT INTO patients (patient_id, full_name, birth_date, gender, city, state, cpf, cns) VALUES
    ('P000001', 'João da Silva',        '1970-05-10', 'male',   'Brasília',     'DF', '111.222.333-44', '700001234567890'),
    ('P000002', 'Maria Oliveira',       '1985-11-22', 'female', 'Brasília',     'DF', '222.333.444-55', '700002345678901'),
    ('P000003', 'Carlos Ferreira',      '1960-03-15', 'male',   'Goiânia',      'GO', '333.444.555-66', '700003456789012'),
    ('P000004', 'Ana Beatriz Santos',   '1992-07-08', 'female', 'Brasília',     'DF', '444.555.666-77', '700004567890123'),
    ('P000005', 'Pedro Alves',          '1955-12-01', 'male',   'Samambaia',    'DF', '555.666.777-88', '700005678901234'),
    ('P000006', 'Luiza Costa',          '1978-09-30', 'female', 'Taguatinga',   'DF', '666.777.888-99', '700006789012345'),
    ('P000007', 'Roberto Mendes',       '1948-01-20', 'male',   'Ceilândia',    'DF', '777.888.999-00', '700007890123456'),
    ('P000008', 'Fernanda Nunes',       '1995-04-17', 'female', 'Planaltina',   'DF', '888.999.000-11', '700008901234567'),
    ('P000009', 'Marcos Souza',         '1963-08-25', 'male',   'Águas Claras', 'DF', '999.000.111-22', '700009012345678'),
    ('P000010', 'Patrícia Lima',        '1980-02-14', 'female', 'Brasília',     'DF', '000.111.222-33', '700000123456789')
ON CONFLICT DO NOTHING;

-- Atendimentos
INSERT INTO encounters (encounter_id, patient_id, start_date, end_date, type, department) VALUES
    ('ENC001', 'P000001', '2025-01-10 08:00:00-03', '2025-01-10 09:30:00-03', 'Ambulatorial', 'Endocrinologia'),
    ('ENC002', 'P000001', '2024-07-15 14:00:00-03', '2024-07-15 15:00:00-03', 'Retorno',       'Endocrinologia'),
    ('ENC003', 'P000002', '2025-02-20 10:00:00-03', '2025-02-20 11:00:00-03', 'Ambulatorial', 'Cardiologia'),
    ('ENC004', 'P000003', '2025-03-05 09:00:00-03', '2025-03-06 12:00:00-03', 'Internação',    'Cardiologia'),
    ('ENC005', 'P000004', '2025-04-12 08:30:00-03', '2025-04-12 10:00:00-03', 'Ambulatorial', 'Pediatria'),
    ('ENC006', 'P000005', '2025-01-22 13:00:00-03', '2025-01-22 14:00:00-03', 'Retorno',       'Endocrinologia'),
    ('ENC007', 'P000006', '2025-05-03 11:00:00-03', '2025-05-03 12:30:00-03', 'Ambulatorial', 'Endocrinologia'),
    ('ENC008', 'P000007', '2025-06-18 08:00:00-03', '2025-06-19 08:00:00-03', 'Emergência',    'Cardiologia'),
    ('ENC009', 'P000008', '2025-07-01 09:00:00-03', '2025-07-01 10:00:00-03', 'Ambulatorial', 'Ginecologia'),
    ('ENC010', 'P000009', '2025-02-28 10:00:00-03', '2025-02-28 11:30:00-03', 'Retorno',       'Endocrinologia'),
    ('ENC011', 'P000010', '2025-03-15 14:00:00-03', '2025-03-15 15:00:00-03', 'Ambulatorial', 'Cardiologia')
ON CONFLICT DO NOTHING;

-- Condições clínicas
INSERT INTO clinical_events (event_id, patient_id, encounter_id, event_type, event_code, description, event_date, value, unit) VALUES
    ('CE001', 'P000001', 'ENC001', 'Condição',   'diabetes_tipo_2',   'Diabetes Mellitus Tipo 2',           '2023-01-10 08:00:00-03', NULL,  NULL),
    ('CE002', 'P000001', 'ENC002', 'Condição',   'hipertensao',        'Hipertensão Arterial Sistêmica',    '2024-07-15 14:00:00-03', NULL,  NULL),
    ('CE003', 'P000003', 'ENC004', 'Condição',   'hipertensao',        'Hipertensão Arterial Sistêmica',    '2025-03-05 09:00:00-03', NULL,  NULL),
    ('CE004', 'P000005', 'ENC006', 'Condição',   'diabetes_tipo_2',   'Diabetes Mellitus Tipo 2',           '2022-06-01 10:00:00-03', NULL,  NULL),
    ('CE005', 'P000006', 'ENC007', 'Condição',   'diabetes_tipo_2',   'Diabetes Mellitus Tipo 2',           '2024-11-03 11:00:00-03', NULL,  NULL),
    ('CE006', 'P000007', 'ENC008', 'Condição',   'hipertensao',        'Hipertensão Arterial Sistêmica',    '2025-06-18 08:00:00-03', NULL,  NULL),
    ('CE007', 'P000009', 'ENC010', 'Condição',   'diabetes_tipo_2',   'Diabetes Mellitus Tipo 2',           '2021-09-10 10:00:00-03', NULL,  NULL),
    ('CE008', 'P000010', 'ENC011', 'Condição',   'hipertensao',        'Hipertensão Arterial Sistêmica',    '2025-03-15 14:00:00-03', NULL,  NULL),
    -- Observações / exames laboratoriais
    ('CE009', 'P000001', 'ENC001', 'Observação', 'HbA1c',             'Hemoglobina Glicada',               '2025-01-10 08:30:00-03', 8.1,   '%'),
    ('CE010', 'P000001', 'ENC001', 'Observação', 'glicemia_jejum',    'Glicemia em Jejum',                 '2025-01-10 08:30:00-03', 182.0, 'mg/dL'),
    ('CE011', 'P000001', 'ENC001', 'Observação', 'pressao_arterial',  'Pressão Arterial Sistólica',        '2025-01-10 08:30:00-03', 150.0, 'mmHg'),
    ('CE012', 'P000003', 'ENC004', 'Observação', 'pressao_arterial',  'Pressão Arterial Sistólica',        '2025-03-05 09:30:00-03', 165.0, 'mmHg'),
    ('CE013', 'P000005', 'ENC006', 'Observação', 'HbA1c',             'Hemoglobina Glicada',               '2025-01-22 13:30:00-03', 7.4,   '%'),
    ('CE014', 'P000005', 'ENC006', 'Observação', 'glicemia_jejum',    'Glicemia em Jejum',                 '2025-01-22 13:30:00-03', 155.0, 'mg/dL'),
    ('CE015', 'P000006', 'ENC007', 'Observação', 'HbA1c',             'Hemoglobina Glicada',               '2025-05-03 11:30:00-03', 9.2,   '%'),
    ('CE016', 'P000009', 'ENC010', 'Observação', 'HbA1c',             'Hemoglobina Glicada',               '2025-02-28 10:30:00-03', 7.8,   '%'),
    ('CE017', 'P000007', 'ENC008', 'Observação', 'pressao_arterial',  'Pressão Arterial Sistólica',        '2025-06-18 08:30:00-03', 180.0, 'mmHg'),
    -- Medicações
    ('CE018', 'P000001', 'ENC001', 'Medicação',  'Metformina_850mg',  'Metformina 850 mg',                 '2025-01-10 08:00:00-03', 850.0, 'mg'),
    ('CE019', 'P000001', 'ENC002', 'Medicação',  'Losartana_50mg',    'Losartana 50 mg',                   '2024-07-15 14:00:00-03', 50.0,  'mg'),
    ('CE020', 'P000003', 'ENC004', 'Medicação',  'Losartana_50mg',    'Losartana 50 mg',                   '2025-03-05 09:00:00-03', 50.0,  'mg'),
    ('CE021', 'P000005', 'ENC006', 'Medicação',  'Metformina_850mg',  'Metformina 850 mg',                 '2025-01-22 13:00:00-03', 850.0, 'mg'),
    ('CE022', 'P000006', 'ENC007', 'Medicação',  'Insulina_NPH',      'Insulina NPH',                      '2025-05-03 11:00:00-03', 20.0,  'UI'),
    ('CE023', 'P000007', 'ENC008', 'Medicação',  'Atenolol_50mg',     'Atenolol 50 mg',                    '2025-06-18 08:00:00-03', 50.0,  'mg'),
    ('CE024', 'P000009', 'ENC010', 'Medicação',  'Metformina_850mg',  'Metformina 850 mg',                 '2025-02-28 10:00:00-03', 850.0, 'mg'),
    ('CE025', 'P000010', 'ENC011', 'Medicação',  'Losartana_50mg',    'Losartana 50 mg',                   '2025-03-15 14:00:00-03', 50.0,  'mg')
ON CONFLICT DO NOTHING;
