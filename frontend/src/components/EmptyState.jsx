import { Box, Typography } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';

export function EmptyState({ title = 'Nenhum dado encontrado', description = 'Não há registros para exibir.' }) {
  return (
    <Box sx={{ alignItems: 'center', color: 'text.secondary', display: 'flex', flexDirection: 'column', gap: 1, py: 6 }}>
      <InboxIcon fontSize="large" />
      <Typography variant="h3">{title}</Typography>
      <Typography>{description}</Typography>
    </Box>
  );
}

