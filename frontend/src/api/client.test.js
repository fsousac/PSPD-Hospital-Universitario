import { afterEach, vi } from 'vitest';
import { apiFetch } from './client.js';
import { ApiError } from './errors.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('normalizes network failures without exposing request data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('internal network detail')));

    const error = await apiFetch('/patients').catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('NETWORK_UNAVAILABLE');
    expect(error.correlationId).toBeTruthy();
    expect(error.message).not.toContain('internal network detail');
  });
});
