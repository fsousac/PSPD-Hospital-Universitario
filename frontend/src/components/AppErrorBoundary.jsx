import { Component } from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { reportApplicationError } from '../observability/telemetry.js';

export class AppErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    reportApplicationError('render');
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Box sx={{ alignItems: 'center', bgcolor: 'background.default', display: 'flex', minHeight: '100vh', justifyContent: 'center', p: 2 }}>
        <Paper elevation={0} role="alert" sx={{ border: '1px solid', borderColor: 'divider', maxWidth: 520, p: 4, textAlign: 'center' }}>
          <Stack spacing={2} alignItems="center">
            <ErrorOutlineIcon color="error" sx={{ fontSize: 48 }} />
            <Typography variant="h1">Aplicação indisponível</Typography>
            <Typography color="text.secondary">Ocorreu uma falha inesperada. Nenhum dado clínico foi incluído no registro técnico.</Typography>
            <Button variant="contained" onClick={() => window.location.reload()}>Recarregar aplicação</Button>
          </Stack>
        </Paper>
      </Box>
    );
  }
}
