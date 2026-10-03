// Мобильная навигация: нижняя панель (до 4 вкладок + «Ещё») и шторка с остальными разделами,
// аккаунтом и экспортом/импортом. Вынесено из App.jsx (session 036). Редизайн «Тихий» — session 043 (Э10).
import { TAB_META } from '../lib/constants.js';
import { S } from '../lib/styles.js';
import { C } from '../lib/theme.js';
import { Icon } from './Icon.jsx';

export function MobileBottomNav({ tabIds = [], tab, onPick, onOpenSheet }) {
  return (
    <nav style={S.bottomNav} aria-label="Разделы">
      {tabIds.map(id => {
        const active = tab === id; const m = TAB_META[id] || { label: id, icon: 'more' };
        return (
          <button key={id} onClick={() => onPick(id)} aria-current={active ? 'page' : undefined} style={{ ...S.bottomItem, color: active ? C.text : C.dim }}>
            <Icon name={m.icon} size={20} />
            <span style={{ fontSize: 10.5, fontWeight: active ? 600 : 500 }}>{m.label}</span>
          </button>
        );
      })}
      <button onClick={onOpenSheet} style={{ ...S.bottomItem, color: !tabIds.includes(tab) ? C.text : C.dim }}>
        <Icon name="more" size={20} /><span style={{ fontSize: 10.5, fontWeight: 500 }}>Ещё</span>
      </button>
    </nav>
  );
}

export function MobileSheet({ tabIds = [], tab, user, onPick, onClose, onLogin, onLogout, syncPaused, onSyncCheck, onExportExcel, onExportJson, onImport }) {
  const tile = (id, icon, label) => (
    <button key={id} onClick={() => onPick(id)} style={{ ...S.sheetTile, ...(tab === id ? { borderColor: C.amber, color: C.amber } : {}) }}>
      <Icon name={icon} size={20} /><span style={{ fontSize: 12.5 }}>{label}</span>
    </button>
  );
  return (
    <div className="anim-fade" style={S.sheetOverlay} onClick={onClose}>
      <div className="anim-sheet" style={S.sheet} onClick={e => e.stopPropagation()}>
        <div style={S.sheetGrab} />
        <div style={S.sheetGrid}>
          {tabIds.map(id => tile(id, TAB_META[id].icon, TAB_META[id].label))}
          {tile('settings', 'settings', 'Настройки')}
        </div>
        <div style={S.sheetSection}>Аккаунт</div>
        {user
          ? <button style={S.sheetRow} onClick={onLogout}><span style={{ color: C.green, display: 'flex' }}><Icon name="cloud" /></span><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>Выйти{user.email ? ` · ${user.email}` : ''}</span></button>
          : <button style={S.sheetRow} onClick={onLogin}><Icon name="cloud" /><span>Войти через Google</span></button>}
        {user && (syncPaused
          ? <button style={{ ...S.sheetRow, color: C.amber }} onClick={onSyncCheck}><Icon name="warn" /><span>Синхронизация на паузе — выбрать данные</span></button>
          : <button style={S.sheetRow} onClick={onSyncCheck}><Icon name="sync" /><span>Сверить устройство и облако</span></button>)}
        <div style={S.sheetSection}>Данные</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={S.sheetBtn} onClick={onExportExcel}><Icon name="download" size={15} />Excel</button>
          <button style={S.sheetBtn} onClick={onExportJson}><Icon name="download" size={15} />JSON</button>
          <button style={S.sheetBtn} onClick={onImport}><Icon name="upload" size={15} />Импорт</button>
        </div>
      </div>
    </div>
  );
}
