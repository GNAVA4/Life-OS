import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base:'./' => относительные пути к ассетам, чтобы сборка открывалась и по file://,
// и в окне pywebview, и в Android-обёртке (Capacitor), а не только с корня домена.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // code-split (session 022): выносим тяжёлые вендоры в отдельные чанки, чтобы стартовый
    // бандл не был монолитом ~1.6МБ. xlsx грузится лениво (динамический import в App.jsx).
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          chart: ['chart.js'],
        },
      },
    },
  },
});
