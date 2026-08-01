// Мобильная навигация: нижняя панель (до 4 вкладок + «Ещё») и шторка с остальными разделами,
// аккаунтом и экспортом/импортом. Вынесено из App.jsx (session 036).
import { TAB_META } from '../lib/constants.js';
import { S } from '../lib/styles.js';
import { C } from '../lib/theme.js';

export function MobileBottomNav({ tabIds = [], tab, onPick, onOpenSheet }) {
  return (
    <div style={S.bottomNav}>
      {tabIds.map(id => {
        const active = tab === id; const m = TAB_META[id] || { label: id, icon: '•' };
        return (
          <button key={id} onClick={() => onPick(id)} style={{ ...S.bottomItem, color: active ? C.amber : C.dim }}>
            <span style={{ fontSize: 20, filter: active ? 'none' : 'grayscale(.4)' }}>{m.icon}</span>
            <span style={{ fontSize: 10 }}>{m.label}</span>
          </button>
        );
      })}
      <button onClick={onOpenSheet} style={{ ...S.bottomItem, color: !tabIds.includes(tab) ? C.amber : C.dim }}>
        <span style={{ fontSize: 20 }}>☰</span><span style={{ fontSize: 10 }}>Ещё</span>
      </button>
    </div>
  );
}

export function MobileSheet({ tabIds = [], tab, user, onPick, onClose, onLogin, onLogout, onExportExcel, onExportJson, onImport }) {
  const tile = (id, icon, label) => (
    <button key={id} onClick={() => onPick(id)} style={{ ...S.sheetTile, ...(tab === id ? { borderColor: C.amber, color: C.amber } : {}) }}>
      <span style={{ fontSize: 22 }}>{icon}</span><span style={{ fontSize: 12 }}>{label}</span>
    </button>
  );
  return (
    <div className="anim-fade" style={S.sheetOverlay} onClick={onClose}>
      <div className="anim-sheet" style={S.sheet} onClick={e => e.stopPropagation()}>
        <div style={S.sheetGrab} />
        <div style={S.sheetSection}>Разделы</div>
        <div style={S.sheetGrid}>
          {tabIds.map(id => tile(id, TAB_META[id].icon, TAB_META[id].label))}
          {tile('settings', '⚙', 'Настройки')}
        </div>
        <div style={S.sheetSection}>Аккаунт · синхронизация</div>
        {user
          ? <button style={{ ...S.sheetRow, borderColor: C.green, color: C.green }} onClick={onLogout}>☁ Выйти{user.email ? ` · ${user.email}` : ''}</button>
          : <button style={S.sheetRow} onClick={onLogin}>☁ Войти через Google</button>}
        <div style={S.sheetSection}>Данные</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={S.sheetBtn} onClick={onExportExcel}>⬇ Excel</button>
          <button style={S.sheetBtn} onClick={onExportJson}>⬇ JSON</button>
          <button style={S.sheetBtn} onClick={onImport}>⬆ Импорт</button>
        </div>
        <button style={{ ...S.sheetRow, marginTop: 14, textAlign: 'center', color: C.dim }} onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
}
