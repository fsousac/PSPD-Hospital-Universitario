import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert,
  Breadcrumbs,
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GroupsIcon from '@mui/icons-material/Groups';
import InsightsIcon from '@mui/icons-material/Insights';
import LockPersonIcon from '@mui/icons-material/LockPerson';
import { useSnackbar } from 'notistack';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getProject, getProjectAggregate, getProjectCohort } from '../api/research.js';
import { AccessLevelChip } from '../components/AccessLevelChip.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { MetricCard } from '../components/MetricCard.jsx';
import { OperationalTable } from '../components/OperationalTable.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { ProjectStatus } from './ResearchProjects.jsx';
import { formatDate, genderLabel } from '../utils/format.js';
import { reportAuditSignal } from '../observability/telemetry.js';

export function ResearchProjectDetails() {
  const { projectId } = useParams();
  const [state, setState] = useState({ status: 'loading', project: null, aggregate: null, cohort: null, error: null });
  const { enqueueSnackbar } = useSnackbar();

  function load() {
    setState({ status: 'loading', project: null, aggregate: null, cohort: null, error: null });
    Promise.all([getProject(projectId), getProjectAggregate(projectId), getProjectCohort(projectId)])
      .then(([project, aggregate, cohort]) => setState({ status: 'success', project, aggregate, cohort, error: null }))
      .catch((error) => {
        setState({ status: 'error', project: null, aggregate: null, cohort: null, error });
        enqueueSnackbar('Não foi possível carregar os dados do projeto.', { variant: 'error' });
      });
  }

  useEffect(() => {
    reportAuditSignal('research_project_opened');
    load();
  }, [projectId]);

  if (state.status === 'loading') return <LoadingState message="Carregando projeto" />;
  if (state.status === 'error') return <ErrorState message={state.error.message} correlationId={state.error.correlationId} onRetry={load} />;

  const isApproved = state.project.status === 'Aprovado';

  return (
    <Stack spacing={3}>
      <Breadcrumbs aria-label="Navegação do projeto de pesquisa">
        <Button component={RouterLink} to="/research/projects" startIcon={<ArrowBackIcon />} size="small">
          Projetos de pesquisa
        </Button>
        <Typography color="text.secondary">{state.project.projectId}</Typography>
      </Breadcrumbs>
      <PageHeader
        title={state.project.title}
        subtitle={`${state.project.projectId} · ${state.project.clinicalCondition} · ${formatDate(state.project.validFrom)} até ${formatDate(state.project.validUntil)}`}
        eyebrow="Projeto de pesquisa"
        actions={(
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <ProjectStatus status={state.project.status} />
          <AccessLevelChip level={state.aggregate.accessLevel} />
          </Stack>
        )}
      />

      {!isApproved ? (
        <Alert severity="warning">Projeto sem status aprovado. A API real deve bloquear ou restringir estes dados.</Alert>
      ) : null}

      <Alert severity="info">
        Os resultados desta área são agregados ou pseudonimizados. Identificadores diretos de pacientes não fazem parte deste fluxo.
      </Alert>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
        <MetricCard title="Total da coorte" value={state.aggregate.totalPatients} icon={<GroupsIcon />} />
        <MetricCard title="Nível estatístico" value={state.aggregate.accessLevel} icon={<InsightsIcon />} />
        <MetricCard title="Nível individual" value={state.cohort.accessLevel} icon={<LockPersonIcon />} />
      </Box>

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', p: 3 }}>
        <Typography variant="h3" sx={{ mb: 2 }}>Distribuições agregadas</Typography>
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' } }}>
          <Chart title="Idade" data={state.aggregate.ageDistribution} />
          <Chart title="Gênero" data={state.aggregate.genderDistribution} />
        </Box>
      </Paper>

      <OperationalTable
        ariaLabel="Medicações frequentes"
        title="Medicações frequentes"
        subtitle="Distribuição percentual na coorte agregada."
        rows={state.aggregate.medications}
        getRowId={(item) => item.medication}
        initialOrderBy="percentage"
        minWidth={520}
        columns={[
          { id: 'medication', label: 'Medicação', sortable: true },
          { id: 'percentage', label: 'Percentual', sortable: true, render: (item) => `${item.percentage}%` },
        ]}
      />

      <CohortTable cohort={state.cohort} />
    </Stack>
  );
}

function Chart({ title, data }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography fontWeight={700} sx={{ mb: 1 }}>{title}</Typography>
      <Box role="img" aria-label={`Gráfico de distribuição por ${title.toLowerCase()}: ${data.map((item) => `${item.name}, ${item.value}%`).join('; ')}`} sx={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" name="Percentual" fill="#0f766e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}

function CohortTable({ cohort }) {
  const patients = cohort?.patients || [];
  return (
    <OperationalTable
      ariaLabel="Coorte pseudonimizada"
      title="Coorte pseudonimizada"
      subtitle="A tabela não deve conter nome, CPF, CNS, cidade ou ID real do paciente."
      rows={patients}
      getRowId={(patient) => patient.pseudonymId}
      initialOrderBy="pseudonymId"
      emptyTitle="Nenhum participante na coorte"
      minWidth={700}
      columns={[
        { id: 'pseudonymId', label: 'Pseudônimo', sortable: true },
        { id: 'ageRange', label: 'Faixa etária', sortable: true },
        { id: 'gender', label: 'Gênero', sortable: true, render: (patient) => genderLabel(patient.gender) },
        { id: 'condition', label: 'Condição', sortable: true },
      ]}
    />
  );
}
