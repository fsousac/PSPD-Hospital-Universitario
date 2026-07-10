import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useSnackbar } from 'notistack';

export function JsonViewer({ data, title = 'JSON' }) {
  const { enqueueSnackbar } = useSnackbar();
  const content = JSON.stringify(data, null, 2);

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(content);
      enqueueSnackbar('JSON copiado.', { variant: 'success' });
    } catch {
      enqueueSnackbar('Não foi possível copiar o JSON.', { variant: 'error' });
    }
  }

  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2, py: 1.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={800}>{title}</Typography>
        <Button startIcon={<ContentCopyIcon />} size="small" onClick={copyJson}>Copiar</Button>
      </Stack>
      <Box component="pre" sx={{ bgcolor: '#101827', color: '#e5edf7', m: 0, maxHeight: { xs: 420, md: 620 }, overflow: 'auto', p: { xs: 2, md: 3 }, fontFamily: 'monospace', fontSize: { xs: 12, sm: 13 }, lineHeight: 1.65, whiteSpace: 'pre' }}>
        {content}
      </Box>
    </Paper>
  );
}
