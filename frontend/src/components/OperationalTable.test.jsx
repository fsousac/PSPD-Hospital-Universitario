import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OperationalTable } from './OperationalTable.jsx';
import { render } from '@testing-library/react';
import { TestProviders } from '../test/test-utils.jsx';

const rows = [
  { id: '2', name: 'Bia', code: 'B02' },
  { id: '1', name: 'Ana', code: 'A01' },
];

const columns = [
  { id: 'name', label: 'Nome', sortable: true },
  { id: 'code', label: 'Código', sortable: true },
];

describe('OperationalTable', () => {
  it('sorts rows and allows density and column configuration', async () => {
    const user = userEvent.setup();
    render(
      <OperationalTable ariaLabel="Tabela operacional" rows={rows} columns={columns} getRowId={(row) => row.id} initialOrderBy="name" />,
      { wrapper: TestProviders },
    );

    const table = screen.getByRole('table', { name: 'Tabela operacional' });
    expect(within(within(table).getAllByRole('row')[1]).getByText('Ana')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Nome/ }));
    expect(within(within(table).getAllByRole('row')[1]).getByText('Bia')).toBeInTheDocument();

    const compactDensity = screen.getByRole('button', { name: 'Densidade compacta' });
    await user.click(compactDensity);
    expect(compactDensity).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Configurar colunas' }));
    await user.click(screen.getByRole('checkbox', { name: 'Código' }));
    expect(within(table).queryByRole('columnheader', { name: 'Código' })).not.toBeInTheDocument();
  });
});
