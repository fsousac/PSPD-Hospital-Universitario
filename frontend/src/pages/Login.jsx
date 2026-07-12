import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SecurityIcon from '@mui/icons-material/Security';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { BrandLockup } from '../components/BrandLockup.jsx';
import { env } from '../config/env.js';

export function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const isMockMode = env.authMode === 'mock';

  if (isAuthenticated && !isMockMode) {
    return <Navigate to="/dashboard" replace />;
  }

  function enterSystem() {
    login();
    if (isMockMode) {
      navigate('/dashboard');
    }
  }

  return (
    <Box
      sx={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #eef7f6 48%, #eaf2ff 100%)',
        display: 'flex',
        minHeight: '100vh',
        p: { xs: 2, md: 4 },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 3, lg: 5 },
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 0.95fr) minmax(460px, 0.75fr)' },
          m: 'auto',
          maxWidth: 1180,
          width: '100%',
        }}
      >
        <Stack spacing={4} justifyContent="center">
          <Stack spacing={2.5}>
            <BrandLockup />
            <Chip
              icon={<SecurityIcon />}
              label="Sistema hospitalar interno"
              color="primary"
              variant="outlined"
              sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(255,255,255,0.72)' }}
            />
            <Box>
              <Typography
                component="h1"
                sx={{
                  color: 'primary.dark',
                  fontSize: { xs: 36, md: 52 },
                  fontWeight: 900,
                  lineHeight: 1.05,
                  maxWidth: 760,
                }}
              >
                Observabilidade clínica com segurança por perfil
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: { xs: 17, md: 19 }, mt: 2, maxWidth: 680 }}>
                Portal institucional para assistência clínica, estágio supervisionado e pesquisa com dados HL7/FHIR protegidos por níveis de acesso.
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' } }}>
            {[
              ['FULL', 'Prontuário completo autorizado'],
              ['PARTIAL', 'Identificadores clínicos protegidos'],
              ['AGGREGATED', 'Pesquisa sem dados diretos'],
            ].map(([level, label]) => (
              <Paper key={level} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', p: 2.25 }}>
                <Typography color="primary.dark" fontWeight={900}>{level}</Typography>
                <Typography color="text.secondary" variant="body2" sx={{ mt: 0.75 }}>{label}</Typography>
              </Paper>
            ))}
          </Box>
        </Stack>

        <Paper
          sx={{
            alignSelf: 'center',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 24px 70px rgba(15, 23, 42, 0.14)',
            p: { xs: 3, sm: 4 },
            width: '100%',
          }}
          elevation={0}
        >
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography variant="h1">Acessar ambiente</Typography>
              <Typography color="text.secondary">
                Entrada única para usuários autenticados. Identidade, perfil e permissões são definidos pelo provedor institucional e validados pelos serviços do hospital.
              </Typography>
            </Stack>

            <Button
              endIcon={<ArrowForwardIcon />}
              fullWidth
              onClick={enterSystem}
              size="large"
              variant="contained"
            >
              Entrar no sistema
            </Button>

            <Divider />

            <Typography variant="caption" color="text.secondary">
              O acesso é auditado e limitado conforme o perfil autorizado para cada usuário.
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
