import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useSnackbar } from 'notistack';
import { listProjects } from '../api/research.js';
import { EmptyState } from '../components/EmptyState.jsx';
import { DataTableShell } from '../components/DataTableShell.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { formatDate } from '../utils/format.js';

export function ResearchProjects() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const { enqueueSnackbar } = useSnackbar();

  function load() {
    setState({ status: 'loading', data: null, error: null });
    listProjects()
      .then((data) => setState({ status: 'success', data, error: null }))
      .catch((error) => {
        setState({ status: 'error', data: null, error });
        enqueueSnackbar('Não foi possível carregar os projetos de pesquisa.', { variant: 'error' });
      });
  }

  useEffect(() => {
    load();
  }, []);

  if (state.status === 'loading') return <LoadingState message="Carregando projetos" />;
  if (state.status === 'error') return <ErrorState message={state.error.message} onRetry={load} />;

  const projects = state.data?.projects || [];

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Projetos de pesquisa"
        subtitle="Projetos disponíveis conforme autorização do backend."
        actions={<Typography color="text.secondary" fontWeight={600}>{projects.length} projetos</Typography>}
      />

      <DataTableShell
        title="Projetos autorizados"
        subtitle="Consulte condição clínica, vigência e situação de cada projeto."
        minWidth={projects.length ? 820 : 0}
      >
        {projects.length === 0 ? (
          <EmptyState title="Nenhum projeto disponível" />
        ) : (
          <Table aria-label="Lista de projetos de pesquisa">
            <TableHead>
              <TableRow>
                <TableCell>Projeto</TableCell>
                <TableCell>Condição</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Validade</TableCell>
                <TableCell align="right">Ação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.projectId} hover>
                  <TableCell>
                    <Typography fontWeight={700}>{project.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{project.projectId}</Typography>
                  </TableCell>
                  <TableCell>{project.clinicalCondition}</TableCell>
                  <TableCell><ProjectStatus status={project.status} /></TableCell>
                  <TableCell>{formatDate(project.validFrom)} até {formatDate(project.validUntil)}</TableCell>
                  <TableCell align="right">
                    <Button component={RouterLink} to={`/research/projects/${project.projectId}`} startIcon={<VisibilityIcon />} size="small">
                      Abrir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTableShell>
    </Stack>
  );
}

export function ProjectStatus({ status }) {
  const color = status === 'Aprovado' ? 'success' : status === 'Suspenso' ? 'warning' : 'default';
  return <Chip size="small" label={status} color={color} />;
}
