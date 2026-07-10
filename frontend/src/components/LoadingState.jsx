import { Box, CircularProgress, Typography } from '@mui/material';

export function LoadingState({ message = 'Carregando' }) {
  return (
    <Box sx={{ alignItems: 'center', display: 'flex', gap: 2, minHeight: 160, justifyContent: 'center' }}>
      <CircularProgress size={28} />
      <Typography color="text.secondary">{message}</Typography>
    </Box>
  );
}

