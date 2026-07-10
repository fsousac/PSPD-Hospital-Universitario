import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import ScienceIcon from '@mui/icons-material/Science';
import { getPrimaryRole, roleLabel, ROLES } from '../auth/roles.js';
import { useAuth } from '../auth/AuthProvider.jsx';

export function Dashboard() {
  const { user, login } = useAuth();
  const role = getPrimaryRole(user);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
        <BoxTitle title="Dashboard" subtitle={`${user?.displayName} · ${roleLabel(role)}`} />
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => login('medico')}>Médico</Button>
          <Button variant="outlined" onClick={() => login('estagiario')}>Estagiário</Button>
          <Button variant="outlined" onClick={() => login('pesquisador')}>Pesquisador</Button>
        </Stack>
      </Stack>

      <Alert severity="info">
        Ambiente preparado para mocks enquanto a API Gateway REST não está implementada.
      </Alert>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
        {[ROLES.DOCTOR, ROLES.INTERN].includes(role) ? (
          <Box>
            <Paper sx={{ p: 3 }}>
              <Stack spacing={2}>
                <GroupsIcon color="primary" />
                <Typography variant="h3">Pacientes vinculados</Typography>
                <Typography color="text.secondary">Acesse lista, resumo clínico, atendimentos, eventos e FHIR JSON.</Typography>
                <Button component={RouterLink} to="/patients" variant="contained" sx={{ alignSelf: 'flex-start' }}>
                  Abrir pacientes
                </Button>
              </Stack>
            </Paper>
          </Box>
        ) : null}
        {role === ROLES.RESEARCHER ? (
          <Box>
            <Paper sx={{ p: 3 }}>
              <Stack spacing={2}>
                <ScienceIcon color="primary" />
                <Typography variant="h3">Projetos de pesquisa</Typography>
                <Typography color="text.secondary">Consulte projetos, coortes pseudonimizadas e estatísticas agregadas.</Typography>
                <Button component={RouterLink} to="/research/projects" variant="contained" sx={{ alignSelf: 'flex-start' }}>
                  Abrir pesquisa
                </Button>
              </Stack>
            </Paper>
          </Box>
        ) : null}
      </Box>
    </Stack>
  );
}

function BoxTitle({ title, subtitle }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="h1">{title}</Typography>
      <Typography color="text.secondary">{subtitle}</Typography>
    </Stack>
  );
}
