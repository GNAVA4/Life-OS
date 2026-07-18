import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base:'./' => относительные пути к ассетам, чтобы сборка открывалась и по file://,
// и в окне pywebview, и в Android-обёртке (Capacitor), а не только с корня домена.
export default defineConfig({
  plugins: [react()],
  base: './',
});
