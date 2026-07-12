import { Box, Button, Typography } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';

export function EmptyState({ title = 'Nenhum dado encontrado', description = 'Não há registros para exibir.', actionLabel, onAction, icon }) {
  return (
    <Box sx={{ alignItems: 'center', color: 'text.secondary', display: 'flex', flexDirection: 'column', gap: 1, px: 2, py: { xs: 5, md: 7 }, textAlign: 'center' }}>
      <Box sx={{ alignItems: 'center', bgcolor: 'rgba(71, 85, 105, 0.08)', border: '1px solid', borderColor: 'divider', borderRadius: 1, display: 'flex', height: 52, justifyContent: 'center', width: 52 }}>
        {icon || <InboxIcon />}
      </Box>
      <Typography variant="h3">{title}</Typography>
      <Typography sx={{ maxWidth: 460 }}>{description}</Typography>
      {actionLabel && onAction ? <Button variant="outlined" onClick={onAction} sx={{ mt: 1 }}>{actionLabel}</Button> : null}
    </Box>
  );
}
