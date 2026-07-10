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
import { ProjectStatus } from './ResearchProjects.jsx';
import { formatDate, genderLabel } from '../utils/format.js';

export function ResearchProjectDetails() {
  const { projectId } = useParams();
  const [state, setState] = useState({ status: 'loading', project: null, aggregate: null, cohort: null, error: null });

  function load() {
    setState({ status: 'loading', project: null, aggregate: null, cohort: null, error: null });
    Promise.all([getProject(projectId), getProjectAggregate(projectId), getProjectCohort(projectId)])
      .then(([project, aggregate, cohort]) => setState({ status: 'success', project, aggregate, cohort, error: null }))
      .catch((error) => setState({ status: 'error', project: null, aggregate: null, cohort: null, error }));
  }

  useEffect(() => {
    load();
  }, [projectId]);

  if (state.status === 'loading') return <LoadingState message="Carregando projeto" />;
  if (state.status === 'error') return <ErrorState message={state.error.message} onRetry={load} />;

  const isApproved = state.project.status === 'Aprovado';

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
        <Box>
          <Typography variant="h1">{state.project.title}</Typography>
          <Typography color="text.secondary">
            {state.project.projectId} · {state.project.clinicalCondition} · {formatDate(state.project.validFrom)} até {formatDate(state.project.validUntil)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <ProjectStatus status={state.project.status} />
          <AccessLevelChip level={state.aggregate.accessLevel} />
        </Stack>
      </Stack>

      {!isApproved ? (
        <Alert severity="warning">Projeto sem status aprovado. A API real deve bloquear ou restringir estes dados.</Alert>
      ) : null}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
        <Metric title="Total da coorte" value={state.aggregate.totalPatients} />
        <Metric title="Nível estatístico" value={state.aggregate.accessLevel} />
        <Metric title="Nível individual" value={state.cohort.accessLevel} />
      </Box>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h3" sx={{ mb: 2 }}>Distribuições agregadas</Typography>
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' } }}>
          <Chart title="Idade" data={state.aggregate.ageDistribution} />
          <Chart title="Gênero" data={state.aggregate.genderDistribution} />
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h3" sx={{ mb: 2 }}>Medicações frequentes</Typography>
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

function Metric({ title, value }) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="caption" color="text.secondary">{title}</Typography>
      <Typography variant="h2">{value}</Typography>
    </Paper>
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
            <Bar dataKey="value" name="Percentual" fill="#0f766e" />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}

function CohortTable({ cohort }) {
  const patients = cohort?.patients || [];
  return (
    <Paper>
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

