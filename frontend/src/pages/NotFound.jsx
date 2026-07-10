import { Link as RouterLink } from 'react-router-dom';
import { Button, Stack, Typography } from '@mui/material';

export function NotFound() {
  return (
    <Stack spacing={2} sx={{ maxWidth: 720, mx: 'auto', mt: 8 }}>
      <Typography variant="h1">Página não encontrada</Typography>
      <Typography color="text.secondary">A rota solicitada não existe no frontend.</Typography>
      <Button component={RouterLink} to="/dashboard" variant="contained" sx={{ alignSelf: 'flex-start' }}>
        Ir para o dashboard
      </Button>
    </Stack>
  );
}

