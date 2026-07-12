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
//   ACCESS_TOKEN JWT de aplicação já emitido (o id_token, não o access_token —
//                ver nota abaixo). Se informado, o setup() não faz login.
//   CLIENT_ID    default admin-cli. `authorization-service`/`account-console`
//                não aceitam password grant sem segredo nesse realm — admin-cli
//                é público e aceita (confirmado 2026-07-12, ver docs/decisions/0005).
//   USERNAME     default med.cardoso
//   PASSWORD     default PseudoPEP2026!
//   PATIENT_ID   se não informado, o setup() descobre um paciente real do
//                USERNAME chamando /api/v1/me/patients uma vez (evita
//                depender de um ID fixo que só existe no seed de dev local).
//
// NOTA sobre o token: o realm grupo10 emite access_token "lightweight" (sem
// nenhuma claim de papel). O papel do usuário (MEDICO/ESTAGIARIO/PESQUISADOR)
// só aparece no claim "groups" do id_token (pedindo scope=microprofile-jwt) —
// por isso o setup() abaixo usa id_token, não access_token, como o JWT
// enviado ao gateway. TokenValidationService.extractRealmRoles já sabe ler
// "groups" como fallback (ver services/authorization-service).
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
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || '';
const CLIENT_ID = __ENV.CLIENT_ID || 'admin-cli';
const USERNAME = __ENV.USERNAME || 'med.cardoso';
const PASSWORD = __ENV.PASSWORD || 'PseudoPEP2026!';
const PATIENT_ID_ENV = __ENV.PATIENT_ID || '';
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
  if (ACCESS_TOKEN) {
    return { token: ACCESS_TOKEN };
  }

  const res = http.post(
    TOKEN_URL,
    {
      grant_type: 'password',
      client_id: CLIENT_ID,
      username: USERNAME,
      password: PASSWORD,
      scope: 'openid microprofile-jwt',
    },
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );

  check(res, { 'login obteve token': (r) => r.status === 200 && !!r.json('id_token') });
  if (res.status !== 200) {
    throw new Error(
      `Falha no login (status ${res.status}): ${res.body}. ` +
        'Verifique CLIENT_ID/USERNAME/PASSWORD ou informe ACCESS_TOKEN. ' +
        'Se o realm exigir client secret, a correção é externa ao script.',
    );
  }
  // id_token (não access_token): só ele carrega o claim "groups" nesse realm — ver nota no topo do arquivo.
  const token = res.json('id_token');

  // Descobre um patient_id real do USERNAME (evita depender de um ID fixo
  // que só existe no seed de dev local — ver nota no topo do arquivo).
  let patientId = PATIENT_ID_ENV;
  if (!patientId && !USERNAME.startsWith('pes.')) {
    const listRes = http.get(`${BASE_URL}/api/v1/me/patients`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const patients = listRes.json('patients') || [];
    if (patients.length > 0) {
      patientId = patients[0].patient_id;
    }
  }

  return { token, patientId };
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

    if (data.patientId) {
      const patientRes = http.get(`${BASE_URL}/api/v1/patients/${data.patientId}`, { headers });
      check(patientRes, { 'patients/{id} status 200': (r) => r.status === 200 });
    }
  }

  sleep(1);
}
