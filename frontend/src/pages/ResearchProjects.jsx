import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useSnackbar } from 'notistack';
import { listProjects } from '../api/research.js';
import { ErrorState } from '../components/ErrorState.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { OperationalTable } from '../components/OperationalTable.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { PageToolbar } from '../components/PageToolbar.jsx';
import { formatDate } from '../utils/format.js';

export function ResearchProjects() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
  if (state.status === 'error') return <ErrorState message={state.error.message} correlationId={state.error.correlationId} onRetry={load} />;

  const projects = state.data?.projects || [];
  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesQuery = !normalized || [project.projectId, project.title, project.clinicalCondition]
        .some((value) => value.toLowerCase().includes(normalized));
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [projects, query, statusFilter]);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Projetos de pesquisa"
        subtitle="Projetos disponíveis conforme autorização do backend."
        actions={<Typography aria-live="polite" color="text.secondary" fontWeight={600}>{filteredProjects.length} de {projects.length} projetos</Typography>}
      />

      <PageToolbar>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ flexGrow: 1 }}>
          <TextField
            label="Buscar projeto"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            sx={{ maxWidth: 440, width: '100%' }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
          <TextField select label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="all">Todos</MenuItem>
            <MenuItem value="Aprovado">Aprovado</MenuItem>
            <MenuItem value="Suspenso">Suspenso</MenuItem>
            <MenuItem value="Expirado">Expirado</MenuItem>
          </TextField>
          {(query || statusFilter !== 'all') ? <Button onClick={() => { setQuery(''); setStatusFilter('all'); }}>Limpar filtros</Button> : null}
        </Stack>
      </PageToolbar>

      <OperationalTable
        ariaLabel="Lista de projetos de pesquisa"
        title="Projetos autorizados"
        subtitle="Consulte condição clínica, vigência e situação de cada projeto."
        rows={filteredProjects}
        getRowId={(project) => project.projectId}
        initialOrderBy="project"
        emptyTitle="Nenhum projeto disponível"
        minWidth={840}
        columns={[
          { id: 'project', label: 'Projeto', sortable: true, minWidth: 250, sortValue: (project) => project.title, render: (project) => <Box><Typography fontWeight={700}>{project.title}</Typography><Typography variant="caption" color="text.secondary">{project.projectId}</Typography></Box> },
          { id: 'clinicalCondition', label: 'Condição', sortable: true },
          { id: 'status', label: 'Status', sortable: true, render: (project) => <ProjectStatus status={project.status} /> },
          { id: 'validUntil', label: 'Validade', sortable: true, render: (project) => `${formatDate(project.validFrom)} até ${formatDate(project.validUntil)}` },
          { id: 'action', label: 'Ação', align: 'right', hideable: false, render: (project) => <Button component={RouterLink} to={`/research/projects/${project.projectId}`} startIcon={<VisibilityIcon />} size="small">Abrir</Button> },
        ]}
      />
    </Stack>
  );
}

export function ProjectStatus({ status }) {
  const color = status === 'Aprovado' ? 'success' : status === 'Suspenso' ? 'warning' : 'default';
  return <Chip size="small" label={status} color={color} />;
}
