import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useSnackbar } from 'notistack';
import { listPatients } from '../api/patients.js';
import { AccessLevelChip } from '../components/AccessLevelChip.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { OperationalTable } from '../components/OperationalTable.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { PageToolbar } from '../components/PageToolbar.jsx';
import { formatDate, genderLabel, protectedValue } from '../utils/format.js';

export function Patients() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [query, setQuery] = useState('');
  const [gender, setGender] = useState('all');
  const [location, setLocation] = useState('all');
  const { enqueueSnackbar } = useSnackbar();

  function load() {
    setState({ status: 'loading', data: null, error: null });
    listPatients()
      .then((data) => setState({ status: 'success', data, error: null }))
      .catch((error) => {
        setState({ status: 'error', data: null, error });
        enqueueSnackbar('Não foi possível carregar a lista de pacientes.', { variant: 'error' });
      });
  }

  useEffect(() => {
    load();
  }, []);

  const patients = state.data?.patients || [];
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return patients.filter((patient) => {
      const matchesQuery = !normalized || [patient.patientId, patient.fullName, patient.city, patient.state]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized));
      const matchesGender = gender === 'all' || patient.gender === gender;
      const matchesLocation = location === 'all' || patient.state === location;
      return matchesQuery && matchesGender && matchesLocation;
    });
  }, [gender, location, patients, query]);

  if (state.status === 'loading') return <LoadingState message="Carregando pacientes" />;
  if (state.status === 'error') return <ErrorState message={state.error.message} correlationId={state.error.correlationId} onRetry={load} />;

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Pacientes"
        subtitle="Pacientes disponíveis conforme vínculo e perfil autenticado."
        actions={<AccessLevelChip level={state.data?.accessLevel} />}
      />

      {state.data?.accessLevel === 'PARTIAL' ? (
        <Alert severity="warning">Seu acesso é parcial. Identificadores diretos podem estar ausentes.</Alert>
      ) : null}

      <PageToolbar
        summary={(
          <Typography aria-live="polite" color="text.secondary" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>
            {filtered.length} de {patients.length} pacientes
          </Typography>
        )}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ flexGrow: 1 }}>
          <TextField
            label="Buscar por ID, nome ou localidade"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            sx={{ maxWidth: 460, width: '100%' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <TextField select label="Gênero" value={gender} onChange={(event) => setGender(event.target.value)} sx={{ minWidth: 150 }}>
            <MenuItem value="all">Todos</MenuItem>
            <MenuItem value="male">Masculino</MenuItem>
            <MenuItem value="female">Feminino</MenuItem>
            <MenuItem value="other">Outro</MenuItem>
          </TextField>
          <TextField select label="UF" value={location} onChange={(event) => setLocation(event.target.value)} sx={{ minWidth: 110 }}>
            <MenuItem value="all">Todas</MenuItem>
            {[...new Set(patients.map((patient) => patient.state).filter(Boolean))].map((state) => <MenuItem key={state} value={state}>{state}</MenuItem>)}
          </TextField>
          {(query || gender !== 'all' || location !== 'all') ? (
            <Button onClick={() => { setQuery(''); setGender('all'); setLocation('all'); }}>Limpar filtros</Button>
          ) : null}
        </Stack>
      </PageToolbar>

      <OperationalTable
        ariaLabel="Lista de pacientes"
        title="Pacientes vinculados"
        subtitle="Ordene, filtre e ajuste as colunas conforme a tarefa clínica."
        rows={filtered}
        getRowId={(patient) => patient.patientId}
        initialOrderBy="patient"
        emptyTitle="Nenhum paciente encontrado"
        columns={[
          { id: 'patient', label: 'Paciente', sortable: true, minWidth: 220, sortValue: (patient) => patient.fullName, render: (patient) => <Box><Typography fontWeight={700}>{protectedValue(patient.fullName)}</Typography><Typography variant="caption" color="text.secondary">{patient.patientId}</Typography></Box> },
          { id: 'birthDate', label: 'Nascimento', sortable: true, render: (patient) => formatDate(patient.birthDate) },
          { id: 'gender', label: 'Gênero', sortable: true, render: (patient) => genderLabel(patient.gender) },
          { id: 'location', label: 'Localidade', sortable: true, sortValue: (patient) => `${patient.state || ''}${patient.city || ''}`, render: (patient) => [patient.city, patient.state].filter(Boolean).join(' / ') || 'Protegido' },
          { id: 'action', label: 'Ação', align: 'right', hideable: false, render: (patient) => <Button component={RouterLink} to={`/patients/${patient.patientId}`} startIcon={<VisibilityIcon />} size="small">Abrir</Button> },
        ]}
      />
    </Stack>
  );
}
