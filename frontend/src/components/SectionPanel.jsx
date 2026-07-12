import { Box, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

export function SectionPanel({ title, subtitle, actions, children, hover = false }) {
  const theme = useTheme();

  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        height: '100%',
        overflow: 'hidden',
        p: 3,
        transition: 'box-shadow 160ms ease, transform 160ms ease, border-color 160ms ease',
        ...(hover
          ? {
              '&:hover': {
                borderColor: alpha(theme.palette.primary.main, 0.28),
                boxShadow: `0 16px 40px ${alpha(theme.palette.primary.main, 0.12)}`,
                transform: 'translateY(-2px)',
              },
            }
          : {}),
      }}
    >
      <Stack spacing={2.5}>
        {(title || subtitle || actions) ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Box sx={{ minWidth: 0 }}>
              {title ? <Typography variant="h3">{title}</Typography> : null}
              {subtitle ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {subtitle}
                </Typography>
              ) : null}
            </Box>
            {actions ? <Box sx={{ flexShrink: 0 }}>{actions}</Box> : null}
          </Stack>
        ) : null}
        {children}
      </Stack>
    </Paper>
  );
}
