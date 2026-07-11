import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Fade,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BiotechIcon from '@mui/icons-material/Biotech';
import CloseIcon from '@mui/icons-material/Close';
import FavoriteIcon from '@mui/icons-material/Favorite';
import HotelIcon from '@mui/icons-material/Hotel';
import InfoIcon from '@mui/icons-material/Info';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PeopleIcon from '@mui/icons-material/People';
import RefreshIcon from '@mui/icons-material/Refresh';
import TodayIcon from '@mui/icons-material/Today';
import VisibilityIcon from '@mui/icons-material/Visibility';
import WarningIcon from '@mui/icons-material/Warning';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useSnackbar } from 'notistack';
import { MetricCard } from '../components/MetricCard.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { SectionPanel } from '../components/SectionPanel.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { TimelineList } from '../components/TimelineList.jsx';

const environmentBannerKey = 'hu_dashboard_environment_banner_closed';

const monthlyAppointments = [
  { month: 'Fev', total: 318 },
  { month: 'Mar', total: 356 },
  { month: 'Abr', total: 402 },
  { month: 'Mai', total: 388 },
  { month: 'Jun', total: 431 },
  { month: 'Jul', total: 467 },
];

const specialtyDistribution = [
  { name: 'Clínica Geral', value: 34, color: '#2563eb' },
  { name: 'Cardiologia', value: 22, color: '#0f766e' },
  { name: 'Pediatria', value: 18, color: '#f59e0b' },
  { name: 'Ortopedia', value: 14, color: '#7c3aed' },
  { name: 'Outros', value: 12, color: '#64748b' },
];

const latestPatients = [
  { id: 'P000001', name: 'João da Silva', age: 54, status: 'active', lastVisit: 'Hoje, 10:30' },
  { id: 'P000005', name: 'Pedro Alves', age: 69, status: 'pending', lastVisit: 'Hoje, 09:45' },
  { id: 'P000009', name: 'Maria Oliveira', age: 42, status: 'active', lastVisit: 'Ontem, 16:20' },
  { id: 'P000012', name: 'Carlos Mendes', age: 61, status: 'critical', lastVisit: 'Ontem, 14:10' },
  { id: 'P000018', name: 'Ana Ribeiro', age: 35, status: 'pending', lastVisit: 'Há 2 dias' },
];

const activities = [
  { icon: <LocalHospitalIcon />, description: 'Dra. Silva realizou consulta com João', time: 'há 10 min', color: 'primary.main' },
  { icon: <BiotechIcon />, description: 'Exame de sangue de Maria finalizado', time: 'há 1h', color: 'success.main' },
  { icon: <WarningIcon />, description: 'Alerta: Pressão alta de Carlos', time: 'há 2h', color: 'error.main' },
  { icon: <FavoriteIcon />, description: 'Retorno cardiológico registrado para Ana', time: 'há 3h', color: 'warning.main' },
  { icon: <AssessmentIcon />, description: 'Relatório diário de atendimentos atualizado', time: 'há 4h', color: 'info.main' },
];

export function Dashboard() {
  const { enqueueSnackbar } = useSnackbar();
  const [showEnvironmentBanner, setShowEnvironmentBanner] = useState(
    () => localStorage.getItem(environmentBannerKey) !== 'true',
  );

  function closeEnvironmentBanner() {
    localStorage.setItem(environmentBannerKey, 'true');
    setShowEnvironmentBanner(false);
  }

  function refreshData() {
    enqueueSnackbar('Dados mockados atualizados para demonstração.', { variant: 'success' });
  }

  return (
    <Fade in timeout={280}>
      <Stack spacing={3}>
        {showEnvironmentBanner ? (
          <Alert
            severity="info"
            icon={<InfoIcon />}
            action={(
              <IconButton color="inherit" size="small" aria-label="Fechar aviso" onClick={closeEnvironmentBanner}>
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          >
            Ambiente de desenvolvimento - Dados mockados
          </Alert>
        ) : null}

        <PageHeader
          title="Dashboard"
          icon={<AssessmentIcon color="primary" fontSize="large" />}
          subtitle="Visão geral dos atendimentos e pacientes"
          actions={(
            <Button startIcon={<RefreshIcon />} variant="contained" onClick={refreshData}>
              Atualizar dados
            </Button>
          )}
        />

        <Alert severity="error" variant="outlined" icon={<WarningIcon />}>
          <AlertTitle>Requer atenção clínica</AlertTitle>
          Existem 3 alertas críticos sinalizados nos dados de demonstração. Confirme os registros no sistema assistencial oficial.
        </Alert>

        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' } }}>
          <MetricCard title="Pacientes Totais" value="1.284" trend="+12%" description="Em acompanhamento no período." color="primary" icon={<PeopleIcon />} />
          <MetricCard title="Atendimentos Hoje" value="47" trend="+8%" description="Consultas e retornos registrados." color="success" icon={<TodayIcon />} />
          <MetricCard title="Alertas Críticos" value="3" trend="-2" description="Sinalizados pela fonte clínica." color="error" icon={<WarningIcon />} />
          <MetricCard title="Taxa de Ocupação" value="78%" description="Capacidade operacional utilizada." color="warning" icon={<HotelIcon />} progress={78} />
        </Box>

        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' } }}>
          <SectionPanel title="Atendimentos por Mês" subtitle="Volume de atendimentos nos últimos 6 meses" hover>
            <Box sx={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={260}>
                <BarChart data={monthlyAppointments} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="appointmentsGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.72} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => [`${value} atendimentos`, 'Total']} />
                  <Bar dataKey="total" fill="url(#appointmentsGradient)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </SectionPanel>

          <SectionPanel title="Distribuição por Especialidade" subtitle="Participação percentual por área" hover>
            <Box sx={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={260}>
                <PieChart>
                  <Pie data={specialtyDistribution} dataKey="value" nameKey="name" innerRadius={64} outerRadius={104} paddingAngle={3}>
                    {specialtyDistribution.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}%`, 'Participação']} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
            <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
              {specialtyDistribution.map((item) => (
                <Stack key={item.name} direction="row" spacing={1} alignItems="center">
                  <Box sx={{ bgcolor: item.color, borderRadius: 999, height: 10, width: 10 }} />
                  <Typography variant="body2" color="text.secondary">{item.name}</Typography>
                  <Typography variant="body2" fontWeight={800}>{item.value}%</Typography>
                </Stack>
              ))}
            </Box>
          </SectionPanel>
        </Box>

        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', xl: '1.5fr 1fr' } }}>
          <SectionPanel title="Últimos Pacientes" subtitle="Pacientes com movimentações recentes">
            <Box sx={{ maxWidth: '100%', overflowX: 'auto' }}>
            <Table aria-label="Últimos pacientes" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Idade</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Último Atendimento</TableCell>
                  <TableCell align="right">Ação</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {latestPatients.map((patient) => (
                  <TableRow key={patient.id} hover>
                    <TableCell>
                      <Typography fontWeight={800}>{patient.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{patient.id}</Typography>
                    </TableCell>
                    <TableCell>{patient.age}</TableCell>
                    <TableCell><StatusBadge status={patient.status} /></TableCell>
                    <TableCell>{patient.lastVisit}</TableCell>
                    <TableCell align="right">
                      <Button component={RouterLink} to={`/patients/${patient.id}`} startIcon={<VisibilityIcon />} size="small">
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} align="right">
                    <Button component={RouterLink} to="/patients" size="small">
                      Ver todos os pacientes
                    </Button>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            </Box>
          </SectionPanel>

          <SectionPanel title="Feed de Atividades" subtitle="Últimas ações registradas no ambiente mockado">
            <TimelineList items={activities} />
          </SectionPanel>
        </Box>
      </Stack>
    </Fade>
  );
}
