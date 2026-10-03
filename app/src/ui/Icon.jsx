// Единый набор линейных иконок (редизайн «Тихий», session 043). Заменяет эмодзи в интерфейсе.
// Эмодзи остаются только там, где их выбирает пользователь (теги, сферы), в наградах и категориях финансов.
const P = {
  today: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></>,
  habits: <><path d="M17 3l3 3-3 3"/><path d="M20 6H9a5 5 0 0 0-5 5"/><path d="M7 21l-3-3 3-3"/><path d="M4 18h11a5 5 0 0 0 5-5"/></>,
  goals: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6"/></>,
  study: <><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".8"/><circle cx="4.5" cy="12" r=".8"/><circle cx="4.5" cy="18" r=".8"/></>,
  notes: <><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/></>,
  finance: <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/></>,
  stats: <><path d="M4 20V4M4 20h16"/><path d="M8 15l4-4 3 3 5-6"/></>,
  achievements: <><circle cx="12" cy="14" r="6"/><path d="M8.5 9L6 3h4l2 4 2-4h4l-2.5 6"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>,
  flame: <path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-9-1 2-2 3-4 4 0-1-.5-2-1-2.5C7.5 9.5 6 12 6 15a6 6 0 0 0 6 6z"/>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  minus: <path d="M5 12h14"/>,
  x: <path d="M6 6l12 12M18 6L6 18"/>,
  chevR: <path d="M9 6l6 6-6 6"/>,
  chevL: <path d="M15 6l-6 6 6 6"/>,
  chevD: <path d="M6 9l6 6 6-6"/>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
  bellOff: <><path d="M6 16V11a6 6 0 0 1 9.5-4.9M18 11v5l1.5 2H8"/><path d="M10 20a2 2 0 0 0 4 0M3 3l18 18"/></>,
  search: <><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></>,
  archive: <><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/></>,
  restore: <><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></>,
  pin: <><path d="M9 4h6l-1 6 4 3H6l4-3z"/><path d="M12 13v7"/></>,
  cloud: <path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/>,
  phone: <><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/></>,
  edit: <path d="M4 20h4L19 9l-4-4L4 16z"/>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/></>,
  clock: <><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></>,
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5 7.5 7.5 0 1 0 19 14.5z"/>,
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>,
  bolt: <path d="M13 3L5 14h6l-1 7 8-11h-6z"/>,
  template: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 10v10"/></>,
  carry: <><path d="M4 12h13"/><path d="M13 7l5 5-5 5"/><path d="M20 5v14"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff: <><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 6.6C3.8 8.3 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4.4-1"/></>,
  download: <><path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 20h16"/></>,
  upload: <><path d="M12 20V9M7 14l5-5 5 5"/><path d="M4 4h16"/></>,
  sync: <><path d="M20 7h-6M20 7v-6"/><path d="M20 7a8 8 0 0 0-14 1M4 17h6M4 17v6"/><path d="M4 17a8 8 0 0 0 14-1"/></>,
  warn: <><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/></>,
  wifiOff: <path d="M3 4l18 16M8.5 13.5a5 5 0 0 1 4-1.4M5 10a10 10 0 0 1 4-2.3M15.5 8a10 10 0 0 1 3.5 2M12 18h.01"/>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></>,
  tag: <><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/></>,
  sort: <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M8 14h2M12 14h2M16 14h0"/></>,
};

export function Icon({ name, size = 16, stroke = 1.8, style, className, title }) {
  const p = P[name];
  if (!p) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', display: 'block', ...style }}
      className={className} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      {p}
    </svg>
  );
}
