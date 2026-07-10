import { Box, Stack, Typography } from '@mui/material';

export function PageHeader({ title, subtitle, actions, eyebrow, icon, meta }) {
  const titleText = typeof title === 'object' && title?.text ? title.text : title;
  const titleIcon = icon || (typeof title === 'object' && title?.icon ? title.icon : null);

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', md: 'center' }}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow ? (
          <Typography variant="caption" color="primary" fontWeight={800} sx={{ textTransform: 'uppercase' }}>
            {eyebrow}
          </Typography>
        ) : null}
        <Stack direction="row" spacing={1.5} alignItems="center">
          {titleIcon}
          <Typography variant="h1" sx={{ overflowWrap: 'anywhere' }}>
            {titleText}
          </Typography>
        </Stack>
        {subtitle ? (
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            {subtitle}
          </Typography>
        ) : null}
        {meta ? <Box sx={{ mt: 1.5 }}>{meta}</Box> : null}
      </Box>
      {actions ? (
        <Box sx={{ flexShrink: 0, width: { xs: '100%', md: 'auto' } }}>
          {actions}
        </Box>
      ) : null}
    </Stack>
  );
}
