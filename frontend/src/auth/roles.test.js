import { getPrimaryRole, ROLES } from './roles.js';

describe('roles', () => {
  it('uses doctor as primary role when present', () => {
    expect(getPrimaryRole({ roles: [ROLES.RESEARCHER, ROLES.DOCTOR] })).toBe(ROLES.DOCTOR);
  });
});

