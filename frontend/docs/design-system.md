# Design system HU Observability

## Princípios

O produto é uma ferramenta operacional de saúde. A interface prioriza legibilidade, velocidade, prevenção de erro e privacidade. Cor nunca deve ser a única forma de transmitir estado; rótulos, ícones e texto devem acompanhar alertas e chips.

## Marca

- Nome: HU Observability.
- Assinatura: Inteligência clínica segura.
- Símbolo: cruz hospitalar dentro de um quadrado verde clínico.
- Componente oficial: `src/components/BrandLockup.jsx`.
- Área de proteção mínima: 8 px ao redor do símbolo.
- Não alterar proporção, aplicar gradiente ou usar o símbolo sem contraste suficiente.

## Cores

Os valores oficiais ficam em `src/theme/tokens.js`.

| Papel | Token | Valor | Uso |
| --- | --- | --- | --- |
| Primária | `clinicalTeal` | `#006C67` | navegação, ações e identidade |
| Institucional | `institutionalNavy` | `#12304A` | títulos e apoio |
| Informação | `informationBlue` | `#175CD3` | foco, links e informação |
| Crítico | `criticalRed` | `#B42318` | falhas e criticidade recebida |
| Atenção | `attentionAmber` | `#9A6700` | dados incompletos e cautela |
| Sucesso | `successGreen` | `#067647` | confirmação e estado positivo |
| Fundo | `canvas` | `#F3F6F9` | plano da aplicação |

Estados clínicos devem manter texto explícito. Vermelho não pode ser usado para inferir criticidade no frontend; ele representa apenas marcação recebida da fonte oficial.

## Tipografia

- Família: Roboto Latin, com fallback Arial e sans-serif.
- Pesos carregados: 400, 500 e 700.
- `h1`: título de página, uma vez por tela.
- `h3`: títulos de seção e painéis.
- `body1`: conteúdo principal.
- `body2` e `caption`: metadados e apoio, nunca informação clínica crítica isolada.
- Não reduzir texto com base na largura do viewport.

## Espaçamento e superfícies

- Unidade base do Material UI: 8 px.
- Raio de controles: 6 px.
- Raio de superfícies: 8 px.
- Alvo interativo mínimo adotado: 44 px.
- Conteúdo máximo: 1440 px.
- Não aninhar cartões decorativos. Cartões são usados para métricas e dados individuais; seções usam painéis simples.

## Iconografia

- Biblioteca oficial: Material Icons.
- Ícones sempre acompanham rótulo em ações não universais.
- Botões somente com ícone exigem `aria-label` e tooltip.
- Ícones decorativos devem ter `aria-hidden`.

## Componentes e padrões

- `PageHeader`: título, contexto e ações da página.
- `PageToolbar`: busca e filtros operacionais.
- `OperationalTable`: ordenação, paginação, densidade e visibilidade de colunas.
- `ClinicalSafetyPanel`: alertas explicitamente recebidos e aviso de dados incompletos.
- `LoadingState`, `EmptyState`, `ErrorState`: estados consistentes de sistema.
- `AccessLevelChip`: nível de acesso retornado pelo backend.
- `JsonViewer`: inspeção técnica de FHIR, sem logs automáticos.

## Navegação e experiência responsiva

- A navegação é agrupada por contexto: Visão geral, Assistência e Pesquisa.
- Em desktop a sidebar é permanente; em tablet ela se reduz a ícones com tooltip; em mobile ela é temporária.
- O cabeçalho identifica o usuário, o perfil e o modo mock quando aplicável.
- Páginas de detalhe exibem breadcrumb e ação explícita para voltar à lista de origem.
- Tabelas operacionais mantêm ordenação, paginação, densidade, configuração de colunas e rolagem horizontal.
- Cabeçalhos de tabela permanecem visíveis durante a rolagem para apoiar tarefas de comparação.

## Privacidade visual

Os chips de acesso combinam código técnico, rótulo legível, ícone e tooltip:

| Código | Rótulo | Significado visual |
| --- | --- | --- |
| `FULL` | Acesso completo | Dados disponíveis para o perfil, conforme o backend |
| `PARTIAL` | Dados parcialmente ocultos | Identificadores removidos ou reduzidos |
| `ANONYMIZED` | Dados anonimizados | Registros individuais pseudonimizados |
| `AGGREGATED` | Dados agregados | Estatísticas populacionais, sem leitura individual |

Cor nunca é o único indicador. A interface sempre usa texto e ícone, e não cria regras próprias de anonimização.

## Conteúdo

- Usar frases diretas e indicar a próxima ação.
- Nunca afirmar que dado ausente é dado inexistente.
- Nunca apresentar autorização visual como garantia de autorização real.
- Nunca incluir nome, CPF, CNS, token ou payload clínico em logs, métricas ou mensagens técnicas.
