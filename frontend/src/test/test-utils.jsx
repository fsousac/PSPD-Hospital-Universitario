import { ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AuthProvider } from '../auth/AuthProvider.jsx';
import { AppRoutes } from '../routes/AppRoutes.jsx';
import { theme } from '../theme/theme.js';

export function TestProviders({ children, initialEntries = ['/'] }) {
  return (
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </ThemeProvider>
  );
}

export function renderApp({ route = '/dashboard', profile = 'medico' } = {}) {
  sessionStorage.setItem('hu_mock_profile', profile);

  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}
