import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GroupsIcon from '@mui/icons-material/Groups';
import ScienceIcon from '@mui/icons-material/Science';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../auth/AuthProvider.jsx';
import { getPrimaryRole, roleLabel, ROLES } from '../auth/roles.js';

const drawerWidth = 248;

export function AppLayout() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const role = getPrimaryRole(user);

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon />, roles: [ROLES.DOCTOR, ROLES.INTERN, ROLES.RESEARCHER] },
    { label: 'Pacientes', path: '/patients', icon: <GroupsIcon />, roles: [ROLES.DOCTOR, ROLES.INTERN] },
    { label: 'Pesquisa', path: '/research/projects', icon: <ScienceIcon />, roles: [ROLES.RESEARCHER] },
  ].filter((item) => item.roles.includes(role));

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" color="inherit" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h2" sx={{ flexGrow: 1 }}>
            HU Observability
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" fontWeight={700}>{user?.displayName}</Typography>
              <Typography variant="caption" color="text.secondary">{roleLabel(role)}</Typography>
            </Box>
            <Button startIcon={<LogoutIcon />} variant="outlined" onClick={logout}>
              Sair
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
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', p: 1.5 }}>
          <List>
            {navItems.map((item) => (
              <ListItemButton
                key={item.path}
                component={RouterLink}
                to={item.path}
                selected={location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)}
                sx={{ borderRadius: 1, mb: 0.5 }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
            A autorização real é aplicada pelo backend.
          </Typography>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: 3 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
