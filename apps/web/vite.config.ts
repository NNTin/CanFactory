import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
  build: { rollupOptions: { output: { manualChunks: { three: ['three', 'three/addons/loaders/STLLoader.js', 'three/addons/controls/OrbitControls.js'] } } } },
});
