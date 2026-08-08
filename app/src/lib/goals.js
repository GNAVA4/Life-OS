// Привязка «выполнил → вклад в цель»: опции пикера, поиск цели по ключу, нормализация ссылок.
import { GL_SCOPE, GOAL_PACE_DEFAULT } from './constants.js';
import { todayStr, toLocalISODate, daysBetween } from './dates.js';

export const goalLinkOptions = (goals) => { const out=[{value:'',label:'— без привязки —'}];
  ['year','month','week','day'].forEach(sc=>(goals[sc]||[]).forEach(g=>out.push({value:`${sc}|${g.id}`,
    label:`${GL_SCOPE[sc]}: ${g.title}${goalMode(g)==='counter'&&g.counter?` (${g.counter.current||0}/${g.counter.target})`:''}`}))); return out; };
export const goalByKey = (goals, key) => { if(!key) return null; const [sc,gid]=key.split('|'); return (goals[sc]||[]).find(g=>g.id===gid)||null; };
// нормализация: новая модель goalLinks (массив) ИЛИ легаси goalLink (один) → всегда массив. session 015.
export const goalLinksOf = (item) => item && Array.isArray(item.goalLinks) ? item.goalLinks : (item && item.goalLink ? [item.goalLink] : []);
// активный режим цели: none | slider | subtasks | counter. legacy: undefined mode + counter/subtasks → выводим.
// ВАЖНО: с session 026 setGoalMode НЕ стирает counter/subtasks при смене типа, поэтому различать
// «штуки vs %» нужно по mode, а НЕ по наличию g.counter (иначе %-цель со старым counter считается в штуках).
export const goalMode = (g) => g && g.mode ? g.mode : (g && g.counter ? 'counter' : g && g.subtasks ? 'subtasks' : 'slider');

// Последний день текущего периода скоупа — НЕЯВНЫЙ дедлайн, если явный не задан.
// Жил в GoalsTab; вынесен, потому что тем же расчётом теперь пользуются уведомления о темпе,
// а два экземпляра одной формулы неизбежно разъедутся.
export const endOfScope = (scope, today = todayStr()) => {
  const d = new Date(today+'T00:00:00');
  if(scope==='day') return today;
  if(scope==='week'){ const wd=(d.getDay()+6)%7; const end=new Date(d); end.setDate(d.getDate()+(6-wd)); return toLocalISODate(end); } // Пн=0 → до Вс
  if(scope==='month') return toLocalISODate(new Date(d.getFullYear(), d.getMonth()+1, 0));
  if(scope==='year')  return `${d.getFullYear()}-12-31`;
  return null;
};

// 🎯 Темп к дедлайну: сколько нужно в день, чтобы успеть; или ✓ / просрочено.
// Дедлайн — явный (g.deadline) ИЛИ неявный = конец периода скоупа.
export const paceInfo = (g, scope, today = todayStr()) => {
  const deadline = g.deadline || endOfScope(scope, today);
  if(!deadline) return null;
  if((g.progress||0)>=100) return {done:true, explicit:!!g.deadline};
  if(deadline < today) return {overdue:true, explicit:!!g.deadline};
  const daysLeft = daysBetween(today, deadline) + 1;
  let rem, unit;
  if(goalMode(g)==='counter' && g.counter){ rem=Math.max(0,g.counter.target-(g.counter.current||0)); unit=' шт'; }
  else { rem=Math.max(0,100-(g.progress||0)); unit='%'; }
  return {daysLeft, need: Math.round(rem/Math.max(1,daysLeft)*10)/10, unit, explicit:!!g.deadline};
};

// 🎯 Цели В ШТУКАХ, у которых требуемый темп подошёл к «по штуке в день» и выше — повод предупредить
// ЗАРАНЕЕ, а не по факту провала (запрос пользователя). Порог из настроек: `min` (тревога) и `warnAt`
// (приближение). Скоуп «День» исключён намеренно: у него дедлайн всегда сегодня, поэтому любая
// незакрытая дневная цель формально требует «весь остаток за день» и уведомление шумело бы каждый день.
export function goalPaceItems(goals, cfg = GOAL_PACE_DEFAULT, today = todayStr()){
  const c = {...GOAL_PACE_DEFAULT, ...(cfg||{})};
  const out = [];
  ['year','month','week'].forEach(scope => (goals && goals[scope] || []).forEach(g => {
    if(goalMode(g)!=='counter' || !g.counter) return;
    const p = paceInfo(g, scope, today);
    if(!p || p.done || p.overdue || !p.need) return;
    if(p.need < c.warnAt) return;
    out.push({ scope, id:g.id, title:g.title, need:p.need, daysLeft:p.daysLeft,
      left: Math.max(0, (g.counter.target||0) - (g.counter.current||0)),
      urgent: p.need >= c.min });
  }));
  return out.sort((a,b) => b.need - a.need);
}

// Тело уведомления о темпе: всё в ОДНОМ уведомлении (их число не ограничено, а лимит Android — да).
export function goalPaceBody(items){
  if(!items.length) return '';
  const one = (i) => `${i.title}: +${String(i.need).replace('.',',')} шт/день (осталось ${i.left} за ${i.daysLeft} дн.)`;
  if(items.length===1) return one(items[0]);
  return items.slice(0,3).map(one).join('; ') + (items.length>3 ? ` и ещё ${items.length-3}` : '');
}

// Живые привязки: те, чья цель ЕСТЬ среди активных. Нужно шаблонам задач — шаблон живёт дольше цели,
// и часть привязок к моменту применения уже мертва (цель закрыта, заархивирована, удалена).
// Сопоставление СТРОГО по id (решение пользователя): перенос цели на новый период (carry) id сохраняет,
// поэтому такие привязки переживают смену недели/месяца, а «похожая» цель с тем же названием чужой
// привязки не получит. Было 3 привязки, одной цели нет → останется 2; не осталось ни одной → задача
// добавится вообще без привязок.
export const liveGoalLinks = (links, goals) => (links||[]).filter(l =>
  l && l.scope && l.goalId && ((goals && goals[l.scope]) || []).some(g => g.id === l.goalId));

// Вклад привязок в цели ОДНОЙ операцией: пересчитывает все цели сразу и заодно сообщает, какие
// пересекли 100% в ту или иную сторону. Раньше каждая привязка делала свой setGoals, а награду за
// достижение цели через привязку не выдавал никто — цель закрывалась молча, хотя тот же переход
// ползунком давал +20 XP и дату выполнения. Чистая функция: XP и тосты — забота вызывающего.
// sign: +1 выполнил, −1 откатил. Возвращает {goals, crossedUp, crossedDown}.
export function applyGoalLinks(goals, links, sign, today){
  const live = liveGoalLinks(links, goals);
  if(!live.length) return { goals, crossedUp:[], crossedDown:[] };
  const next = {...goals};
  const crossedUp = [], crossedDown = [];
  live.forEach(link => {
    if(!link.amount) return;
    next[link.scope] = (next[link.scope]||[]).map(g => {
      if(g.id !== link.goalId) return g;
      const was = (g.progress||0) >= 100;
      let ng;
      if(goalMode(g)==='counter' && g.counter){
        const cur = Math.max(0, (g.counter.current||0) + sign*link.amount);
        ng = {...g, counter:{...g.counter, current:cur},
          progress: g.counter.target>0 ? Math.min(100, Math.round(cur/g.counter.target*100)) : g.progress};
      } else {
        ng = {...g, progress: Math.max(0, Math.min(100, (g.progress||0) + sign*link.amount))};
      }
      const now = (ng.progress||0) >= 100;
      // Дата выполнения — как в ручном пути: ставится при первом переходе и снимается при откате.
      ng.completedAt = now ? (g.completedAt || today) : undefined;
      if(!was && now) crossedUp.push({scope:link.scope, id:g.id, title:g.title});
      if(was && !now) crossedDown.push({scope:link.scope, id:g.id, title:g.title});
      return ng;
    });
  });
  return { goals: next, crossedUp, crossedDown };
}
