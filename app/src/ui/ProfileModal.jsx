// Модалка профиля: ранг, шкалы (стрик/здоровье/импульс/комбо/уровень), расшифровка ❤ за последний
// посчитанный день, аккаунт и экспорт/импорт. Вынесено из App.jsx (session 036).
// Чистый рендер: все значения приходят пропсами, вычисления остаются в App.
import { formatDateRu, formatDateShort, todayStr } from '../lib/dates.js';
import { COMBO_CAP_DAYS, nextRank } from '../lib/gamify.js';
import { vis } from '../lib/storage.js';
import { S } from '../lib/styles.js';
import { C } from '../lib/theme.js';
import { Modal } from './primitives.jsx';

// Разбор дельты здоровья за вчера: без него шкала выглядит числом, которое само куда-то ползёт.
function HealthBreakdown({ last }) {
  if (!last || !(last.parts || []).length) return null;
  return (
    <div style={{ marginTop: 10, padding: '9px 11px', background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 8 }}>
      <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 6 }}>
        ❤ за {formatDateShort(last.date)}:{' '}
        <b style={{ color: last.total >= 0 ? C.green : C.red }}>{last.total > 0 ? '+' : ''}{last.total}</b>
      </div>
      {last.parts.map(([label, v], i) => (
        <div key={i} style={{ display: 'flex', fontSize: 12, padding: '2px 0' }}>
          <span style={{ flex: 1, color: C.text }}>{label}</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", color: v >= 0 ? C.green : C.red }}>{v > 0 ? '+' : ''}{v}</span>
        </div>
      ))}
    </div>
  );
}

export function ProfileModal({
  onClose, rank, level, levelMax, into, needed, streak, health = 100, impulse, combo,
  healthLastDay, achUnlockedCount, user, onOpenAchievements, onLogin, onLogout,
  onExportExcel, onExportJson, onImport,
}) {
  const nr = nextRank(level);
  return (
    <Modal onClose={onClose} title={formatDateRu(todayStr())}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.panelAlt, border: `1px solid ${rank.color}`, borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
        <span style={{ fontSize: 34, lineHeight: 1 }}>{rank.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: rank.color }}>{rank.name}</div>
          <div style={{ fontSize: 11.5, color: C.dim }}>Ур. {level}{levelMax ? ' · МАКС' : ''}{nr ? ` · до «${nr.name}» ${nr.min - level} ур.` : ''}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={S.profTile}><span style={{ fontSize: 20 }}>🔥</span><div><div style={S.gaugeVal}>{streak}</div><div style={S.gaugeLabel}>дней подряд</div></div></div>
        <div style={S.profTile}><span style={{ fontSize: 20 }}>❤</span><div style={{ flex: 1 }}><div style={S.gaugeVal}>{health}</div><div style={S.gaugeBarWrap}><div style={{ ...S.gaugeBarFill, background: C.red, width: `${health}%` }} /></div></div></div>
        <div style={S.profTile}><span style={{ fontSize: 20 }}>⚡</span><div style={{ flex: 1 }}><div style={S.gaugeVal}>{impulse}</div><div style={S.gaugeBarWrap}><div style={{ ...S.gaugeBarFill, background: C.purple, width: `${impulse}%` }} /></div><div style={S.gaugeLabel}>импульс · 7 дней</div></div></div>
        <div style={S.profTile}><span style={{ fontSize: 20 }}>🔗</span><div style={{ flex: 1 }}><div style={S.gaugeVal}>×{combo.mult.toFixed(1)}</div><div style={S.gaugeBarWrap}><div style={{ ...S.gaugeBarFill, background: C.cyan, width: `${Math.min(100, combo.streak / COMBO_CAP_DAYS * 100)}%` }} /></div><div style={S.gaugeLabel}>комбо · {combo.streak} дн.</div></div></div>
        <div style={{ ...S.profTile, gridColumn: '1 / -1' }}><span style={{ fontSize: 20 }}>🏆</span><div style={{ flex: 1 }}><div style={S.gaugeVal}>Ур. {level}{levelMax ? ' · МАКС' : ''}</div><div style={S.gaugeBarWrap}><div style={{ ...S.gaugeBarFill, width: `${levelMax ? 100 : (into / needed) * 100}%` }} /></div><div style={S.gaugeLabel}>{levelMax ? 'максимальный уровень' : `${into}/${needed} XP`}</div></div></div>
      </div>
      <HealthBreakdown last={healthLastDay} />
      {vis('tab.achievements') && <button style={{ ...S.sheetRow, marginTop: 12 }} onClick={onOpenAchievements}>🏅 Награды · {achUnlockedCount}</button>}
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
    </Modal>
  );
}
