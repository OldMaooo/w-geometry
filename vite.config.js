import { defineConfig } from 'vite';

// base 可用环境变量 GEO_BASE 配置（以后挂到 kiwistudy 子路径时用，比如 /geometry/）
export default defineConfig({
  base: process.env.GEO_BASE || '/',
  server: { port: 5173, strictPort: true },
  build: { chunkSizeWarningLimit: 1500 },
  test: {
    include: ['src/**/*.test.js'],
  },
});
