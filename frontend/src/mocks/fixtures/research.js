export const projects = [
  {
    projectId: 'PRJ01',
    title: 'Fatores de risco em Diabetes Tipo 2',
    clinicalCondition: 'diabetes_tipo_2',
    status: 'Aprovado',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
  },
  {
    projectId: 'PRJ02',
    title: 'Hipertensão em idosos',
    clinicalCondition: 'hipertensao',
    status: 'Suspenso',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
  },
  {
    projectId: 'PRJ03',
    title: 'Diabetes Tipo 2 - coorte histórica',
    clinicalCondition: 'diabetes_tipo_2',
    status: 'Expirado',
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
  },
];

export const aggregate = {
  accessLevel: 'AGGREGATED',
  clinicalCondition: 'diabetes_tipo_2',
  totalPatients: 4,
  genderDistribution: [
    { name: 'Masculino', value: 75 },
    { name: 'Feminino', value: 25 },
    { name: 'Outro', value: 0 },
  ],
  ageDistribution: [
    { name: '18-39', value: 0 },
    { name: '40-59', value: 50 },
    { name: '60+', value: 50 },
  ],
  medications: [
    { medication: 'Metformina 850 mg', percentage: 75 },
    { medication: 'Insulina NPH', percentage: 25 },
  ],
};

export const cohort = {
  accessLevel: 'ANONYMIZED',
  patients: [
    {
      pseudonymId: 'anon-7f3a91c2',
      ageRange: '40-59',
      gender: 'male',
      condition: 'diabetes_tipo_2',
    },
    {
      pseudonymId: 'anon-21ad89bb',
      ageRange: '60+',
      gender: 'male',
      condition: 'diabetes_tipo_2',
    },
    {
      pseudonymId: 'anon-cb92103d',
      ageRange: '40-59',
      gender: 'female',
      condition: 'diabetes_tipo_2',
    },
  ],
};

