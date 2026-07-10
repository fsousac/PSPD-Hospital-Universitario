import { Alert, Button, Paper, Stack } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

export function ErrorState({ message = 'Não foi possível carregar os dados.', onRetry }) {
  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', p: 2 }}>
      <Stack spacing={2}>
        <Alert severity="error">{message}</Alert>
        {onRetry ? (
          <Button startIcon={<RefreshIcon />} variant="outlined" onClick={onRetry} sx={{ alignSelf: 'flex-start' }}>
            Tentar novamente
          </Button>
        ) : null}
      </Stack>
    </Paper>
  );
}
