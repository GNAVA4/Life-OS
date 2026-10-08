// Повестка дня (s058): ЕДИНОЕ место, где решается, что приходится на конкретный день из других вкладок —
// дела с дедлайном, напоминания из заметок, привычки по расписанию, цели (срок и темп), регулярные платежи,
// длительные задачи. Из этой функции строятся И блок «Повестка» на вкладке «Сегодня», И утренняя сводка
// в уведомлениях — поэтому они всегда показывают одно и то же. Чистая логика, покрыта node-тестом.
import { daysBetween } from './dates.js';
import { isHabitScheduled, habitDoneOn } from './habits.js';
import { goalMode, goalPaceItems } from './goals.js';
import { noteTitleOf, isOneShotReminder, reminderDone } from './notes.js';

// Разделы повестки — у каждого свой выключатель (Настройки → «Что показывать» → «Повестка дня — разделы»,
// id `agenda.<key>`) и свой выключатель в утренней сводке (settings.morningSummary.hide[key]).
export const AGENDA_SECTIONS = [
  { key:'overdue',   label:'Просрочено' },
  { key:'study',     label:'Дела со сроком' },
  { key:'reminders', label:'Напоминания' },
  { key:'habits',    label:'Привычки' },
  { key:'goals',     label:'Цели' },
  { key:'bills',     label:'Платежи' },
  { key:'ongoing',   label:'Длительные задачи' },
];

const isDone = (s) => s.status === 'Выполнено';
const plural = (n, forms) => { const a=Math.abs(n)%100, b=a%10;
  return forms[(a>10&&a<20)||b===0||b>4 ? 2 : b===1 ? 0 : 1]; };
export const dayWord = (n) => `${n} ${plural(n,['день','дня','дней'])}`;

// Число месяца платежа: 31-е в 30-дневном месяце (и 29–31 в феврале) приходится на последний день месяца,
// иначе такой платёж в коротком месяце не попадал бы в повестку вовсе.
const billDayIn = (dom, date) => { const [y,m] = date.split('-').map(Number); const last = new Date(y, m, 0).getDate();
  return Math.min(dom, last); };

// Напоминание из заметок, которое срабатывает в этот день. Повторяющиеся — по расписанию; разовые — по дате.
// done: у разового — общий флаг remindDone; у повторяющегося — отметка именно этого дня (remindDoneDays).
export function remindersOn(notes, date){
  const d = new Date(date+'T00:00:00'); const wd = d.getDay(), dom = d.getDate();
  return (notes||[]).filter(n => n && n.type==='Напоминание').filter(n => {
    const r = n.repeat || 'none';
    if(r==='daily') return true;
    if(r==='weekly') return (n.remindWeekday!=null ? Number(n.remindWeekday) : (n.remindDate ? new Date(n.remindDate+'T00:00:00').getDay() : -1)) === wd;
    if(r==='monthly'){ const day = n.remindDay!=null ? Number(n.remindDay) : (n.remindDate ? new Date(n.remindDate+'T00:00:00').getDate() : -1);
      return day>0 && billDayIn(day, date) === dom; }
    return n.remindDate === date;
  }).map(n => {
    const oneShot = isOneShotReminder(n);
    return { id:n.id, label:noteTitleOf(n), time:n.remindTime||'', repeat:n.repeat||'none', oneShot,
      done: oneShot ? reminderDone(n) : !!(n.remindDoneDays && n.remindDoneDays[date]) };
  }).sort((a,b) => (a.time||'99') < (b.time||'99') ? -1 : (a.time||'99') > (b.time||'99') ? 1 : 0);
}

// Всё, что приходится на день `date`. `today` — логический «сегодня» (todayStr()): просрочка считается
// относительно `date`, но то, что ЗАКРЫТО сегодня, остаётся в списке зачёркнутым — чтобы отметку можно
// было снять тем же нажатием, а не искать запись по вкладкам.
export function agendaFor(date, { study=[], notes=[], habits=[], goals={}, ongoing=[], bills=[] } = {}, { today=date, goalPaceCfg=null } = {}){
  // --- просрочено: незакрытое со сроком раньше дня (+ закрытое сегодня, чтобы отметку можно было снять) ---
  const overdue = [];
  const closedToday = (s) => isDone(s) && s.completedAt === today && date === today;
  (study||[]).forEach(s => { if(s.deadline && s.deadline < date && (!isDone(s) || closedToday(s)))
    overdue.push({ kind:'study', id:s.id, label:s.task, deadline:s.deadline, late:daysBetween(s.deadline, date), epic:s.epic, done:isDone(s) }); });
  (ongoing||[]).forEach(o => { if(o.endDate && o.endDate < date && (!o.done || (o.doneDate===today && date===today)))
    overdue.push({ kind:'ongoing', id:o.id, label:o.text, deadline:o.endDate, late:daysBetween(o.endDate, date), done:!!o.done }); });
  ['year','month','week','day'].forEach(scope => ((goals||{})[scope]||[]).forEach(g => {
    if(g.deadline && g.deadline < date && (g.progress||0) < 100)
      overdue.push({ kind:'goal', id:g.id, scope, label:g.title, deadline:g.deadline, late:daysBetween(g.deadline, date), done:false }); }));
  (notes||[]).forEach(n => { if(isOneShotReminder(n) && n.remindDate < date && !reminderDone(n))
    overdue.push({ kind:'note', id:n.id, label:noteTitleOf(n), deadline:n.remindDate, late:daysBetween(n.remindDate, date), done:false }); });
  overdue.sort((a,b) => a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0);

  // --- дела со сроком в этот день (и закрытые — зачёркнутыми) ---
  const studyDue = (study||[]).filter(s => s.deadline === date).map(s => {
    const cl = Array.isArray(s.checklist) ? s.checklist : [];
    return { id:s.id, label:s.task, epic:s.epic, status:s.status, done:isDone(s), urgency:s.urgency,
      checklist: cl.length ? { done: cl.filter(c=>c.done).length, total: cl.length } : null };
  });

  // --- длительные задачи, которые заканчиваются в этот день ---
  const ongoingDue = (ongoing||[]).filter(o => o.endDate === date).map(o => ({ id:o.id, label:o.text, done:!!o.done }));

  // --- цели: явный срок в этот день + темп «нужно по штуке в день» (тот же расчёт, что у уведомления о темпе) ---
  const goalsDue = [];
  ['year','month','week','day'].forEach(scope => ((goals||{})[scope]||[]).forEach(g => {
    if(g.deadline === date) goalsDue.push({ kind:'deadline', scope, id:g.id, label:g.title, mode:goalMode(g),
      counter: goalMode(g)==='counter' && g.counter ? { current:g.counter.current||0, target:g.counter.target } : null,
      progress:g.progress||0, done:(g.progress||0) >= 100 });
  }));
  goalPaceItems(goals, goalPaceCfg || undefined, date).forEach(p => {
    if(goalsDue.some(x => x.id === p.id && x.scope === p.scope)) return; // срок сегодня важнее темпа
    const g = ((goals||{})[p.scope]||[]).find(x => x.id === p.id) || {};
    goalsDue.push({ kind:'pace', scope:p.scope, id:p.id, label:p.title, need:p.need, left:p.left, daysLeft:p.daysLeft, urgent:p.urgent,
      mode:'counter', counter: g.counter ? { current:g.counter.current||0, target:g.counter.target } : null, done:false });
  });

  // --- привычки по расписанию (созданные не позже этого дня) ---
  const habitsDue = (habits||[]).filter(h => (!h.createdAt || h.createdAt <= date) && isHabitScheduled(h, date))
    .map(h => ({ id:h.id, label:h.name, done:habitDoneOn(h, date) }));

  // --- регулярные платежи этого числа ---
  const dom = Number(date.slice(8,10));
  const billsDue = (bills||[]).filter(b => { const d = parseInt(b.dayOfMonth,10); return d>=1 && billDayIn(d, date) === dom; })
    .map(b => ({ id:b.id, label:b.name, amount:Number(b.amount)||0 }));

  return { date, overdue, study:studyDue, reminders:remindersOn(notes, date), habits:habitsDue,
    goals:goalsDue, bills:billsDue, ongoing:ongoingDue };
}

// Сколько пунктов ТРЕБУЮТ внимания (незакрытых) — по включённым разделам.
export function agendaOpenCount(a, hidden = {}){
  if(!a) return 0;
  return AGENDA_SECTIONS.reduce((n, { key }) => hidden[key] ? n : n + (a[key]||[]).filter(i => !i.done).length, 0);
}

const fmtNum = (n) => String(n).replace('.', ',');
const money = (n) => `${Math.round(n).toLocaleString('ru-RU')} ₽`;
const WEEKDAY = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const MONTH_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
export const dayHeading = (date) => { const d = new Date(date+'T00:00:00'); return `${WEEKDAY[d.getDay()]}, ${d.getDate()} ${MONTH_GEN[d.getMonth()]}`; };
const MAX_LINES = 7;

// Текст утренней сводки для дня. Уведомление на Android показывает body в свёрнутом виде и largeBody —
// в развёрнутом (потянуть вниз). hidden — какие разделы выключены в настройках сводки.
// maskMoney — приватность финансов: на экране блокировки суммы платежей не показываем.
export function agendaNotifText(a, { hidden = {}, maskMoney = false, streak = 0 } = {}){
  const on = (k) => !hidden[k];
  const open = (k) => on(k) ? (a[k]||[]).filter(i => !i.done) : [];
  const overdue = open('overdue'), study = open('study'), rem = open('reminders'), habits = open('habits'),
    goals = open('goals'), bills = open('bills'), ongoing = open('ongoing');
  const lines = [];
  if(overdue.length===1) lines.push(`⚠ Просрочено: ${overdue[0].label} (${dayWord(overdue[0].late)})`);
  else if(overdue.length>1) lines.push(`⚠ Просрочено ${overdue.length}: ${overdue.slice(0,3).map(o=>o.label).join(', ')}${overdue.length>3?` и ещё ${overdue.length-3}`:''}`);
  study.forEach(s => lines.push(`📌 Срок сегодня: ${s.label}${s.checklist?` — ${s.checklist.done}/${s.checklist.total}`:''}`));
  ongoing.forEach(o => lines.push(`📌 Заканчивается: ${o.label}`));
  rem.forEach(r => lines.push(`⏰ ${r.time ? r.time+' ' : ''}${r.label}`));
  if(habits.length) lines.push(`🔁 Привычки: ${habits.map(h=>h.label).join(', ')}`);
  goals.forEach(g => lines.push(g.kind==='deadline' ? `🎯 Срок цели сегодня: ${g.label}` : `🎯 ${g.label}: нужно +${fmtNum(g.need)} шт/день`));
  bills.forEach(b => lines.push(`💳 ${b.label}${maskMoney ? '' : ' · '+money(b.amount)}`));

  const total = overdue.length + study.length + ongoing.length + rem.length + habits.length + goals.length + bills.length;
  const head = dayHeading(a.date);
  if(!total){
    return { title:`🌅 ${head}`, body: streak>0
      ? `Сегодня ничего срочного. Серия — ${dayWord(streak)}, не прерывай.`
      : 'Сегодня ничего срочного. Хороший день, чтобы начать что-то новое.', largeBody:null };
  }
  // Свёрнутый вид: самое важное одной строкой.
  const short = [];
  if(overdue.length) short.push(`⚠ ${overdue.length} просроч.`);
  if(study.length) short.push(study.length===1 ? `📌 ${study[0].label}` : `📌 ${study.length} срока`);
  if(rem.length) short.push(rem.length===1 ? `⏰ ${rem[0].time||rem[0].label}` : `⏰ ${rem.length} напомин.`);
  if(habits.length) short.push(`🔁 ${habits.length} привыч.`);
  if(!short.length && goals.length) short.push(`🎯 ${goals[0].label}`);
  if(!short.length && bills.length) short.push(`💳 ${bills[0].label}`);
  if(!short.length && ongoing.length) short.push(`📌 ${ongoing[0].label}`);
  const big = lines.length > MAX_LINES ? [...lines.slice(0, MAX_LINES-1), `…и ещё ${lines.length-(MAX_LINES-1)}`] : lines;
  return { title:`🌅 ${head} · ${total} ${plural(total,['пункт','пункта','пунктов'])}`, body: short.join(' · '), largeBody: big.join('\n') };
}

// Вечерний взгляд на завтра — короткая строка (что приходится на следующий день, без привычек:
// они каждый день одни и те же и только раздувают текст).
// Пункты «на завтра» (без эмодзи — их показывает и экран, где эмодзи не используются, ADR-005).
export function tomorrowItems(a, { hidden = {} } = {}){
  const on = (k) => !hidden[k];
  const out = [];
  if(on('study')) a.study.filter(s=>!s.done).forEach(s => out.push({ kind:'study', label:s.label }));
  if(on('ongoing')) a.ongoing.filter(o=>!o.done).forEach(o => out.push({ kind:'ongoing', label:o.label }));
  if(on('reminders')) a.reminders.filter(r=>!r.done && r.oneShot).forEach(r => out.push({ kind:'note', label:(r.time ? r.time+' ' : '')+r.label }));
  if(on('goals')) a.goals.filter(g=>g.kind==='deadline' && !g.done).forEach(g => out.push({ kind:'goal', label:g.label }));
  if(on('bills')) a.bills.forEach(b => out.push({ kind:'bill', label:b.label }));
  return out;
}
const TOMORROW_EMOJI = { study:'📌', ongoing:'📌', note:'⏰', goal:'🎯', bill:'💳' };
export function tomorrowText(a, opts = {}){
  return tomorrowItems(a, opts).map(i => `${TOMORROW_EMOJI[i.kind]} ${i.label}`);
}
