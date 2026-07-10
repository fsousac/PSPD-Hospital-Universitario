import { Chip } from '@mui/material';

const statusConfig = {
  active: { label: 'Ativo', color: 'success' },
  pending: { label: 'Pendente', color: 'warning' },
  critical: { label: 'Crítico', color: 'error' },
};

export function StatusBadge({ status }) {
  const config = statusConfig[status] || { label: status, color: 'default' };
  return <Chip label={config.label} color={config.color} size="small" variant="outlined" />;
}
