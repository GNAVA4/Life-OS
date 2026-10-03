// Сторож импортов (session 043). Vite/Rollup НЕ ловит «используется, но не импортировано»
// (трактует как глобал → ReferenceError в рантайме → чёрный экран), и не ловит неиспользуемые импорты.
// Запуск: node scripts/check-imports.mjs  (код возврата 1, если есть «не импортировано»)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|mjs)$/.test(f) && !f.includes('.example.')) files.push(p);
  }
})(SRC);

const strip = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
  .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
  .replace(/"(?:\\.|[^"\\\n])*"/g, '""');

// все экспортируемые имена проекта
const exported = new Map(); // name -> file
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g)) exported.set(m[1], f);
}

let missing = 0, unused = 0;
for (const f of files) {
  const raw = readFileSync(f, 'utf8');
  const imported = new Set();
  for (const m of raw.matchAll(/import\s*\{([^}]*)\}\s*from/g))
    m[1].split(',').map(x => x.trim().split(/\s+as\s+/).pop()).filter(Boolean).forEach(n => imported.add(n));
  for (const m of raw.matchAll(/import\s+([A-Za-z_$][\w$]*)\s*(?:,|from)/g)) imported.add(m[1]);
  // распаковка ...X не должна мешать поиску имени X
  const body = strip(raw.replace(/^import[\s\S]*?from\s*['"][^'"]+['"];?/gm, '')).replace(/\.\.\./g, ' ');
  const declared = new Set();
  for (const m of body.matchAll(/(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  for (const m of body.matchAll(/(?:const|let|var)\s*[{[]([^}\]=]*)[}\]]\s*=/g))
    m[1].split(',').map(x => x.split(':').pop().split('=')[0].trim()).filter(Boolean).forEach(n => declared.add(n.replace(/^\.\.\./, '')));
  for (const m of body.matchAll(/\(([^()]*)\)\s*=>|function\s*[\w$]*\s*\(([^()]*)\)/g))
    (m[1] || m[2] || '').replace(/[{}[\]]/g, ',').split(',').map(x => x.split('=')[0].split(':').pop().trim().replace(/^\.\.\./, '')).filter(Boolean).forEach(n => declared.add(n));
  for (const [name, src] of exported) {
    if (src === f || imported.has(name) || declared.has(name)) continue;
    const re = new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])(?!\\s*:)`);
    if (re.test(body)) { console.log(`НЕ ИМПОРТИРОВАНО  ${relative(SRC, f)}: ${name}  (экспорт из ${relative(SRC, src)})`); missing++; }
  }
  for (const n of imported) {
    const re = new RegExp(`(?<![\\w$.])${n.replace(/\$/g, '\\$')}(?![\\w$])`);
    if (!re.test(body)) { console.log(`не используется   ${relative(SRC, f)}: ${n}`); unused++; }
  }
}
console.log(`\nфайлов ${files.length} · не импортировано: ${missing} · не используется: ${unused}`);
process.exit(missing ? 1 : 0);
