import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { server } from './server.js';

configure({ asyncUtilTimeout: 5000 });

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
  sessionStorage.clear();
});

afterAll(() => {
  server.close();
});

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function mediaQueryResult(query, matches) {
  return {
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn(),
});

beforeEach(() => {
  window.matchMedia.mockImplementation((query) => mediaQueryResult(query, query.includes('min-width:1200px')));
});
