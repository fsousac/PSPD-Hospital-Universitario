import { screen } from '@testing-library/react';
import { renderApp } from '../test/test-utils.jsx';

describe('ResearchProjectDetails', () => {
  it('shows aggregated metrics and anonymized cohort for researchers', async () => {
    renderApp({ route: '/research/projects/PRJ01', profile: 'pesquisador' });

    expect(await screen.findByRole('heading', { name: 'Fatores de risco em Diabetes Tipo 2' })).toBeInTheDocument();
    expect(screen.getAllByText('AGGREGATED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ANONYMIZED').length).toBeGreaterThan(0);
    expect(screen.getByText('Metformina 850 mg')).toBeInTheDocument();
    expect(screen.getByText('anon-7f3a91c2')).toBeInTheDocument();
  });

  it('does not expose real patient identifiers in researcher views', async () => {
    renderApp({ route: '/research/projects/PRJ01', profile: 'pesquisador' });

    expect(await screen.findByText('Coorte pseudonimizada')).toBeInTheDocument();
    expect(screen.queryByText('João da Silva')).not.toBeInTheDocument();
    expect(screen.queryByText('P000001')).not.toBeInTheDocument();
    expect(screen.queryByText('111.222.333-44')).not.toBeInTheDocument();
    expect(screen.queryByText('700001234567890')).not.toBeInTheDocument();
    expect(screen.queryByText('Brasília')).not.toBeInTheDocument();
  });

  it('shows a warning for suspended projects', async () => {
    renderApp({ route: '/research/projects/PRJ02', profile: 'pesquisador' });

    expect(await screen.findByRole('heading', { name: 'Hipertensão em idosos' })).toBeInTheDocument();
    expect(screen.getByText('Suspenso')).toBeInTheDocument();
    expect(screen.getByText(/Projeto sem status aprovado/i)).toBeInTheDocument();
  });
});
