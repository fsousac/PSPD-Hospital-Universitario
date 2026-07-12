import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState.jsx';

describe('EmptyState', () => {
  it('renders the default empty message', () => {
    render(<EmptyState />);
    expect(screen.getByText('Nenhum dado encontrado')).toBeInTheDocument();
  });
});

