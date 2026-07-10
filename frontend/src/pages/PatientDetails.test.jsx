import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/test-utils.jsx';

describe('PatientDetails', () => {
  it('shows complete identifiers for doctors with FULL access', async () => {
    renderApp({ route: '/patients/P000001', profile: 'medico' });

    expect(await screen.findByRole('heading', { name: 'João da Silva' })).toBeInTheDocument();
    expect(screen.getAllByText('FULL').length).toBeGreaterThan(0);
    expect(screen.getByText('111.222.333-44')).toBeInTheDocument();
    expect(screen.getByText('700001234567890')).toBeInTheDocument();
  });

  it('hides direct identifiers for interns with PARTIAL access', async () => {
    renderApp({ route: '/patients/P000001', profile: 'estagiario' });

    expect(await screen.findByRole('heading', { name: 'J.S.' })).toBeInTheDocument();
    expect(screen.getAllByText('PARTIAL').length).toBeGreaterThan(0);
    expect(screen.getByText(/campos identificadores foram removidos/i)).toBeInTheDocument();
    expect(screen.queryByText('111.222.333-44')).not.toBeInTheDocument();
    expect(screen.queryByText('700001234567890')).not.toBeInTheDocument();
    expect(screen.queryByText('João da Silva')).not.toBeInTheDocument();
  });

  it('navigates through clinical tabs and renders FHIR JSON', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/patients/P000001', profile: 'medico' });

    expect(await screen.findByRole('heading', { name: 'João da Silva' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Atendimentos' }));
    expect(screen.getByText('Ambulatorial')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Diagnósticos' }));
    expect(screen.getByText('Diabetes Mellitus Tipo 2')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Exames' }));
    expect(screen.getByText('Hemoglobina Glicada')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Medicamentos' }));
    expect(screen.getByText('Metformina 850 mg')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'FHIR JSON' }));
    expect(await screen.findByText('Bundle FHIR R4')).toBeInTheDocument();
    expect(screen.getByText(/"resourceType": "Bundle"/)).toBeInTheDocument();
  });
});
