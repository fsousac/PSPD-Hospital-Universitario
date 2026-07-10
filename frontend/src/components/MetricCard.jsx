import { Box, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

export function MetricCard({ title, value, description, icon, color = 'primary', trend, progress }) {
  const theme = useTheme();
  const metricColor = theme.palette[color]?.main || color;
  const trendColor = trend?.tone === 'down' ? 'error.main' : 'success.main';

  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        height: '100%',
        p: 2.5,
        transition: 'box-shadow 160ms ease, transform 160ms ease, border-color 160ms ease',
        '&:hover': {
          borderColor: alpha(metricColor, 0.35),
          boxShadow: `0 14px 36px ${alpha(metricColor, 0.14)}`,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={700}>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={800} sx={{ mt: 0.75, overflowWrap: 'anywhere' }}>
              {value}
            </Typography>
          </Box>
          {icon ? (
            <Stack
              alignItems="center"
              justifyContent="center"
              sx={{
                bgcolor: alpha(metricColor, 0.12),
                borderRadius: 1,
                color: metricColor,
                flexShrink: 0,
                height: 44,
                width: 44,
              }}
            >
              {icon}
            </Stack>
          ) : null}
        </Stack>
        {trend ? (
          <Typography variant="body2" color={trendColor} fontWeight={800}>
            {trend}
          </Typography>
        ) : null}
        {typeof progress === 'number' ? (
          <Box>
            <LinearProgress
              aria-label={`${title}: ${progress}%`}
              variant="determinate"
              value={progress}
              sx={{
                bgcolor: alpha(metricColor, 0.14),
                borderRadius: 999,
                height: 8,
                '& .MuiLinearProgress-bar': {
                  bgcolor: metricColor,
                  borderRadius: 999,
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
              {progress}% da capacidade operacional
            </Typography>
          </Box>
        ) : null}
        {description ? (
          <Typography color="text.secondary" variant="body2">
            {description}
          </Typography>
        ) : null}
      </Stack>
    </Paper>
  );
}
