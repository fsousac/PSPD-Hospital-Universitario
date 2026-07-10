import { Box, Typography } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';

export function EmptyState({ title = 'Nenhum dado encontrado', description = 'Não há registros para exibir.' }) {
  return (
    <Box sx={{ alignItems: 'center', color: 'text.secondary', display: 'flex', flexDirection: 'column', gap: 1, px: 2, py: 7, textAlign: 'center' }}>
      <Box sx={{ alignItems: 'center', bgcolor: 'rgba(71, 85, 105, 0.1)', borderRadius: 1, display: 'flex', height: 48, justifyContent: 'center', width: 48 }}>
        <InboxIcon />
      </Box>
      <Typography variant="h3">{title}</Typography>
      <Typography>{description}</Typography>
    </Box>
  );
}
