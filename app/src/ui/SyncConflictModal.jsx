import { C } from '../lib/theme.js';
import { S } from '../lib/styles.js';
import { formatDateShort } from '../lib/dates.js';
import { sideSummary, KEY_LABELS } from '../lib/syncPlan.js';
import { Modal } from './primitives.jsx';

// Диалог «устройство и облако расходятся» (session 042). Закрытие без выбора = синк на паузе:
// данные устройства остаются только на устройстве, вопрос вернётся при следующем запуске
// или по кнопке в профиле.
function Side({ icon, title, sum }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>{icon} {title}</div>
      <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5 }}>
        {sum.days} дн. записей{sum.lastDay ? <><br />последний {formatDateShort(sum.lastDay)}</> : null}
        <br />{sum.ops} фин. операций
      </div>
    </div>
  );
}

export function SyncConflictModal({ ask, onKeepDevice, onTakeCloud, onBackup, onLater }) {
  const dev = sideSummary(ask.local), cloud = sideSummary(ask.cloud);
  const changed = [...ask.plan.diff, ...ask.plan.localOnly].map(k => KEY_LABELS[k] || k);
  const busy = !!ask.busy;
  return (
    <Modal onClose={busy ? () => {} : onLater} title="Данные на устройстве и в облаке разные">
      <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
        Аккаунт{ask.email ? <> <b>{ask.email}</b></> : null}. Выбери, какие данные оставить.
        Вторая сторона не пропадёт: перед заменой её копия сохранится в облаке.
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <Side icon="📱" title="Это устройство" sum={dev} />
        <Side icon="☁" title="Облако" sum={cloud} />
      </div>
      {changed.length > 0 && (
        <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5, marginBottom: 12 }}>
          Отличаются: {changed.join(', ')}.
        </div>
      )}
      <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5, marginBottom: 12 }}>
        Пользовался этим устройством без входа — оставляй данные устройства. Это новое устройство — бери облако.
      </div>
      {ask.err && <div style={{ fontSize: 12.5, color: C.red, marginBottom: 10 }}>{ask.err}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button disabled={busy} style={{ ...S.exportBtn, borderColor: C.amber, color: C.amber }} onClick={onKeepDevice}>
          {busy ? 'Сохраняю…' : '📱 Оставить данные устройства → в облако'}
        </button>
        <button disabled={busy} style={S.exportBtn} onClick={onTakeCloud}>☁ Взять данные из облака</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button disabled={busy} style={{ ...S.exportBtn, flex: 1 }} onClick={onBackup}>⬇ Бэкап JSON</button>
          <button disabled={busy} style={{ ...S.exportBtn, flex: 1 }} onClick={onLater}>Решить позже</button>
        </div>
      </div>
    </Modal>
  );
}
