// Дедлайны и просрочка — ЕДИНОЕ место правил для всех сущностей со сроком: дела, цели, длительные
// задачи. Чистая логика (планирование — в notifications.js), поэтому покрывается node-тестом.
import { addDays, daysBetween } from './dates.js';

// Тип срока → как показать в уведомлении. Пользователю важно, ЧТО просрочено, а не только название.
export const KIND_META = {
  study:   { icon:'🗂', word:'Дело' },
  goal:    { icon:'🎯', word:'Цель' },
  ongoing: { icon:'📌', word:'Задача' },
};

// Приведение разных сущностей к одному виду {kind, label, deadline}. Единственное место, где записано
// «что считается ещё НЕ закрытым» для каждого типа: дело — статус, цель — прогресс, задача — флаг done.
export function deadlineItems({ study=[], goals={}, ongoing=[] } = {}, { goalsOff=false, ongoingOff=false } = {}){
  const out = [];
  (study||[]).forEach(s => { if(s.deadline && s.status!=='Выполнено')
    out.push({ kind:'study', label:s.task, deadline:s.deadline }); });
  if(!goalsOff) ['year','month','week','day'].forEach(sc => (goals[sc]||[]).forEach(g => {
    if(g.deadline && (g.progress||0)<100) out.push({ kind:'goal', label:g.title, deadline:g.deadline }); }));
  if(!ongoingOff) (ongoing||[]).forEach(o => { if(o.endDate && !o.done)
    out.push({ kind:'ongoing', label:o.text, deadline:o.endDate }); });
  return out.filter(i => i.label);
}

const plural = (n, forms) => { const a=Math.abs(n)%100, b=a%10;
  return forms[(a>10&&a<20)||b===0||b>4 ? 2 : b===1 ? 0 : 1]; };
const dayWord = (n) => `${n} ${plural(n,['день','дня','дней'])}`;

// «Просрочено ПРЯМО СЕЙЧАС» — длящееся СОСТОЯНИЕ (о нём напоминаем повторяющимся уведомлением).
// Не путать с missedDeadlineOn ниже: это разные вопросы, намеренно разные функции.
export const overdueOf = (items, today) => (items||[])
  .filter(i => i.deadline && i.deadline < today)
  .sort((a,b) => a.deadline<b.deadline ? -1 : a.deadline>b.deadline ? 1 : 0);

// Одно тело уведомления на ВСЕ просроченные: их число ничем не ограничено, а лимит запланированных
// уведомлений у Android — ограничен (плюс 20 пушек подряд = шум, а не мотивация).
// Текст эскалирует: чем дольше просрочка, тем больше дней в сообщении.
export const overdueBody = (overdue, today) => {
  if(!overdue.length) return '';
  const late = (i) => daysBetween(i.deadline, today);
  const ico = (i) => (KIND_META[i.kind]||{}).icon || '';
  if(overdue.length===1){
    const i = overdue[0];
    return `${ico(i)} ${i.label} — просрочено на ${dayWord(late(i))}!`;
  }
  const head = overdue.slice(0,3).map(i=>`${ico(i)} ${i.label} (${dayWord(late(i))})`).join(', ');
  const rest = overdue.length>3 ? ` и ещё ${overdue.length-3}` : '';
  return `Просрочено: ${overdue.length} — ${head}${rest}`;
};

// «Дедлайн был ПРОВАЛЕН в этот день» — историческое СОБЫТИЕ (разовый штраф здоровья на следующий день
// после срока). Отличается от overdueOf намеренно: дело, закрытое ПОЗЖЕ срока, дедлайн провалило,
// но «просроченным прямо сейчас» уже не является. Раньше оба правила были расписаны по месту
// (App.jsx и notifications.js) и незаметно разъезжались.
export const missedStudyDeadlineOn = (s, date) => !!s.deadline && date === addDays(s.deadline, 1)
  && ((s.status!=='Выполнено') || (!!s.completedAt && s.completedAt > s.deadline));
