# ADR 0003 — Data Transform Service: decisões técnicas

**Autor:** Yasmim

---

## Contexto

O enunciado especificava Data Transform Service com suporte a HL7/FHIR e anonimização por nível de acesso (`FULL | PARTIAL | ANONYMIZED | AGGREGATED`), mas não definia linguagem, biblioteca FHIR nem como estruturar a lógica de transformação.

## Decisões

### 1. Linguagem: Python 3

Mesma escolha do Patient Data Service — consistência de stack, ecossistema maduro para processamento de dados clínicos e biblioteca FHIR R4 disponível (`fhir.resources`).

### 2. Biblioteca FHIR: `fhir.resources`

`fhir.resources` oferece modelos Python tipados para todos os recursos FHIR R4 (`Patient`, `Encounter`, `Condition`, `Observation`, `MedicationRequest`). Serializa para JSON-compatível com o padrão FHIR sem necessidade de construção manual de dicionários.

### 3. Separação em três módulos de transformação

A lógica de transformação foi separada em três módulos independentes:

- `anonymizer.py` — aplica anonimização nos dados brutos conforme o nível de acesso
- `fhir_mapper.py` — mapeia dicionários Python para recursos FHIR R4
- `aggregator.py` — computa estatísticas agregadas (distribuição de idade, gênero, departamentos, medicações)

Essa separação permite testar cada responsabilidade de forma isolada e facilita substituição futura de qualquer uma das peças.

### 4. Nível PARTIAL: iniciais do nome + CPF/CNS omitidos

Para estagiários (nível `PARTIAL`), o nome completo é substituído pelas iniciais (ex.: "João da Silva" → "J.S.") e CPF/CNS são removidos. A data de nascimento é preservada integralmente neste nível.

### 5. Nível ANONYMIZED: hash_id + faixa etária

Para pesquisadores com leitura individual (nível `ANONYMIZED`), o `patient_id` é substituído por um hash SHA-256 truncado, a data de nascimento vira faixa etária ("18-39", "40-59", "60+") e nome/cidade/CPF/CNS são removidos. O campo `birth_date` não é mapeado para o `birthDate` do recurso FHIR R4 neste nível para evitar re-identificação por cruzamento de dados.

### 6. Nível AGGREGATED: sem registros individuais

Para pesquisadores com acesso apenas estatístico (nível `AGGREGATED`), nenhum dado individual é retornado. O serviço retorna apenas distribuições percentuais calculadas sobre a coorte inteira.

### 7. Cliente gRPC para o PDS com reconexão automática

O `PatientDataClient` usa `grpc.insecure_channel` com `wait_for_ready=True` nas chamadas, permitindo que o DTS se recupere automaticamente se o PDS reiniciar sem precisar reiniciar o próprio DTS.

## Consequências

- A serialização FHIR via `fhir.resources` valida os campos obrigatórios do padrão — dados malformados levantam exceção na camada de mapeamento.
- O nível `AGGREGATED` não suporta consulta por paciente individual — qualquer tentativa retorna bundle vazio por design.
- A anonimização é determinística (mesmo hash para o mesmo `patient_id`), o que pode ser um vetor de re-identificação em datasets pequenos — aceitável para o contexto acadêmico deste projeto.
