import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Cluster compartilhado serve o app sob prefixo /grupoXX (ver k8s/frontend-ingress.yaml);
  // localmente (dev/docker-compose) fica na raiz.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('recharts')) return 'charts';
          if (id.includes('@mui') || id.includes('@emotion') || id.includes('notistack')) return 'ui';
          if (id.includes('msw')) return 'mocks';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: './src/test/setupTests.js',
    testTimeout: 10000,
  },
});
