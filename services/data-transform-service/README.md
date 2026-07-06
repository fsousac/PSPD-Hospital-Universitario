# data-transform-service

**Stack: a definir pelo grupo**

Responsabilidade: recebe dados brutos do Patient Data Service, aplica
anonimização / agregação conforme `access_level` e converte para recursos
HL7/FHIR.

## Recursos FHIR produzidos

| Recurso FHIR         | Origem (tabela)              |
|----------------------|------------------------------|
| `Patient`            | patients                     |
| `Encounter`          | encounters                   |
| `Condition`          | clinical_events (diagnóstico)|
| `Observation`        | clinical_events (sinais vitais, exames) |
| `MedicationRequest`  | clinical_events (prescrições)|

## Regras de transformação por nível

- `FULL` — recurso FHIR completo com todos os campos
- `PARTIAL` — omite `Patient.identifier`, `Patient.name`, `Patient.birthDate` exata
- `ANONYMIZED` — substitui identificadores por tokens, data de nascimento por faixa etária
- `AGGREGATED` — não retorna recursos individuais; retorna `Bundle` com `total` apenas

## Decisão de stack

Registrar ADR em `docs/decisions/` antes de criar qualquer arquivo de projeto aqui.
