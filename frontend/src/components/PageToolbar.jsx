import { Paper, Stack } from '@mui/material';

export function PageToolbar({ children, summary }) {
  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', p: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
        {children}
        {summary}
      </Stack>
    </Paper>
  );
}
