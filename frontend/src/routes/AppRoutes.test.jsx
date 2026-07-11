import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
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

  it('opens navigation from the menu button on small screens', async () => {
    const user = userEvent.setup();
    window.matchMedia.mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    renderApp({ route: '/dashboard', profile: 'medico' });

    expect(screen.queryByRole('link', { name: /Pacientes/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Abrir menu de navegação' }));
    expect(screen.getByRole('link', { name: /Pacientes/ })).toBeInTheDocument();
  });

  it('opens the user menu with profile and logout actions', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/dashboard', profile: 'medico' });

    await screen.findByRole('heading', { name: 'Dashboard' });
    await user.click(screen.getByRole('button', { name: 'Abrir menu do usuário' }));

    expect(screen.getByRole('menuitem', { name: /Perfil: Médico/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Configurações/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Sair/ })).toBeInTheDocument();
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
