// Глобальный поиск (задачи, дела, заметки, цели, привычки). Вынесено из App.jsx (session 036).
// Сами результаты считает App (searchResults memo) — здесь только ввод и список.
import { S } from '../lib/styles.js';
import { C } from '../lib/theme.js';
import { Modal } from './primitives.jsx';

export const SEARCH_MIN_CHARS = 2; // короче двух символов выдача бессмысленна (пол-базы совпадёт)

export function SearchModal({ query, setQuery, results = [], onClose, onGo }) {
  const short = query.trim().length < SEARCH_MIN_CHARS;
  return (
    <Modal onClose={onClose} title="🔍 Поиск">
      <input autoFocus style={S.input} placeholder="Задачи, дела, заметки, цели, привычки…"
        value={query} onChange={e => setQuery(e.target.value)} />
      <div style={{ marginTop: 12 }}>
        {short && <div style={S.emptyState}>Введи хотя бы {SEARCH_MIN_CHARS} символа</div>}
        {!short && results.length === 0 && <div style={S.emptyState}>Ничего не найдено</div>}
        {results.map((r, i) => (
          <div key={i} className="row-hover" style={{ padding: '9px 6px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }} onClick={() => onGo(r.go)}>
            <div style={{ fontSize: 13.5, color: C.text, overflowWrap: 'anywhere' }}>{r.label}</div>
            <div style={{ fontSize: 10.5, color: C.dim }}>{r.type}{r.sub ? ` · ${r.sub}` : ''}</div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
