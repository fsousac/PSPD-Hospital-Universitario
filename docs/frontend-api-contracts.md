# Contratos REST propostos para o frontend

Este documento descreve contratos provisórios para desenvolvimento com mocks.
Eles ainda não estão confirmados pela API Gateway.

Todas as rotas devem receber `Authorization: Bearer <jwt>` e podem receber
`X-Correlation-ID`.

## Usuário atual

`GET /api/me`

```json
{
  "username": "dr.silva",
  "displayName": "Dr. Silva",
  "roles": ["medico"]
}
```

## Pacientes

`GET /api/patients`

```json
{
  "accessLevel": "FULL",
  "patients": [
    {
      "patientId": "P000001",
      "fullName": "João da Silva",
      "birthDate": "1970-05-10",
      "gender": "male",
      "city": "Brasília",
      "state": "DF"
    }
  ]
}
```

`GET /api/patients/{patientId}`

`GET /api/patients/{patientId}/summary`

`GET /api/patients/{patientId}/encounters`

`GET /api/patients/{patientId}/events?type=diagnoses|exams|medications`

`GET /api/patients/{patientId}/fhir`

## Pesquisa

`GET /api/research/projects`

`GET /api/research/projects/{projectId}`

`GET /api/research/projects/{projectId}/aggregate`

`GET /api/research/projects/{projectId}/cohort`

As respostas de pesquisador não devem conter CPF, CNS, cidade, nome completo
ou identificadores reais de pacientes.

