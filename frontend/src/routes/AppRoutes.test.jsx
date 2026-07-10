import { screen, within } from '@testing-library/react';
import { renderApp } from '../test/test-utils.jsx';

describe('AppRoutes', () => {
  it('shows patient navigation for doctors', async () => {
    renderApp({ route: '/dashboard', profile: 'medico' });

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pacientes/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pesquisa/ })).not.toBeInTheDocument();
  });

  it('shows research navigation for researchers', async () => {
    renderApp({ route: '/dashboard', profile: 'pesquisador' });

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pesquisa/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pacientes/ })).not.toBeInTheDocument();
  });

  it('redirects researchers away from patient routes', async () => {
    renderApp({ route: '/patients', profile: 'pesquisador' });

    expect(await screen.findByRole('heading', { name: 'Acesso negado' })).toBeInTheDocument();
    expect(screen.getByText(/não possui permissão visual/i)).toBeInTheDocument();
  });

  it('redirects doctors away from research routes', async () => {
    renderApp({ route: '/research/projects', profile: 'medico' });

    expect(await screen.findByRole('heading', { name: 'Acesso negado' })).toBeInTheDocument();
  });

  it('renders not found for unknown routes', () => {
    renderApp({ route: '/rota-inexistente', profile: 'medico' });

    const page = screen.getByText('Página não encontrada').closest('div');
    expect(within(page).getByText(/rota solicitada não existe/i)).toBeInTheDocument();
  });
});

