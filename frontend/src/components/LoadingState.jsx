import { Box, CircularProgress, Paper, Skeleton, Stack, Typography } from '@mui/material';

export function LoadingState({ message = 'Carregando' }) {
  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden', p: 3 }}>
      <Stack spacing={2.5}>
        <Box sx={{ alignItems: 'center', display: 'flex', gap: 2 }}>
          <CircularProgress size={24} />
          <Typography color="text.secondary" fontWeight={700}>{message}</Typography>
        </Box>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
          {Array.from({ length: 3 }).map((_, index) => (
            <Box key={index} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <Skeleton variant="rounded" height={28} width="65%" />
              <Skeleton variant="text" sx={{ mt: 1 }} />
              <Skeleton variant="text" width="45%" />
            </Box>
          ))}
        </Box>
      </Stack>
    </Paper>
  );
}
