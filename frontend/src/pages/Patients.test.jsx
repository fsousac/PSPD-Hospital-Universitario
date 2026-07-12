import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/test-utils.jsx';

describe('Patients', () => {
  it('lists linked patients with FULL access for doctors', async () => {
    renderApp({ route: '/patients', profile: 'medico' });

    expect(await screen.findByRole('heading', { name: 'Pacientes' })).toBeInTheDocument();
    expect(screen.getByText('FULL')).toBeInTheDocument();
    expect(screen.getByText('João da Silva')).toBeInTheDocument();
    expect(screen.getByText('Pedro Alves')).toBeInTheDocument();
  });

  it('shows PARTIAL access warning and protected patient data for interns', async () => {
    renderApp({ route: '/patients', profile: 'estagiario' });

    expect(await screen.findByRole('heading', { name: 'Pacientes' })).toBeInTheDocument();
    expect(screen.getByText('PARTIAL')).toBeInTheDocument();
    expect(screen.getByText(/acesso é parcial/i)).toBeInTheDocument();
    expect(screen.getByText('J.S.')).toBeInTheDocument();
    expect(screen.queryByText('João da Silva')).not.toBeInTheDocument();
  });

  it('filters patients by search text', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/patients', profile: 'medico' });

    expect(await screen.findByText('João da Silva')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Buscar por ID, nome ou localidade'), 'Pedro');

    expect(screen.getByText('Pedro Alves')).toBeInTheDocument();
    expect(screen.queryByText('João da Silva')).not.toBeInTheDocument();
  });

  it('shows empty state when search has no results', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/patients', profile: 'medico' });

    await screen.findByText('João da Silva');
    await user.type(screen.getByLabelText('Buscar por ID, nome ou localidade'), 'sem resultado');

    expect(screen.getByText('Nenhum paciente encontrado')).toBeInTheDocument();
  });
});
