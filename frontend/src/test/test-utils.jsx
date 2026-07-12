import { ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { SnackbarProvider } from 'notistack';
import { AuthProvider } from '../auth/AuthProvider.jsx';
import { AppRoutes } from '../routes/AppRoutes.jsx';
import { theme } from '../theme/theme.js';

export function TestProviders({ children, initialEntries = ['/'] }) {
  return (
    <ThemeProvider theme={theme}>
      <SnackbarProvider maxSnack={3}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export function renderApp({ route = '/dashboard', profile = 'medico' } = {}) {
  sessionStorage.setItem('hu_mock_profile', profile);

  return render(
    <ThemeProvider theme={theme}>
      <SnackbarProvider maxSnack={3}>
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      </SnackbarProvider>
    </ThemeProvider>,
  );
}
