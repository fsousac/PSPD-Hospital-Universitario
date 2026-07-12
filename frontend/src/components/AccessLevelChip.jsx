import { Chip, Tooltip } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import PublicIcon from '@mui/icons-material/Public';
import QueryStatsIcon from '@mui/icons-material/QueryStats';

const colors = {
  FULL: 'success',
  PARTIAL: 'warning',
  ANONYMIZED: 'info',
  AGGREGATED: 'secondary',
};

const descriptions = {
  FULL: 'Acesso completo aos dados disponíveis para o perfil.',
  PARTIAL: 'Identificadores pessoais foram removidos ou reduzidos.',
  ANONYMIZED: 'Os registros individuais foram pseudonimizados.',
  AGGREGATED: 'Os dados representam estatísticas da população.',
};

const labels = {
  FULL: 'Acesso completo',
  PARTIAL: 'Dados parcialmente ocultos',
  ANONYMIZED: 'Dados anonimizados',
  AGGREGATED: 'Dados agregados',
};

const icons = {
  FULL: <LockOpenIcon fontSize="small" />,
  PARTIAL: <LockIcon fontSize="small" />,
  ANONYMIZED: <PublicIcon fontSize="small" />,
  AGGREGATED: <QueryStatsIcon fontSize="small" />,
};

export function AccessLevelChip({ level }) {
  if (!level) return null;
  return (
    <Tooltip title={descriptions[level] || 'Nível de acesso informado pela fonte de dados.'}>
      <Chip
        size="small"
        icon={icons[level]}
        color={colors[level] || 'default'}
        label={(
          <span>
            <strong>{level}</strong>
            {' · '}
            {labels[level] || 'Nível de acesso'}
          </span>
        )}
        aria-label={`${level}: ${labels[level] || 'Nível de acesso'}`}
      />
    </Tooltip>
  );
}
