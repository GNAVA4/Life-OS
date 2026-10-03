// Стек тостов: достижения, комбо, задания дня, цель, испытание недели. Вынесено из App.jsx (session 036).
// Чистый рендер: вся логика появления/исчезновения тостов остаётся в App (эффекты начисления).
// Редизайн «Тихий» — session 043 (О1/О2): тёмная плашка без рамки, слева значок на подложке цвета события.
// У достижений — их собственный эмодзи (награды остаются «красочными» по просьбе пользователя).
import { ACHIEVEMENTS, ACH_TIERS } from '../lib/achievements.js';
import { WEEKLY_XP } from '../lib/gamify.js';
import { GOAL_DONE_XP } from '../lib/constants.js';
import { S } from '../lib/styles.js';
import { C, tint } from '../lib/theme.js';
import { Icon } from './Icon.jsx';

const Toast = ({ color, icon, emoji, kicker, title, sub, onClick }) => (
  <div className="anim-toast" role="status" style={{ ...S.toast, ...(onClick ? { cursor: 'pointer' } : null) }} onClick={onClick}>
    <span style={{ width: 38, height: 38, borderRadius: 11, flex: 'none', display: 'grid', placeItems: 'center', background: tint(color, .16), color, fontSize: 20 }}>
      {emoji || <Icon name={icon} size={19} />}
    </span>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color, fontWeight: 600 }}>{kicker}</div>
      <div style={{ fontSize: 14.5, fontWeight: 600, overflowWrap: 'anywhere' }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: C.dim }}>{sub}</div>}
    </div>
  </div>
);

export function ToastStack({ toasts = [], isMobile = false, onOpenAchievements }) {
  if (!toasts.length) return null;
  return (
    <div style={{ ...S.toastWrap, bottom: isMobile ? 86 : 16 }}>
      {toasts.map(t => {
        if (t.summary) return <Toast key={t.tid} color={C.amber} emoji="🏅" kicker="Награды"
          title={`Получено сразу ${t.summary}`} sub="Нажми, чтобы открыть «Награды»" onClick={onOpenAchievements} />;
        if (t.combo) return <Toast key={t.tid} color={C.cyan} icon="flame" kicker={`Комбо · ${t.streak} дн.`}
          title={`+${t.combo} XP`} sub="серия активных дней" />;
        if (t.quest) return <Toast key={t.tid} color={C.green} icon="check" kicker={`Задание дня · +${t.xp} XP`} title={t.quest} />;
        if (t.goalDone) return <Toast key={t.tid} color={C.green} icon="goals" kicker={`Цель выполнена · +${GOAL_DONE_XP} XP`} title={t.goalDone} sub="закрыта привязанной задачей" />;
        if (t.weekly) return <Toast key={t.tid} color={C.amber} icon="achievements" kicker={`Испытание недели · +${WEEKLY_XP} XP`} title={t.weekly} />;
        const a = ACHIEVEMENTS.find(x => x.id === t.id); if (!a) return null;
        return <Toast key={t.tid} color={ACH_TIERS[a.tier].c} emoji={a.icon} kicker="Получена награда" title={a.title} sub={a.desc} onClick={onOpenAchievements} />;
      })}
    </div>
  );
}
