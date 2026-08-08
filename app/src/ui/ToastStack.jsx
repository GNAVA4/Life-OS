// Стек тостов: достижения, комбо, задания дня, испытание недели. Вынесено из App.jsx (session 036).
// Чистый рендер: вся логика появления/исчезновения тостов остаётся в App (эффекты начисления).
import { ACHIEVEMENTS, ACH_TIERS } from '../lib/achievements.js';
import { WEEKLY_XP } from '../lib/gamify.js';
import { GOAL_DONE_XP } from '../lib/constants.js';
import { S } from '../lib/styles.js';
import { C } from '../lib/theme.js';

const Toast = ({ color, icon, kicker, title, sub, onClick }) => (
  <div className="anim-toast" style={{ ...S.toast, borderColor: color, ...(onClick ? { cursor: 'pointer' } : null) }} onClick={onClick}>
    <span style={{ fontSize: 26 }}>{icon}</span>
    <div>
      <div style={{ fontSize: 10.5, color, letterSpacing: '.08em' }}>{kicker}</div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: C.dim }}>{sub}</div>}
    </div>
  </div>
);

export function ToastStack({ toasts = [], isMobile = false, onOpenAchievements }) {
  if (!toasts.length) return null;
  return (
    <div style={{ ...S.toastWrap, bottom: isMobile ? 86 : 16 }}>
      {toasts.map(t => {
        if (t.summary) return <Toast key={t.tid} color={C.amber} icon="🏅" kicker="ДОСТИЖЕНИЯ"
          title={`Открыто сразу ${t.summary}`} sub="Загляни во вкладку 🏅 Награды" onClick={onOpenAchievements} />;
        if (t.combo) return <Toast key={t.tid} color={C.cyan} icon="🔗" kicker={`КОМБО · ${t.streak} ДН.`}
          title={`+${t.combo} XP`} sub="серия активных дней" />;
        if (t.quest) return <Toast key={t.tid} color={C.green} icon="🎯" kicker={`ЗАДАНИЕ ДНЯ · +${t.xp} XP`} title={t.quest} />;
        if (t.goalDone) return <Toast key={t.tid} color={C.green} icon="🎯" kicker={`ЦЕЛЬ ВЫПОЛНЕНА · +${GOAL_DONE_XP} XP`} title={t.goalDone} sub="закрыта привязанной задачей" />;
        if (t.weekly) return <Toast key={t.tid} color={C.amber} icon="🏆" kicker={`ИСПЫТАНИЕ НЕДЕЛИ · +${WEEKLY_XP} XP`} title={t.weekly} />;
        const a = ACHIEVEMENTS.find(x => x.id === t.id); if (!a) return null;
        return <Toast key={t.tid} color={ACH_TIERS[a.tier].c} icon={a.icon} kicker="ДОСТИЖЕНИЕ ПОЛУЧЕНО" title={a.title} sub={a.desc} />;
      })}
    </div>
  );
}
