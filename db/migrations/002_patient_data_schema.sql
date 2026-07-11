-- Tabelas clínicas do Patient Data Service.
-- Depende de 001_authorization_schema.sql (user_patient_assignments, projects).
--
-- Nomes de coluna e valores de enum replicam o schema real do cluster K8S
-- (ver nota em 001_authorization_schema.sql).

CREATE TABLE IF NOT EXISTS patients (
    patient_id  VARCHAR(20)  PRIMARY KEY,
    full_name   VARCHAR(120) NOT NULL,
    birth_date  DATE         NOT NULL,
    gender      VARCHAR(20)  NOT NULL CHECK (gender IN ('male', 'female')),
    city        VARCHAR(80)  NOT NULL,
    state       CHAR(2)      NOT NULL,
    cpf         VARCHAR(14)  NOT NULL,
    cns         VARCHAR(20)  NOT NULL,
    UNIQUE (cpf),
    UNIQUE (cns)
);

CREATE TABLE IF NOT EXISTS encounters (
    encounter_id    VARCHAR(20)  PRIMARY KEY,
    patient_id      VARCHAR(20)  NOT NULL REFERENCES patients(patient_id),
    start_date      TIMESTAMP    NOT NULL,
    end_date        TIMESTAMP,
    encounter_type  VARCHAR(40)  NOT NULL CHECK (encounter_type IN
                        ('AMBULATORIAL', 'EMERGENCY', 'INPATIENT', 'ICU', 'FOLLOW_UP', 'TELEHEALTH')),
    department      VARCHAR(80)  NOT NULL CHECK (department IN
                        ('CARDIOLOGY', 'ENDOCRINOLOGY', 'NEPHROLOGY', 'PULMONOLOGY', 'INTERNAL_MEDICINE',
                         'EMERGENCY', 'ICU', 'PEDIATRICS', 'GERIATRICS', 'INFECTIOUS_DISEASES', 'SURGERY',
                         'OBSTETRICS', 'ORTHOPEDICS', 'ONCOLOGY', 'TELEMEDICINE'))
);

CREATE INDEX IF NOT EXISTS idx_encounters_patient ON encounters (patient_id);

CREATE TABLE IF NOT EXISTS clinical_events (
    event_id      VARCHAR(20)   PRIMARY KEY,
    patient_id    VARCHAR(20)   NOT NULL REFERENCES patients(patient_id),
    encounter_id  VARCHAR(20)   NOT NULL REFERENCES encounters(encounter_id),
    event_type    VARCHAR(30)   NOT NULL CHECK (event_type IN ('CONDITION', 'OBSERVATION', 'MEDICATION')),
    code          VARCHAR(40)   NOT NULL,  -- DIABETES, HBA1C, METFORMIN...
    description   VARCHAR(200)  NOT NULL,
    value         VARCHAR(80),             -- texto livre (numérico ou qualitativo)
    unit          VARCHAR(40),
    event_date    TIMESTAMP     NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_patient      ON clinical_events (patient_id);
CREATE INDEX IF NOT EXISTS idx_events_encounter    ON clinical_events (encounter_id);
CREATE INDEX IF NOT EXISTS idx_events_patient_type ON clinical_events (patient_id, event_type);
CREATE INDEX IF NOT EXISTS idx_events_type_code    ON clinical_events (event_type, code);

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
INSERT INTO encounters (encounter_id, patient_id, start_date, end_date, encounter_type, department) VALUES
    ('ENC001', 'P000001', '2025-01-10 08:00:00', '2025-01-10 09:30:00', 'AMBULATORIAL', 'ENDOCRINOLOGY'),
    ('ENC002', 'P000001', '2024-07-15 14:00:00', '2024-07-15 15:00:00', 'FOLLOW_UP',    'ENDOCRINOLOGY'),
    ('ENC003', 'P000002', '2025-02-20 10:00:00', '2025-02-20 11:00:00', 'AMBULATORIAL', 'CARDIOLOGY'),
    ('ENC004', 'P000003', '2025-03-05 09:00:00', '2025-03-06 12:00:00', 'INPATIENT',    'CARDIOLOGY'),
    ('ENC005', 'P000004', '2025-04-12 08:30:00', '2025-04-12 10:00:00', 'AMBULATORIAL', 'PEDIATRICS'),
    ('ENC006', 'P000005', '2025-01-22 13:00:00', '2025-01-22 14:00:00', 'FOLLOW_UP',    'ENDOCRINOLOGY'),
    ('ENC007', 'P000006', '2025-05-03 11:00:00', '2025-05-03 12:30:00', 'AMBULATORIAL', 'ENDOCRINOLOGY'),
    ('ENC008', 'P000007', '2025-06-18 08:00:00', '2025-06-19 08:00:00', 'EMERGENCY',    'CARDIOLOGY'),
    ('ENC009', 'P000008', '2025-07-01 09:00:00', '2025-07-01 10:00:00', 'AMBULATORIAL', 'OBSTETRICS'),
    ('ENC010', 'P000009', '2025-02-28 10:00:00', '2025-02-28 11:30:00', 'FOLLOW_UP',    'ENDOCRINOLOGY'),
    ('ENC011', 'P000010', '2025-03-15 14:00:00', '2025-03-15 15:00:00', 'AMBULATORIAL', 'CARDIOLOGY')
ON CONFLICT DO NOTHING;

-- Condições clínicas
INSERT INTO clinical_events (event_id, patient_id, encounter_id, event_type, code, description, event_date, value, unit) VALUES
    ('CE001', 'P000001', 'ENC001', 'CONDITION', 'DIABETES',     'Diabetes Mellitus Tipo 2',        '2023-01-10 08:00:00', NULL, NULL),
    ('CE002', 'P000001', 'ENC002', 'CONDITION', 'HYPERTENSION', 'Hipertensão Arterial Sistêmica',  '2024-07-15 14:00:00', NULL, NULL),
    ('CE003', 'P000003', 'ENC004', 'CONDITION', 'HYPERTENSION', 'Hipertensão Arterial Sistêmica',  '2025-03-05 09:00:00', NULL, NULL),
    ('CE004', 'P000005', 'ENC006', 'CONDITION', 'DIABETES',     'Diabetes Mellitus Tipo 2',        '2022-06-01 10:00:00', NULL, NULL),
    ('CE005', 'P000006', 'ENC007', 'CONDITION', 'DIABETES',     'Diabetes Mellitus Tipo 2',        '2024-11-03 11:00:00', NULL, NULL),
    ('CE006', 'P000007', 'ENC008', 'CONDITION', 'HYPERTENSION', 'Hipertensão Arterial Sistêmica',  '2025-06-18 08:00:00', NULL, NULL),
    ('CE007', 'P000009', 'ENC010', 'CONDITION', 'DIABETES',     'Diabetes Mellitus Tipo 2',        '2021-09-10 10:00:00', NULL, NULL),
    ('CE008', 'P000010', 'ENC011', 'CONDITION', 'HYPERTENSION', 'Hipertensão Arterial Sistêmica',  '2025-03-15 14:00:00', NULL, NULL),
    -- Observações / exames laboratoriais
    ('CE009', 'P000001', 'ENC001', 'OBSERVATION', 'HBA1C',            'Hemoglobina Glicada',        '2025-01-10 08:30:00', '8.1',   '%'),
    ('CE010', 'P000001', 'ENC001', 'OBSERVATION', 'FASTING_GLUCOSE',  'Glicemia em Jejum',           '2025-01-10 08:30:00', '182.0', 'mg/dL'),
    ('CE011', 'P000001', 'ENC001', 'OBSERVATION', 'BLOOD_PRESSURE',   'Pressão Arterial Sistólica',  '2025-01-10 08:30:00', '150.0', 'mmHg'),
    ('CE012', 'P000003', 'ENC004', 'OBSERVATION', 'BLOOD_PRESSURE',   'Pressão Arterial Sistólica',  '2025-03-05 09:30:00', '165.0', 'mmHg'),
    ('CE013', 'P000005', 'ENC006', 'OBSERVATION', 'HBA1C',            'Hemoglobina Glicada',         '2025-01-22 13:30:00', '7.4',   '%'),
    ('CE014', 'P000005', 'ENC006', 'OBSERVATION', 'FASTING_GLUCOSE',  'Glicemia em Jejum',           '2025-01-22 13:30:00', '155.0', 'mg/dL'),
    ('CE015', 'P000006', 'ENC007', 'OBSERVATION', 'HBA1C',            'Hemoglobina Glicada',         '2025-05-03 11:30:00', '9.2',   '%'),
    ('CE016', 'P000009', 'ENC010', 'OBSERVATION', 'HBA1C',            'Hemoglobina Glicada',         '2025-02-28 10:30:00', '7.8',   '%'),
    ('CE017', 'P000007', 'ENC008', 'OBSERVATION', 'BLOOD_PRESSURE',   'Pressão Arterial Sistólica',  '2025-06-18 08:30:00', '180.0', 'mmHg'),
    -- Medicações
    ('CE018', 'P000001', 'ENC001', 'MEDICATION', 'METFORMIN',   'Metformina 850 mg', '2025-01-10 08:00:00', '850', 'mg'),
    ('CE019', 'P000001', 'ENC002', 'MEDICATION', 'LOSARTAN',    'Losartana 50 mg',   '2024-07-15 14:00:00', '50',  'mg'),
    ('CE020', 'P000003', 'ENC004', 'MEDICATION', 'LOSARTAN',    'Losartana 50 mg',   '2025-03-05 09:00:00', '50',  'mg'),
    ('CE021', 'P000005', 'ENC006', 'MEDICATION', 'METFORMIN',   'Metformina 850 mg', '2025-01-22 13:00:00', '850', 'mg'),
    ('CE022', 'P000006', 'ENC007', 'MEDICATION', 'INSULIN_NPH', 'Insulina NPH',      '2025-05-03 11:00:00', '20',  'UI'),
    ('CE023', 'P000007', 'ENC008', 'MEDICATION', 'ATENOLOL',    'Atenolol 50 mg',    '2025-06-18 08:00:00', '50',  'mg'),
    ('CE024', 'P000009', 'ENC010', 'MEDICATION', 'METFORMIN',   'Metformina 850 mg', '2025-02-28 10:00:00', '850', 'mg'),
    ('CE025', 'P000010', 'ENC011', 'MEDICATION', 'LOSARTAN',    'Losartana 50 mg',   '2025-03-15 14:00:00', '50',  'mg')
ON CONFLICT DO NOTHING;
