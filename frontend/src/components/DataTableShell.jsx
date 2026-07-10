import { Box, Paper, Stack, Typography } from '@mui/material';

export function DataTableShell({ title, subtitle, actions, children, minWidth = 720 }) {
  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
      {title || subtitle || actions ? (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          sx={{ borderBottom: '1px solid', borderColor: 'divider', px: { xs: 2, sm: 3 }, py: 2.25 }}
        >
          <Box sx={{ minWidth: 0 }}>
            {title ? <Typography variant="h3">{title}</Typography> : null}
            {subtitle ? <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{subtitle}</Typography> : null}
          </Box>
          {actions ? <Box sx={{ flexShrink: 0 }}>{actions}</Box> : null}
        </Stack>
      ) : null}
      <Box sx={{ maxWidth: '100%', overflowX: 'auto' }}>
        <Box sx={{ minWidth }}>{children}</Box>
      </Box>
    </Paper>
  );
}
