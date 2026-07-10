import { Chip } from '@mui/material';

const colors = {
  FULL: 'success',
  PARTIAL: 'warning',
  ANONYMIZED: 'info',
  AGGREGATED: 'secondary',
};

export function AccessLevelChip({ level }) {
  if (!level) return null;
  return <Chip size="small" label={level} color={colors[level] || 'default'} />;
}

