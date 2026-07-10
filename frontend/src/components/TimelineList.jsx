import { Box, Stack, Typography } from '@mui/material';

export function TimelineList({ items }) {
  return (
    <Stack>
      {items.map((item, index) => (
        <Stack key={item.id || `${item.description}-${item.time}`} direction="row" spacing={1.5} alignItems="stretch">
          <Stack alignItems="center" sx={{ width: 40, flexShrink: 0 }}>
            <Box sx={{ alignItems: 'center', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', borderRadius: 1, color: item.color, display: 'flex', height: 38, justifyContent: 'center', width: 38 }}>
              {item.icon}
            </Box>
            {index < items.length - 1 ? <Box sx={{ bgcolor: 'divider', flexGrow: 1, my: 0.75, width: 1 }} /> : null}
          </Stack>
          <Box sx={{ minWidth: 0, pb: index < items.length - 1 ? 2 : 0 }}>
            <Typography fontWeight={700}>{item.description}</Typography>
            <Typography variant="body2" color="text.secondary">{item.time}</Typography>
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}
