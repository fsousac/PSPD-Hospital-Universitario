import { Link as RouterLink } from 'react-router-dom';
import { Alert, Button, Stack, Typography } from '@mui/material';

export function Forbidden() {
  return (
    <Stack spacing={2} sx={{ maxWidth: 720, mx: 'auto', mt: 8 }}>
      <Typography variant="h1">Acesso negado</Typography>
      <Alert severity="warning">Seu perfil não possui permissão visual para esta área.</Alert>
      <Button component={RouterLink} to="/dashboard" variant="contained" sx={{ alignSelf: 'flex-start' }}>
        Voltar ao dashboard
      </Button>
    </Stack>
  );
}

