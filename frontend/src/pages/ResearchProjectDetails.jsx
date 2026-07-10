import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
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
import { EmptyState } from '../components/EmptyState.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { MetricCard } from '../components/MetricCard.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { ProjectStatus } from './ResearchProjects.jsx';
import { formatDate, genderLabel } from '../utils/format.js';

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
    load();
  }, [projectId]);

  if (state.status === 'loading') return <LoadingState message="Carregando projeto" />;
  if (state.status === 'error') return <ErrorState message={state.error.message} onRetry={load} />;

  const isApproved = state.project.status === 'Aprovado';

  return (
    <Stack spacing={3}>
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

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Box sx={{ p: 3, pb: 1 }}>
        <Typography variant="h3" sx={{ mb: 2 }}>Medicações frequentes</Typography>
        </Box>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Medicação</TableCell>
              <TableCell>Percentual</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {state.aggregate.medications.map((item) => (
              <TableRow key={item.medication}>
                <TableCell>{item.medication}</TableCell>
                <TableCell>{item.percentage}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <CohortTable cohort={state.cohort} />
    </Stack>
  );
}

function Chart({ title, data }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography fontWeight={700} sx={{ mb: 1 }}>{title}</Typography>
      <Box sx={{ height: 260 }}>
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
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
      <Box sx={{ p: 3, pb: 0 }}>
        <Typography variant="h3">Coorte pseudonimizada</Typography>
        <Typography color="text.secondary">A tabela não deve conter nome, CPF, CNS, cidade ou ID real do paciente.</Typography>
      </Box>
      {patients.length === 0 ? (
        <EmptyState />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Pseudônimo</TableCell>
              <TableCell>Faixa etária</TableCell>
              <TableCell>Gênero</TableCell>
              <TableCell>Condição</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {patients.map((patient) => (
              <TableRow key={patient.pseudonymId}>
                <TableCell>{patient.pseudonymId}</TableCell>
                <TableCell>{patient.ageRange}</TableCell>
                <TableCell>{genderLabel(patient.gender)}</TableCell>
                <TableCell>{patient.condition}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}
