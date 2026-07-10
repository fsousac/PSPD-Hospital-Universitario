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
    <Box
      sx={{
        alignItems: 'center',
        bgcolor: 'background.default',
        display: 'flex',
        minHeight: '100vh',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          maxWidth: 420,
          p: 4,
          width: '100%',
        }}
        elevation={0}
      >
        <Stack spacing={3}>
          <Stack spacing={1} alignItems="center">
            <Box sx={{ alignItems: 'center', bgcolor: 'rgba(15, 118, 110, 0.1)', borderRadius: 1, color: 'primary.main', display: 'flex', height: 56, justifyContent: 'center', width: 56 }}>
              <LocalHospitalIcon sx={{ fontSize: 34 }} />
            </Box>
            <Typography variant="h1" textAlign="center">HU Observability</Typography>
            <Typography color="text.secondary" textAlign="center">
              Acesso clínico e pesquisa com perfis controlados.
            </Typography>
          </Stack>
          <Button variant="contained" size="large" onClick={() => login()}>
            Entrar com Keycloak
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
