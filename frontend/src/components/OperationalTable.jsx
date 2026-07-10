import { useMemo, useState } from 'react';
import {
  Box,
  Checkbox,
  FormControlLabel,
  IconButton,
  Menu,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import DensityMediumIcon from '@mui/icons-material/DensityMedium';
import DensitySmallIcon from '@mui/icons-material/DensitySmall';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import { DataTableShell } from './DataTableShell.jsx';
import { EmptyState } from './EmptyState.jsx';

function compareValues(a, b) {
  if (a == null) return 1;
  if (b == null) return -1;
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
}

export function OperationalTable({
  ariaLabel,
  columns,
  rows,
  getRowId,
  title,
  subtitle,
  emptyTitle = 'Nenhum registro encontrado',
  initialOrderBy,
  minWidth = 760,
}) {
  const [orderBy, setOrderBy] = useState(initialOrderBy || columns.find((column) => column.sortable)?.id || '');
  const [order, setOrder] = useState('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [density, setDensity] = useState('comfortable');
  const [columnAnchor, setColumnAnchor] = useState(null);
  const [visibleColumnIds, setVisibleColumnIds] = useState(() => columns.map((column) => column.id));

  const visibleColumns = columns.filter((column) => visibleColumnIds.includes(column.id));
  const sortedRows = useMemo(() => {
    if (!orderBy) return rows;
    const column = columns.find((item) => item.id === orderBy);
    if (!column) return rows;
    const direction = order === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const aValue = column.sortValue ? column.sortValue(a) : a[column.id];
      const bValue = column.sortValue ? column.sortValue(b) : b[column.id];
      return compareValues(aValue, bValue) * direction;
    });
  }, [columns, order, orderBy, rows]);
  const paginatedRows = sortedRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  function handleSort(columnId) {
    setOrder(orderBy === columnId && order === 'asc' ? 'desc' : 'asc');
    setOrderBy(columnId);
  }

  function toggleColumn(columnId) {
    setVisibleColumnIds((current) => (
      current.includes(columnId) ? current.filter((id) => id !== columnId) : [...current, columnId]
    ));
  }

  const controls = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Densidade da tabela">
        <ToggleButtonGroup
          exclusive
          size="small"
          value={density}
          onChange={(_, value) => value && setDensity(value)}
          aria-label="Densidade da tabela"
        >
          <ToggleButton value="comfortable" aria-label="Densidade confortável"><DensityMediumIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="compact" aria-label="Densidade compacta"><DensitySmallIcon fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>
      </Tooltip>
      <Tooltip title="Configurar colunas">
        <IconButton aria-label="Configurar colunas" onClick={(event) => setColumnAnchor(event.currentTarget)}>
          <ViewColumnIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={columnAnchor} open={Boolean(columnAnchor)} onClose={() => setColumnAnchor(null)}>
        {columns.map((column) => (
          <Box key={column.id} sx={{ px: 1.5 }}>
            <FormControlLabel
              control={<Checkbox checked={visibleColumnIds.includes(column.id)} onChange={() => toggleColumn(column.id)} disabled={column.hideable === false || (visibleColumnIds.length === 1 && visibleColumnIds.includes(column.id))} />}
              label={column.label}
            />
          </Box>
        ))}
      </Menu>
    </Stack>
  );

  return (
    <DataTableShell
      title={title}
      subtitle={subtitle}
      actions={controls}
      minWidth={rows.length ? minWidth : 0}
      footer={rows.length ? (
        <TablePagination
          component="div"
          count={rows.length}
          page={Math.min(page, Math.max(0, Math.ceil(rows.length / rowsPerPage) - 1))}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[5, 10, 25]}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
          labelRowsPerPage="Linhas por página"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
          getItemAriaLabel={(type) => type === 'next' ? 'Próxima página' : 'Página anterior'}
        />
      ) : null}
    >
      {rows.length === 0 ? <EmptyState title={emptyTitle} /> : (
        <Table aria-label={ariaLabel} size={density === 'compact' ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              {visibleColumns.map((column) => (
                <TableCell key={column.id} align={column.align} sx={{ minWidth: column.minWidth }}>
                  {column.sortable ? (
                    <TableSortLabel active={orderBy === column.id} direction={orderBy === column.id ? order : 'asc'} onClick={() => handleSort(column.id)}>
                      {column.label}
                      {orderBy === column.id ? <Box component="span" className="visually-hidden">{order === 'desc' ? 'ordenado decrescente' : 'ordenado crescente'}</Box> : null}
                    </TableSortLabel>
                  ) : column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedRows.map((row) => (
              <TableRow key={getRowId(row)} hover>
                {visibleColumns.map((column) => (
                  <TableCell key={column.id} align={column.align}>
                    {column.render ? column.render(row) : row[column.id]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </DataTableShell>
  );
}
