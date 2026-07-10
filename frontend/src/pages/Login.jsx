import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { BrandLockup } from '../components/BrandLockup.jsx';

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
            <BrandLockup />
            <Typography variant="h1" textAlign="center" sx={{ mt: 1 }}>Portal seguro</Typography>
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
