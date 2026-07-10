import { userMessageForStatus } from './errors.js';

describe('api errors', () => {
  it('maps forbidden status to a safe message', () => {
    expect(userMessageForStatus(403)).toBe('Você não tem permissão para acessar este recurso.');
  });
});

