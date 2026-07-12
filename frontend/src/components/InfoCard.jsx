import { Box, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

export function InfoCard({ label, value, icon, color = 'primary' }) {
  const theme = useTheme();
  const accent = theme.palette[color]?.main || theme.palette.primary.main;

  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', p: 2.25 }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        {icon ? (
          <Box sx={{ alignItems: 'center', bgcolor: alpha(accent, 0.1), borderRadius: 1, color: accent, display: 'flex', flexShrink: 0, height: 40, justifyContent: 'center', width: 40 }}>
            {icon}
          </Box>
        ) : null}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>{label}</Typography>
          <Typography fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>{value}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
