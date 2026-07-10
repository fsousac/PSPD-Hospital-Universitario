import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GroupsIcon from '@mui/icons-material/Groups';
import ScienceIcon from '@mui/icons-material/Science';
import LogoutIcon from '@mui/icons-material/Logout';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { useTheme } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import { useAuth } from '../auth/AuthProvider.jsx';
import { getPrimaryRole, roleLabel, ROLES } from '../auth/roles.js';

const drawerWidth = 248;

export function AppLayout() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const { enqueueSnackbar } = useSnackbar();
  const role = getPrimaryRole(user);

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon />, roles: [ROLES.DOCTOR, ROLES.INTERN, ROLES.RESEARCHER] },
    { label: 'Pacientes', path: '/patients', icon: <GroupsIcon />, roles: [ROLES.DOCTOR, ROLES.INTERN] },
    { label: 'Pesquisa', path: '/research/projects', icon: <ScienceIcon />, roles: [ROLES.RESEARCHER] },
  ].filter((item) => item.roles.includes(role));

  function handleLogout() {
    enqueueSnackbar('Sessão encerrada.', { variant: 'info' });
    logout();
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          backdropFilter: 'blur(12px)',
          bgcolor: 'rgba(255,255,255,0.9)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          zIndex: (appTheme) => appTheme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: { xs: 64, md: 72 } }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexGrow: 1, minWidth: 0 }}>
            <Avatar variant="rounded" sx={{ bgcolor: 'primary.main', height: 40, width: 40 }}>
              HU
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h3" noWrap>
                HU Observability
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                Monitoramento clínico e pesquisa
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2" fontWeight={700}>{user?.displayName}</Typography>
              <Typography variant="caption" color="text.secondary">{roleLabel(role)}</Typography>
            </Box>
            <Button startIcon={<LogoutIcon />} variant="outlined" onClick={handleLogout} size={compact ? 'small' : 'medium'}>
              {compact ? '' : 'Sair'}
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            bgcolor: '#ffffff',
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, md: 72 } }} />
        <Box sx={{ overflow: 'auto', p: 1.5 }}>
          <List>
            {navItems.map((item) => (
              <ListItemButton
                key={item.path}
                component={RouterLink}
                to={item.path}
                selected={location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  '&.Mui-selected': {
                    bgcolor: 'rgba(15, 118, 110, 0.1)',
                    color: 'primary.dark',
                    '& .MuiListItemIcon-root': { color: 'primary.dark' },
                  },
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={1.5} sx={{ px: 1 }}>
            <Chip icon={<VerifiedUserIcon />} label={roleLabel(role)} size="small" color="primary" variant="outlined" />
            <Typography variant="caption" color="text.secondary">
              A autorização real é aplicada pelo backend.
            </Typography>
          </Stack>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, px: { xs: 2, md: 4 }, py: 3 }}>
        <Toolbar sx={{ minHeight: { xs: 64, md: 72 } }} />
        <Box sx={{ maxWidth: 1240, mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
