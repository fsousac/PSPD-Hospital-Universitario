import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';

export function Login() {
  const { isAuthenticated, login } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Box sx={{ alignItems: 'center', display: 'flex', minHeight: '100vh', justifyContent: 'center', p: 2 }}>
      <Paper sx={{ maxWidth: 420, p: 4, width: '100%' }} elevation={1}>
        <Stack spacing={3}>
          <Stack spacing={1} alignItems="center">
            <LocalHospitalIcon color="primary" sx={{ fontSize: 44 }} />
            <Typography variant="h1" textAlign="center">HU Observability</Typography>
          </Stack>
          <Button variant="contained" size="large" onClick={() => login()}>
            Entrar com Keycloak
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

