// Cenário de carga único e parametrizável (k6) para o api-gateway do grupo10.
// Cobre os 5 níveis de usuários simultâneos exigidos pelo enunciado
// (10/50/100/500/1000) via a flag --vus / env VUS — não são 5 scripts.
//
// Uso:
//   k6 run --vus 10 --duration 1m loadtests/k6-scenario.js
//   k6 run --vus 100 --duration 2m -e USERNAME=pes.mendes -e PASSWORD=... loadtests/k6-scenario.js
//
// Variáveis de ambiente (todas com default para o usuário médico de teste):
//   BASE_URL     default https://kiriland.unb.br/grupo10
//   TOKEN_URL    default .../keycloak/realms/grupo10/protocol/openid-connect/token
//   CLIENT_ID    default authorization-service (A CONFIRMAR contra o realm real —
//                ver docs/decisions/0005-k8s-observability-design.md, seção Riscos)
//   USERNAME     default med.cardoso
//   PASSWORD     default PseudoPEP2026!
//   PATIENT_ID   default P000001 (paciente vinculado a med.cardoso, ver
//                db/migrations/003_cluster_seed_grupo10.sql)
//
// Para testar o perfil pesquisador, rodar com:
//   -e USERNAME=pes.mendes -e CONDITION=diabetes_tipo_2 -e PROJECT=PRJ-G10-01
// (endpoint /api/v1/research/aggregate só retorna ALLOW para pesquisador).
//
// CPU/memória dos pods NÃO são medidas aqui — ler no Grafana do cluster
// (https://grafana.kiriland.unb.br, conta admgrp10) durante a execução, ver
// loadtests/README.md.

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://kiriland.unb.br/grupo10';
const TOKEN_URL = __ENV.TOKEN_URL || 'https://kiriland.unb.br/keycloak/realms/grupo10/protocol/openid-connect/token';
const CLIENT_ID = __ENV.CLIENT_ID || 'authorization-service';
const USERNAME = __ENV.USERNAME || 'med.cardoso';
const PASSWORD = __ENV.PASSWORD || 'PseudoPEP2026!';
const PATIENT_ID = __ENV.PATIENT_ID || 'P000001';
const CONDITION = __ENV.CONDITION || 'diabetes_tipo_2';
const PROJECT = __ENV.PROJECT || 'PRJ-G10-01';

export const options = {
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

// Login uma vez em setup() — o Keycloak não é o alvo do teste, só a origem
// do token reaproveitado por todas as VUs/iterações.
export function setup() {
  const res = http.post(
    TOKEN_URL,
    {
      grant_type: 'password',
      client_id: CLIENT_ID,
      username: USERNAME,
      password: PASSWORD,
    },
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );

  check(res, { 'login obteve token': (r) => r.status === 200 && !!r.json('access_token') });
  if (res.status !== 200) {
    throw new Error(
      `Falha no login (status ${res.status}): ${res.body}. ` +
        'Verifique CLIENT_ID/USERNAME/PASSWORD — ver docs/decisions/0005, seção Riscos.',
    );
  }
  return { token: res.json('access_token') };
}

export default function (data) {
  const headers = { Authorization: `Bearer ${data.token}` };

  const isPesquisador = USERNAME.startsWith('pes.');

  if (isPesquisador) {
    const res = http.get(
      `${BASE_URL}/api/v1/research/aggregate?condition=${CONDITION}&project=${PROJECT}`,
      { headers },
    );
    check(res, { 'aggregate status 200': (r) => r.status === 200 });
  } else {
    const listRes = http.get(`${BASE_URL}/api/v1/me/patients`, { headers });
    check(listRes, { 'me/patients status 200': (r) => r.status === 200 });

    const patientRes = http.get(`${BASE_URL}/api/v1/patients/${PATIENT_ID}`, { headers });
    check(patientRes, { 'patients/{id} status 200': (r) => r.status === 200 });
  }

  sleep(1);
}
