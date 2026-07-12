import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-700.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.jsx';
import { AppErrorBoundary } from './components/AppErrorBoundary.jsx';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { theme } from './theme/theme.js';
import { env } from './config/env.js';
import { reportApplicationError, startPerformanceMonitoring } from './observability/telemetry.js';

startPerformanceMonitoring();
window.addEventListener('error', () => reportApplicationError('runtime'));
window.addEventListener('unhandledrejection', () => reportApplicationError('promise'));

async function enableMocks() {
  if (!env.enableMocks) {
    return;
  }
  const { worker } = await import('./mocks/browser.js');
  await worker.start({
    onUnhandledRequest: 'bypass',
  });
}

enableMocks().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider maxSnack={3} autoHideDuration={3500} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
          <AppErrorBoundary>
            {/* BASE_URL do Vite sempre termina em "/" (ex. "/grupo10/"); sem
                remover a barra, o Router não casa a URL sem barra final
                (ex. "/grupo10") e não renderiza nada. */}
            <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <AuthProvider>
                <App />
              </AuthProvider>
            </BrowserRouter>
          </AppErrorBoundary>
        </SnackbarProvider>
      </ThemeProvider>
    </React.StrictMode>,
  );
});
