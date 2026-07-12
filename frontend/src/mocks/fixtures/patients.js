export const patientsFull = [
  {
    patientId: 'P000001',
    fullName: 'João da Silva',
    birthDate: '1970-05-10',
    gender: 'male',
    city: 'Brasília',
    state: 'DF',
    cpf: '111.222.333-44',
    cns: '700001234567890',
  },
  {
    patientId: 'P000005',
    fullName: 'Pedro Alves',
    birthDate: '1955-12-01',
    gender: 'male',
    city: 'Samambaia',
    state: 'DF',
    cpf: '555.666.777-88',
    cns: '700005678901234',
  },
];

export const patientsPartial = [
  {
    patientId: 'P000001',
    fullName: 'J.S.',
    birthDate: '1970',
    gender: 'male',
    city: 'Brasília',
    state: 'DF',
  },
];

export const clinicalSummary = {
  accessLevel: 'FULL',
  patient: patientsFull[0],
  recentEncounters: [
    {
      encounterId: 'ENC001',
      patientId: 'P000001',
      startDate: '2025-01-10T11:00:00Z',
      endDate: '2025-01-10T12:30:00Z',
      type: 'Ambulatorial',
      department: 'Endocrinologia',
    },
    {
      encounterId: 'ENC002',
      patientId: 'P000001',
      startDate: '2024-07-15T17:00:00Z',
      endDate: '2024-07-15T18:00:00Z',
      type: 'Retorno',
      department: 'Endocrinologia',
    },
  ],
  diagnoses: [
    {
      eventId: 'CE001',
      eventType: 'Condição',
      eventCode: 'diabetes_tipo_2',
      description: 'Diabetes Mellitus Tipo 2',
      eventDate: '2023-01-10T11:00:00Z',
    },
    {
      eventId: 'CE002',
      eventType: 'Condição',
      eventCode: 'hipertensao',
      description: 'Hipertensão Arterial Sistêmica',
      eventDate: '2024-07-15T17:00:00Z',
    },
  ],
  exams: [
    {
      eventId: 'CE009',
      eventType: 'Observação',
      eventCode: 'HbA1c',
      description: 'Hemoglobina Glicada',
      eventDate: '2025-01-10T11:30:00Z',
      value: '8.1',
      unit: '%',
    },
  ],
  medications: [
    {
      eventId: 'CE018',
      eventType: 'Medicação',
      eventCode: 'Metformina_850mg',
      description: 'Metformina 850 mg',
      eventDate: '2025-01-10T11:00:00Z',
      value: '850',
      unit: 'mg',
    },
  ],
};

export const partialSummary = {
  ...clinicalSummary,
  accessLevel: 'PARTIAL',
  patient: patientsPartial[0],
};

export const fhirBundle = {
  resourceType: 'Bundle',
  type: 'searchset',
  total: 4,
  jsonPayload: {
    resourceType: 'Bundle',
    type: 'searchset',
    total: 4,
    entry: [
      { resource: { resourceType: 'Patient', id: 'P000001', gender: 'male' } },
      { resource: { resourceType: 'Condition', id: 'CE001', code: { text: 'Diabetes Mellitus Tipo 2' } } },
    ],
  },
};

