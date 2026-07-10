import { useState } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
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
import MenuIcon from '@mui/icons-material/Menu';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { useTheme } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import { useAuth } from '../auth/AuthProvider.jsx';
import { getPrimaryRole, roleLabel, ROLES } from '../auth/roles.js';
import { BrandLockup } from '../components/BrandLockup.jsx';
import { RouteAnnouncer } from '../components/RouteAnnouncer.jsx';
import { brandTokens } from '../theme/tokens.js';

const drawerWidth = brandTokens.layout.drawerWidth;

export function AppLayout() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [mobileOpen, setMobileOpen] = useState(false);
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
      <Box
        component="a"
        href="#main-content"
        sx={{
          bgcolor: 'primary.dark',
          color: 'common.white',
          left: 16,
          px: 2,
          py: 1.5,
          position: 'fixed',
          top: -80,
          zIndex: (appTheme) => appTheme.zIndex.tooltip + 1,
          '&:focus': { top: 12 },
        }}
      >
        Ir para o conteúdo principal
      </Box>
      <RouteAnnouncer />
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          backdropFilter: 'blur(12px)',
          bgcolor: 'rgba(255,255,255,0.9)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          zIndex: (appTheme) => appTheme.zIndex.drawer + (isDesktop ? 1 : 0),
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: { xs: 64, md: 72 } }}>
          <IconButton
            aria-label="Abrir menu de navegação"
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ display: { lg: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexGrow: 1, minWidth: 0 }}>
            <BrandLockup compact={false} />
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2" fontWeight={700}>{user?.displayName}</Typography>
              <Typography variant="caption" color="text.secondary">{roleLabel(role)}</Typography>
            </Box>
            <Button aria-label="Sair da aplicação" startIcon={<LogoutIcon />} variant="outlined" onClick={handleLogout} size="small">
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Sair</Box>
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isDesktop ? 'permanent' : 'temporary'}
        open={isDesktop || mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            bgcolor: '#ffffff',
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
            boxShadow: isDesktop ? 'none' : 8,
          },
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, md: 72 } }} />
        <Box component="nav" aria-label="Navegação principal" sx={{ overflow: 'auto', p: 1.5 }}>
          <List disablePadding>
            {navItems.map((item) => (
              <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  component={RouterLink}
                  to={item.path}
                  selected={location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)}
                  aria-current={location.pathname === item.path ? 'page' : undefined}
                  onClick={() => setMobileOpen(false)}
                  sx={{
                    borderRadius: 1,
                    '&.Mui-selected': {
                      bgcolor: 'rgba(0, 108, 103, 0.1)',
                      color: 'primary.dark',
                      '& .MuiListItemIcon-root': { color: 'primary.dark' },
                    },
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
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

      <Box
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{
          flexGrow: 1,
          minWidth: 0,
          px: { xs: 2, sm: 3, lg: 4 },
          py: { xs: 2, md: 3 },
          width: { xs: '100%', lg: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, md: 72 } }} />
        <Box sx={{ maxWidth: brandTokens.layout.contentMaxWidth, mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
