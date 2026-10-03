// Боковое меню для широкого экрана (редизайн «Тихий», этап 7, session 043).
// Заменяет верхнюю строку вкладок: разделы списком, внизу — уровень/здоровье (открывают профиль) и «Настройки».
// Состав разделов тот же, что был в верхней строке (App → NAV с учётом «Что показывать»).
import { C, tint } from '../lib/theme.js';
import { TAB_META } from '../lib/constants.js';
import { Icon } from './Icon.jsx';

const item = (active) => ({
  display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '9px 12px', borderRadius: 10,
  border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, textAlign: 'left',
  background: active ? tint(C.amber, .14) : 'transparent', color: active ? C.amber : C.dim,
});

export function DesktopSidebar({ tabIds, tab, onPick, level, into, needed, levelMax, health, onProfile, user = null, syncPaused = false, onSync }) {
  const pct = levelMax ? 100 : Math.max(0, Math.min(100, needed ? into / needed * 100 : 0));
  return (
    <aside style={{ position: 'sticky', top: 0, height: '100vh', width: 216, flex: 'none', boxSizing: 'border-box',
      padding: '22px 12px 16px', borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', padding: '0 12px 18px' }}>Life OS</div>
      <nav aria-label="Разделы" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {tabIds.map(id => (
          <button key={id} className="tab-btn" style={item(tab === id)} onClick={() => onPick(id)} aria-current={tab === id ? 'page' : undefined}>
            <Icon name={TAB_META[id]?.icon} size={18} />{TAB_META[id]?.label}
          </button>
        ))}
      </nav>
      <div style={{ flex: 1 }} />
      <button onClick={onProfile} title="Профиль" style={{ ...item(false), flexDirection: 'column', alignItems: 'stretch', gap: 7, padding: '10px 12px', color: C.text, background: C.panel }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
          <span>ур. {level}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: C.dim, fontVariantNumeric: 'tabular-nums' }}><Icon name="heart" size={13} />{health}</span>
        </span>
        <span style={{ height: 4, background: C.panelAlt, borderRadius: 4, overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: C.amber }} />
        </span>
        <span style={{ fontSize: 11.5, color: C.dim, fontVariantNumeric: 'tabular-nums' }}>{levelMax ? 'максимальный уровень' : `${into} / ${needed} XP`}</span>
      </button>
      {/* статус синхронизации всегда на виду (референс Д1); нажатие — сверка или вход */}
      <button onClick={onSync} style={{ ...item(false), marginTop: 8, fontSize: 12.5, padding: '6px 12px', color: !user ? C.dim : syncPaused ? C.amber : C.dim }}>
        <span style={{ display: 'flex', color: !user ? C.faint : syncPaused ? C.amber : C.green }}><Icon name={syncPaused ? 'warn' : 'cloud'} size={15} /></span>
        {!user ? 'Без облака — войти' : syncPaused ? 'Синхронизация на паузе' : 'Синхронизировано'}
      </button>
      <button className="tab-btn" style={{ ...item(tab === 'settings'), marginTop: 2 }} onClick={() => onPick('settings')} aria-current={tab === 'settings' ? 'page' : undefined}>
        <Icon name="settings" size={18} />Настройки
      </button>
    </aside>
  );
}
