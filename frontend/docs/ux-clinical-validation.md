# Protocolo de validação UX clínica

Este documento é um roteiro de pesquisa. A validação ainda depende de profissionais reais e não pode ser substituída por testes automatizados.

## Participantes mínimos

- 3 médicos de especialidades diferentes;
- 2 estagiários sob supervisão;
- 2 pesquisadores que trabalhem com coortes;
- 1 profissional de segurança/privacidade;
- 1 especialista em acessibilidade;
- 1 profissional de enfermagem ou operação hospitalar para revisar linguagem e alertas.

## Tarefas clínicas

1. Localizar um paciente vinculado usando nome e identificador.
2. Confirmar identidade antes de interpretar eventos clínicos.
3. Encontrar o atendimento mais recente.
4. Identificar se o registro está parcial ou incompleto.
5. Localizar um resultado explicitamente marcado como crítico pela fonte.
6. Consultar diagnósticos, exames e medicamentos sem perder contexto.
7. Inspecionar o Bundle FHIR e retornar ao resumo.
8. Como estagiário, explicar quais dados foram removidos.
9. Como pesquisador, localizar projeto, vigência, agregado e coorte.
10. Confirmar que a coorte não apresenta identificadores reais.

## Métricas

- taxa de conclusão sem ajuda: meta >= 90%;
- tempo para localizar último atendimento: meta <= 30 s;
- tempo para reconhecer acesso parcial: meta <= 10 s;
- erro de seleção de paciente: meta 0;
- interpretação incorreta de campo ausente: meta 0;
- SUS (System Usability Scale): meta >= 80;
- confiança percebida e carga de trabalho após cada tarefa.

## Evidência e aprovação

Registrar somente métricas e observações sem dados clínicos reais. A entrega para produção exige relatório de achados, correções priorizadas e aprovação de representante clínico, privacidade e UX.
