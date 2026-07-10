import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BadgeIcon from '@mui/icons-material/Badge';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CodeIcon from '@mui/icons-material/Code';
import MedicationIcon from '@mui/icons-material/Medication';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import PlaceIcon from '@mui/icons-material/Place';
import PersonIcon from '@mui/icons-material/Person';
import ScienceIcon from '@mui/icons-material/Science';
import { useSnackbar } from 'notistack';
import { getClinicalSummary, getFhirBundle } from '../api/patients.js';
import { AccessLevelChip } from '../components/AccessLevelChip.jsx';
import { ClinicalSafetyPanel } from '../components/ClinicalSafetyPanel.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { InfoCard } from '../components/InfoCard.jsx';
import { JsonViewer } from '../components/JsonViewer.jsx';
import { MetricCard } from '../components/MetricCard.jsx';
import { OperationalTable } from '../components/OperationalTable.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { formatDate, genderLabel, protectedValue } from '../utils/format.js';
import { reportAuditSignal } from '../observability/telemetry.js';

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
    reportAuditSignal('clinical_record_opened');
    loadSummary();
  }, [patientId]);

  useEffect(() => {
    if (activeTab !== 'fhir' || fhirState.status !== 'idle') return;
    reportAuditSignal('fhir_viewed');
    setFhirState({ status: 'loading', data: null, error: null });
    getFhirBundle(patientId)
      .then((data) => setFhirState({ status: 'success', data, error: null }))
      .catch((error) => {
        setFhirState({ status: 'error', data: null, error });
        enqueueSnackbar('Não foi possível carregar o Bundle FHIR.', { variant: 'error' });
      });
  }, [activeTab, fhirState.status, patientId]);

  if (summaryState.status === 'loading') return <LoadingState message="Carregando prontuário" />;
  if (summaryState.status === 'error') return <ErrorState message={summaryState.error.message} correlationId={summaryState.error.correlationId} onRetry={loadSummary} />;

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

      <ClinicalSafetyPanel accessLevel={data.accessLevel} events={[...(data.diagnoses || []), ...(data.exams || []), ...(data.medications || [])]} />

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
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } }}>
      <InfoCard label="Nome" value={protectedValue(patient.fullName)} icon={<PersonIcon />} />
      <InfoCard label="CPF" value={protectedValue(patient.cpf)} icon={<BadgeIcon />} />
      <InfoCard label="CNS" value={protectedValue(patient.cns)} icon={<BadgeIcon />} />
      <InfoCard label="Cidade" value={protectedValue(patient.city)} icon={<PlaceIcon />} />
      <InfoCard label="Estado" value={protectedValue(patient.state)} icon={<PlaceIcon />} />
      <InfoCard label="Nível de acesso" value={data.accessLevel} icon={<AssignmentIcon />} />
    </Box>
  );
}

function EncountersTable({ encounters }) {
  if (!encounters?.length) return <EmptyState />;
  return (
    <OperationalTable
      ariaLabel="Atendimentos recentes"
      title="Atendimentos recentes"
      subtitle="Histórico ordenável conforme os registros recebidos."
      rows={encounters}
      getRowId={(encounter) => encounter.encounterId}
      initialOrderBy="startDate"
      minWidth={640}
      columns={[
        { id: 'startDate', label: 'Data', sortable: true, render: (encounter) => formatDate(encounter.startDate) },
        { id: 'type', label: 'Tipo', sortable: true },
        { id: 'department', label: 'Departamento', sortable: true },
      ]}
    />
  );
}

function EventsTable({ events }) {
  if (!events?.length) return <EmptyState />;
  return (
    <OperationalTable
      ariaLabel="Eventos clínicos"
      title="Eventos clínicos"
      subtitle="Resultados críticos só são destacados quando sinalizados explicitamente pela fonte."
      rows={events}
      getRowId={(event) => event.eventId}
      initialOrderBy="eventDate"
      minWidth={760}
      columns={[
        { id: 'eventDate', label: 'Data', sortable: true, render: (event) => formatDate(event.eventDate) },
        { id: 'eventCode', label: 'Código', sortable: true },
        { id: 'description', label: 'Descrição', sortable: true, minWidth: 220 },
        { id: 'value', label: 'Valor', sortable: true, render: (event) => [event.value, event.unit].filter(Boolean).join(' ') || 'Não informado' },
      ]}
    />
  );
}

function FhirTab({ state }) {
  if (state.status === 'loading' || state.status === 'idle') return <LoadingState message="Carregando FHIR" />;
  if (state.status === 'error') return <ErrorState message={state.error.message} correlationId={state.error.correlationId} />;
  return <JsonViewer title="Bundle FHIR R4" data={state.data.jsonPayload} />;
}
