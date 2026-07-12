import { Box, Stack, Typography } from '@mui/material';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';

export function BrandLockup({ compact = false, inverse = false }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" aria-label="HU Observability">
      <Box
        aria-hidden="true"
        sx={{
          alignItems: 'center',
          bgcolor: inverse ? 'common.white' : 'primary.main',
          borderRadius: 1,
          color: inverse ? 'primary.main' : 'common.white',
          display: 'flex',
          flexShrink: 0,
          height: 42,
          justifyContent: 'center',
          width: 42,
        }}
      >
        <LocalHospitalIcon />
      </Box>
      {!compact ? (
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h3" component="span" color={inverse ? 'common.white' : 'text.primary'} noWrap>
            HU Observability
          </Typography>
          <Typography variant="caption" component="span" color={inverse ? 'rgba(255,255,255,0.78)' : 'text.secondary'} display="block" noWrap>
            Inteligência clínica segura
          </Typography>
        </Box>
      ) : null}
    </Stack>
  );
}
