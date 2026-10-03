import { createRoot } from 'react-dom/client';
// Локальные шрифты (@fontsource) — self-hosted, работают офлайн (в WebView Google Fonts @import падал без сети). session 022.
// Редизайн (session 043): Onest — с нормальной кириллицей (Space Grotesk её не имел, заголовки падали в системный шрифт).
import '@fontsource/onest/400.css';
import '@fontsource/onest/500.css';
import '@fontsource/onest/600.css';
import '@fontsource/onest/700.css';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(<App />);
