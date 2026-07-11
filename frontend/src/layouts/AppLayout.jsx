import { useState } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import {
  AppBar,
  Avatar,
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
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
  Tooltip,
  useMediaQuery,
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GroupsIcon from '@mui/icons-material/Groups';
import ScienceIcon from '@mui/icons-material/Science';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsIcon from '@mui/icons-material/Settings';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { env } from '../config/env.js';
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
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const { enqueueSnackbar } = useSnackbar();
  const role = getPrimaryRole(user);

  const navGroups = [
    {
      label: 'Visão geral',
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon />, roles: [ROLES.DOCTOR, ROLES.INTERN, ROLES.RESEARCHER] },
      ],
    },
    {
      label: 'Assistência',
      items: [
        { label: 'Pacientes', path: '/patients', icon: <GroupsIcon />, roles: [ROLES.DOCTOR, ROLES.INTERN] },
      ],
    },
    {
      label: 'Pesquisa',
      items: [
        { label: 'Projetos', path: '/research/projects', icon: <ScienceIcon />, roles: [ROLES.RESEARCHER] },
      ],
    },
  ].map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);

  function handleLogout() {
    setUserMenuAnchor(null);
    enqueueSnackbar('Sessão encerrada.', { variant: 'info' });
    logout();
  }

  const initials = (user?.displayName || 'Usuário')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

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
          <Stack direction="row" spacing={{ xs: 1, sm: 2 }} alignItems="center">
            <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2" fontWeight={700}>{user?.displayName}</Typography>
              <Typography variant="caption" color="text.secondary">{roleLabel(role)}</Typography>
            </Box>
            {env.authMode === 'mock' ? <Chip label="Modo mock" size="small" color="info" variant="outlined" sx={{ display: { xs: 'none', md: 'inline-flex' } }} /> : null}
            <IconButton
              aria-label="Abrir menu do usuário"
              aria-controls={userMenuAnchor ? 'user-menu' : undefined}
              aria-haspopup="true"
              onClick={(event) => setUserMenuAnchor(event.currentTarget)}
              sx={{ p: 0.5 }}
            >
              <Avatar sx={{ bgcolor: 'primary.main', height: 40, width: 40 }}>{initials}</Avatar>
            </IconButton>
            <Menu
              id="user-menu"
              anchorEl={userMenuAnchor}
              open={Boolean(userMenuAnchor)}
              onClose={() => setUserMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem disabled><AccountCircleIcon fontSize="small" sx={{ mr: 1 }} />Perfil: {roleLabel(role)}</MenuItem>
              <MenuItem disabled><SettingsIcon fontSize="small" sx={{ mr: 1 }} />Configurações</MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}><LogoutIcon fontSize="small" sx={{ mr: 1 }} />Sair</MenuItem>
            </Menu>
          </Stack>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isDesktop || isTablet ? 'permanent' : 'temporary'}
        open={isDesktop || isTablet || mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: isTablet ? 76 : drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            bgcolor: '#ffffff',
            width: isTablet ? 76 : drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
            boxShadow: isDesktop || isTablet ? 'none' : 8,
          },
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, md: 72 } }} />
        <Box component="nav" aria-label="Navegação principal" sx={{ overflow: 'auto', p: 1.5 }}>
          {navGroups.map((group) => (
            <Box key={group.label} sx={{ mb: 2 }}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: { md: isTablet ? 'none' : 'block', lg: 'block' }, fontWeight: 800, px: 1.5 }}
              >
                {group.label}
              </Typography>
              <List disablePadding>
                {group.items.map((item) => (
                  <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                    <Tooltip title={isTablet ? item.label : ''} placement="right">
                      <ListItemButton
                        component={RouterLink}
                        to={item.path}
                        aria-label={`${group.label}: ${item.label}`}
                        selected={location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)}
                        aria-current={location.pathname === item.path ? 'page' : undefined}
                        onClick={() => setMobileOpen(false)}
                        sx={{
                          borderRadius: 1,
                          justifyContent: isTablet ? 'center' : 'flex-start',
                          px: isTablet ? 1 : 1.5,
                          '&.Mui-selected': {
                            bgcolor: 'rgba(0, 108, 103, 0.1)',
                            color: 'primary.dark',
                            '& .MuiListItemIcon-root': { color: 'primary.dark' },
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: isTablet ? 0 : 40 }}>{item.icon}</ListItemIcon>
                        <ListItemText primary={item.label} sx={{ display: isTablet ? 'none' : 'block' }} />
                      </ListItemButton>
                    </Tooltip>
                  </ListItem>
                ))}
              </List>
            </Box>
          ))}
          <Divider sx={{ my: 2 }} />
          <Stack spacing={1.5} sx={{ px: isTablet ? 0 : 1, alignItems: isTablet ? 'center' : 'stretch' }}>
            <Chip icon={<VerifiedUserIcon />} label={roleLabel(role)} size="small" color="primary" variant="outlined" sx={{ maxWidth: '100%' }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: isTablet ? 'none' : 'block' }}>
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
          width: { xs: '100%', md: `calc(100% - ${isTablet ? 76 : drawerWidth}px)`, lg: `calc(100% - ${drawerWidth}px)` },
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
