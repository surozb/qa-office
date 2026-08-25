import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        output: { format: 'cjs', entryFileNames: '[name].js', chunkFileNames: '[name].js' }
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        output: { format: 'cjs', entryFileNames: '[name].js', chunkFileNames: '[name].js' }
      }
    }
  },
  renderer: { plugins: [react()] },
});
