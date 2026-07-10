import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CodeIcon from '@mui/icons-material/Code';
import MedicationIcon from '@mui/icons-material/Medication';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import ScienceIcon from '@mui/icons-material/Science';
import { useSnackbar } from 'notistack';
import { getClinicalSummary, getFhirBundle } from '../api/patients.js';
import { AccessLevelChip } from '../components/AccessLevelChip.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { MetricCard } from '../components/MetricCard.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { formatDate, genderLabel, protectedValue } from '../utils/format.js';

const tabs = [
  { key: 'summary', label: 'Resumo clínico', icon: <AssignmentIcon /> },
  { key: 'encounters', label: 'Atendimentos', icon: <CalendarMonthIcon /> },
  { key: 'diagnoses', label: 'Diagnósticos', icon: <MonitorHeartIcon /> },
  { key: 'exams', label: 'Exames', icon: <ScienceIcon /> },
  { key: 'medications', label: 'Medicamentos', icon: <MedicationIcon /> },
  { key: 'fhir', label: 'FHIR JSON', icon: <CodeIcon /> },
];

export function PatientDetails() {
  const { patientId } = useParams();
  const [activeTab, setActiveTab] = useState('summary');
  const [summaryState, setSummaryState] = useState({ status: 'loading', data: null, error: null });
  const [fhirState, setFhirState] = useState({ status: 'idle', data: null, error: null });
  const { enqueueSnackbar } = useSnackbar();

  function loadSummary() {
    setSummaryState({ status: 'loading', data: null, error: null });
    getClinicalSummary(patientId)
      .then((data) => setSummaryState({ status: 'success', data, error: null }))
      .catch((error) => {
        setSummaryState({ status: 'error', data: null, error });
        enqueueSnackbar('Não foi possível carregar o prontuário.', { variant: 'error' });
      });
  }

  useEffect(() => {
    loadSummary();
  }, [patientId]);

  useEffect(() => {
    if (activeTab !== 'fhir' || fhirState.status !== 'idle') return;
    setFhirState({ status: 'loading', data: null, error: null });
    getFhirBundle(patientId)
      .then((data) => setFhirState({ status: 'success', data, error: null }))
      .catch((error) => {
        setFhirState({ status: 'error', data: null, error });
        enqueueSnackbar('Não foi possível carregar o Bundle FHIR.', { variant: 'error' });
      });
  }, [activeTab, fhirState.status, patientId]);

  if (summaryState.status === 'loading') return <LoadingState message="Carregando prontuário" />;
  if (summaryState.status === 'error') return <ErrorState message={summaryState.error.message} onRetry={loadSummary} />;

  const data = summaryState.data;
  const patient = data.patient;

  return (
    <Stack spacing={3}>
      <PageHeader
        title={protectedValue(patient.fullName)}
        subtitle={`${patient.patientId} · ${genderLabel(patient.gender)} · ${formatDate(patient.birthDate)}`}
        eyebrow="Prontuário clínico"
        actions={<AccessLevelChip level={data.accessLevel} />}
      />

      {data.accessLevel === 'PARTIAL' ? (
        <Alert severity="warning">Acesso parcial: campos identificadores foram removidos ou reduzidos pelo backend.</Alert>
      ) : null}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
        <MetricCard title="Atendimentos" value={data.recentEncounters?.length || 0} description="Registros recentes disponíveis." />
        <MetricCard title="Eventos clínicos" value={(data.diagnoses?.length || 0) + (data.exams?.length || 0) + (data.medications?.length || 0)} description="Diagnósticos, exames e medicamentos." />
        <MetricCard title="Nível de acesso" value={data.accessLevel} description="Definido pelo backend nos contratos reais." />
      </Box>

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} variant="scrollable" scrollButtons="auto">
          {tabs.map((tab) => <Tab key={tab.key} value={tab.key} label={tab.label} icon={tab.icon} iconPosition="start" />)}
        </Tabs>
      </Paper>

      {activeTab === 'summary' ? <SummaryTab data={data} /> : null}
      {activeTab === 'encounters' ? <EncountersTable encounters={data.recentEncounters} /> : null}
      {activeTab === 'diagnoses' ? <EventsTable events={data.diagnoses} /> : null}
      {activeTab === 'exams' ? <EventsTable events={data.exams} /> : null}
      {activeTab === 'medications' ? <EventsTable events={data.medications} /> : null}
      {activeTab === 'fhir' ? <FhirTab state={fhirState} /> : null}
    </Stack>
  );
}

function SummaryTab({ data }) {
  const patient = data.patient;
  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', p: 3 }}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
        <Info label="Nome" value={protectedValue(patient.fullName)} />
        <Info label="CPF" value={protectedValue(patient.cpf)} />
        <Info label="CNS" value={protectedValue(patient.cns)} />
        <Info label="Cidade" value={protectedValue(patient.city)} />
        <Info label="Estado" value={protectedValue(patient.state)} />
        <Info label="Nível" value={data.accessLevel} />
      </Box>
    </Paper>
  );
}

function Info({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography fontWeight={700}>{value}</Typography>
    </Box>
  );
}

function EncountersTable({ encounters }) {
  if (!encounters?.length) return <EmptyState />;
  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Data</TableCell>
            <TableCell>Tipo</TableCell>
            <TableCell>Departamento</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {encounters.map((encounter) => (
            <TableRow key={encounter.encounterId}>
              <TableCell>{formatDate(encounter.startDate)}</TableCell>
              <TableCell>{encounter.type}</TableCell>
              <TableCell>{encounter.department}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

function EventsTable({ events }) {
  if (!events?.length) return <EmptyState />;
  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Data</TableCell>
            <TableCell>Código</TableCell>
            <TableCell>Descrição</TableCell>
            <TableCell>Valor</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.eventId}>
              <TableCell>{formatDate(event.eventDate)}</TableCell>
              <TableCell>{event.eventCode}</TableCell>
              <TableCell>{event.description}</TableCell>
              <TableCell>{[event.value, event.unit].filter(Boolean).join(' ') || 'Não informado'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

function FhirTab({ state }) {
  if (state.status === 'loading' || state.status === 'idle') return <LoadingState message="Carregando FHIR" />;
  if (state.status === 'error') return <ErrorState message={state.error.message} />;
  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', p: 2 }}>
      <Typography variant="caption" color="text.secondary">Bundle FHIR R4</Typography>
      <Box component="pre" sx={{ bgcolor: '#0f172a', color: '#e2e8f0', borderRadius: 1, overflow: 'auto', p: 2, fontSize: 13 }}>
        {JSON.stringify(state.data.jsonPayload, null, 2)}
      </Box>
    </Paper>
  );
}
