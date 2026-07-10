import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';

export function ErrorState({ message = 'Não foi possível carregar os dados.', onRetry }) {
  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', p: { xs: 3, md: 5 } }}>
      <Stack spacing={2} alignItems="center" textAlign="center">
        <Box sx={{ alignItems: 'center', bgcolor: 'rgba(180, 35, 24, 0.08)', borderRadius: 1, color: 'error.main', display: 'flex', height: 52, justifyContent: 'center', width: 52 }}>
          <ErrorOutlineIcon />
        </Box>
        <Box>
          <Typography variant="h3">Não foi possível carregar</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>{message}</Typography>
        </Box>
        {onRetry ? (
          <Button startIcon={<RefreshIcon />} variant="outlined" onClick={onRetry}>
            Tentar novamente
          </Button>
        ) : null}
      </Stack>
    </Paper>
  );
}
