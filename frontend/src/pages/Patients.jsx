import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { listPatients } from '../api/patients.js';
import { AccessLevelChip } from '../components/AccessLevelChip.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { formatDate, genderLabel, protectedValue } from '../utils/format.js';

export function Patients() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [query, setQuery] = useState('');

  function load() {
    setState({ status: 'loading', data: null, error: null });
    listPatients()
      .then((data) => setState({ status: 'success', data, error: null }))
      .catch((error) => setState({ status: 'error', data: null, error }));
  }

  useEffect(() => {
    load();
  }, []);

  const patients = state.data?.patients || [];
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return patients;
    return patients.filter((patient) =>
      [patient.patientId, patient.fullName, patient.city, patient.state]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [patients, query]);

  if (state.status === 'loading') return <LoadingState message="Carregando pacientes" />;
  if (state.status === 'error') return <ErrorState message={state.error.message} onRetry={load} />;

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h1">Pacientes</Typography>
          <Typography color="text.secondary">Pacientes disponíveis conforme vínculo e perfil autenticado.</Typography>
        </Box>
        <AccessLevelChip level={state.data?.accessLevel} />
      </Stack>

      {state.data?.accessLevel === 'PARTIAL' ? (
        <Alert severity="warning">Seu acesso é parcial. Identificadores diretos podem estar ausentes.</Alert>
      ) : null}

      <TextField
        label="Buscar por ID, nome ou localidade"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        sx={{ maxWidth: 440 }}
      />

      <Paper>
        {filtered.length === 0 ? (
          <EmptyState title="Nenhum paciente encontrado" />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Paciente</TableCell>
                <TableCell>Nascimento</TableCell>
                <TableCell>Gênero</TableCell>
                <TableCell>Localidade</TableCell>
                <TableCell align="right">Ação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((patient) => (
                <TableRow key={patient.patientId} hover>
                  <TableCell>
                    <Typography fontWeight={700}>{protectedValue(patient.fullName)}</Typography>
                    <Typography variant="caption" color="text.secondary">{patient.patientId}</Typography>
                  </TableCell>
                  <TableCell>{formatDate(patient.birthDate)}</TableCell>
                  <TableCell>{genderLabel(patient.gender)}</TableCell>
                  <TableCell>{[patient.city, patient.state].filter(Boolean).join(' / ') || 'Protegido'}</TableCell>
                  <TableCell align="right">
                    <Button component={RouterLink} to={`/patients/${patient.patientId}`} startIcon={<VisibilityIcon />} size="small">
                      Abrir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}

