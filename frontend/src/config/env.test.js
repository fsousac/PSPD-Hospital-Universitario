import { afterEach, beforeEach, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('env.apiBaseUrl', () => {
  it('falls back to the Vite base path when VITE_API_BASE_URL is unset', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('BASE_URL', '/grupo10/');
    vi.resetModules();

    const { env } = await import('./env.js');

    expect(env.apiBaseUrl).toBe('/grupo10');
  });

  it('uses VITE_API_BASE_URL when explicitly set', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8088/api');
    vi.stubEnv('BASE_URL', '/grupo10/');
    vi.resetModules();

    const { env } = await import('./env.js');

    expect(env.apiBaseUrl).toBe('http://localhost:8088/api');
  });
});
