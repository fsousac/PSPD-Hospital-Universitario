// Cenário de carga único e parametrizável (k6) para o api-gateway do grupo10.
// Cobre os 5 níveis de usuários simultâneos exigidos pelo enunciado
// (10/50/100/500/1000) via env VUS — não são 5 scripts.
//
// Uso:
//   k6 run -e VUS=10 -e DURATION=1m loadtests/k6-scenario.js
//   k6 run -e VUS=100 -e DURATION=2m -e USERNAME=pes.mendes -e PASSWORD=... loadtests/k6-scenario.js
//
// Variáveis de ambiente (todas com default para o usuário médico de teste):
//   VUS          default 10. Alvo de usuários simultâneos (não usar --vus do
//                k6 CLI — conflita com o executor `ramping-vus` definido
//                abaixo, que já controla os VUs internamente).
//   DURATION     default 1m. Duração da fase medida, depois da rampa.
//   RAMP_UP_SECONDS  default 30. Sobe de 0 até VUS gradualmente (em
//                segundos) antes da fase medida — dá ao HPA várias rodadas
//                de reconciliação (~15s cada) e a réplicas novas (até 60s
//                pra ficar Ready, JVM) uma janela real pra convergir antes
//                do pico. Medido ao vivo: convergir de 1 réplica até a
//                capacidade real pode levar 2-3 ciclos — para VUS mais
//                altos, usar um valor maior (ex.: 90-120 para 500/1000, ver
//                `run-scenarios.sh`). Requisições feitas durante a rampa
//                não contam nos thresholds (tag phase:ramp, não phase:main
//                — ver default() abaixo); só a fase medida (depois da
//                rampa) conta, mesma lógica do aquecimento em setup().
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
import exec from 'k6/execution';

const BASE_URL = __ENV.BASE_URL || 'https://kiriland.unb.br/grupo10';
const TOKEN_URL = __ENV.TOKEN_URL || 'https://kiriland.unb.br/keycloak/realms/grupo10/protocol/openid-connect/token';
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || '';
const CLIENT_ID = __ENV.CLIENT_ID || 'admin-cli';
const USERNAME = __ENV.USERNAME || 'med.cardoso';
const PASSWORD = __ENV.PASSWORD || 'PseudoPEP2026!';
const PATIENT_ID_ENV = __ENV.PATIENT_ID || '';
const CONDITION = __ENV.CONDITION || 'diabetes_tipo_2';
const PROJECT = __ENV.PROJECT || 'PRJ-G10-01';
const TARGET_VUS = Number(__ENV.VUS || 10);
const RAMP_UP_SECONDS = Number(__ENV.RAMP_UP_SECONDS || 30);
const HOLD_DURATION = __ENV.DURATION || '1m';

// Executor ramping-vus (0 → TARGET_VUS em RAMP_UP_SECONDS, depois sustenta
// por HOLD_DURATION) em vez do executor simples --vus/--duration: uma
// subida gradual dá ao HPA e às réplicas novas uma janela real pra
// convergir antes do pico, em vez de um degrau instantâneo que nenhum
// autoscaler acompanha a tempo — troca "manter réplicas sempre aquecidas"
// (custa cota do namespace o tempo todo) por "escalar a tempo" (só custa
// recursos quando há carga de verdade). Ver docs/decisions/0005 e
// k8s/hpa.yaml.
//
// Thresholds escopados na tag phase:main (só o default(), abaixo, e só
// depois de RAMP_UP_SECONDS já ter passado) — nem as requisições de
// aquecimento em setup() nem as da própria rampa contam, para não
// contaminar a métrica com o transiente de convergência do HPA (réplica
// nova subindo, JIT frio, conexão gRPC nova). Ver comentário em setup() e
// em default().
export const options = {
  scenarios: {
    default: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: `${RAMP_UP_SECONDS}s`, target: TARGET_VUS },
        { duration: HOLD_DURATION, target: TARGET_VUS },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_failed{phase:main}': ['rate<0.05'],
    'http_req_duration{phase:main}': ['p(95)<2000'],
  },
};

const isPesquisador = USERNAME.startsWith('pes.');

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

  // Aquecimento: dispara chamadas reais contra o mesmo pipeline (gateway ->
  // authorization-service -> patient-data-service -> data-transform-service)
  // antes da medição com threshold começar. Sem isso, JIT ainda frio do
  // authorization-service (JVM) e conexões gRPC novas (round_robin
  // reconectando a réplicas que o HPA acabou de subir) inflam o p95 do
  // início do teste sem refletir a latência em regime — já observado ao
  // vivo (ver docs/decisions/0005). Sem tag "phase:main" de propósito: não
  // conta nos thresholds acima, só serve pra "esquentar" o backend.
  const headers = { Authorization: `Bearer ${token}` };
  for (let i = 0; i < 10; i += 1) {
    if (isPesquisador) {
      http.get(`${BASE_URL}/api/v1/research/aggregate?condition=${CONDITION}&project=${PROJECT}`, { headers });
    } else {
      http.get(`${BASE_URL}/api/v1/me/patients`, { headers });
      if (patientId) {
        http.get(`${BASE_URL}/api/v1/patients/${patientId}`, { headers });
      }
    }
    sleep(0.2);
  }

  return { token, patientId };
}

export default function (data) {
  // Requisição feita durante a rampa (RAMP_UP_SECONDS ainda não passou) não
  // conta pros thresholds — mede só a fase sustentada, depois do HPA já ter
  // tido tempo de convergir (ver options.thresholds acima).
  const pastRampUp = exec.instance.currentTestRunDuration >= RAMP_UP_SECONDS * 1000;
  const params = {
    headers: { Authorization: `Bearer ${data.token}` },
    tags: { phase: pastRampUp ? 'main' : 'ramp' },
  };

  if (isPesquisador) {
    const res = http.get(
      `${BASE_URL}/api/v1/research/aggregate?condition=${CONDITION}&project=${PROJECT}`,
      params,
    );
    check(res, { 'aggregate status 200': (r) => r.status === 200 });
  } else {
    const listRes = http.get(`${BASE_URL}/api/v1/me/patients`, params);
    check(listRes, { 'me/patients status 200': (r) => r.status === 200 });

    if (data.patientId) {
      const patientRes = http.get(`${BASE_URL}/api/v1/patients/${data.patientId}`, params);
      check(patientRes, { 'patients/{id} status 200': (r) => r.status === 200 });
    }
  }

  sleep(1);
}
