// Геймификация: настраиваемые штрафы/бонусы, уровни с потолком, ранги, звуки, квесты, испытания.
import { C } from './theme.js';
import { todayStr, daysBetween, addDays } from './dates.js';
import { isHabitScheduled } from './habits.js';
import { missedStudyDeadlineOn } from './deadlines.js';

// Настраиваемые значения (Настройки→Геймификация). settings.gamify перекрывает дефолты.
export const GAMIFY_DEFAULT = {
  antiXp: 15,      // сколько XP снимает один анти-тег на дне (сразу, обратимо)
  hpAnti: 5,       // здоровья за анти-тег/день (на replay)
  hpHabit: 3,      // здоровья за пропущенную запланированную привычку (cap ниже)
  hpDeadline: 4,   // здоровья за просроченный дедлайн дела (разово)
  comboBonus: 5,   // XP-бонус за каждый день комбо (× streak, cap COMBO_CAP_DAYS)
  hpSurrender: 10, // здоровья за «сдаться» у привычки (разово)
  impSurrender: 15,// импульса за «сдаться» (затухает за 7 дней, т.к. импульс вычисляемый)
  // ❤ НАГРАДЫ здоровья. До этого единственным источником восстановления был hpActive(+5), и его
  // перекрывал почти любой штраф (анти-тег −5, пропуск привычки −3…−9) → здоровье только падало.
  // Значения согласованы с пользователем (вариант «награды за качество дня»).
  hpActive: 5,     // здоровья за активный день (было захардкожено 5 в App.jsx)
  hpPerfect: 3,    // + все одноразовые задачи дня закрыты
  hpClean: 2,      // + день без анти-тегов (только начиная с эпохи анти-тегов, см. ниже)
  hpHabitsAll: 3,  // + все запланированные на день привычки отмечены
  hpDone: 3,       // + за каждое закрытое в этот день дело/цель (cap ниже)
};
export const IMPULSE_DECAY_DAYS = 7; // за сколько дней штраф импульса от «сдаться» сходит на нет
export const gamifyCfg = (settings) => ({...GAMIFY_DEFAULT, ...((settings&&settings.gamify)||{})});
export const HEALTH_MISSED_HABIT_CAP = 9;
// Зеркало HEALTH_MISSED_HABIT_CAP: разбор завалов (закрыл 10 дел за день) не должен разом заливать
// шкалу здоровья до 100 — иначе штрафы предыдущих дней обнуляются одним махом.
export const HEALTH_DONE_CAP = 9;
// ❤ Дельта здоровья за ОДИН завершённый день. Чистая функция — вся «правда» о том, за что здоровье
// растёт и падает, в одном месте и под node-тестом (внутри App.jsx это было замыкание внутри эффекта).
// Вызывающий обязан передать уже отфильтрованные по createdAt/эпохе входы — см. комментарии полей.
// Возвращает {total, parts:[[подпись, значение],…]} — parts нужны, чтобы показать пользователю
// РАСШИФРОВКУ «за что вчера +13 / −7»: без неё шкала выглядит как число, которое само куда-то ползёт.
export const healthDayBreakdown = ({
  hasActivity = false,   // была ли активность (задачи/ежедневные/привычки)
  hadTasks = false,      // было ли ЧТО делать (одноразовые задачи или активные «Ежедневные»)
  allTasksDone = false,  // все одноразовые задачи дня закрыты (и их было ≥1)
  cleanDay = false,      // анти-тегов нет И день не раньше эпохи анти-тегов
  habitsAllDone = false, // были запланированные привычки и ни одна не пропущена
  closedCount = 0,       // закрытых в этот день дел/целей (active+archive)
  antiCount = 0,         // анти-тегов на дне
  missedHabits = 0,      // пропущено запланированных привычек
  overdueDeadlines = 0,  // дедлайнов дел, ПРОВАЛЕННЫХ именно в этот день (разовый штраф)
}, g = GAMIFY_DEFAULT) => {
  const parts = [];
  const add = (label, v) => { if(v) parts.push([label, v]); };
  if(hasActivity) add('Активный день', g.hpActive);
  else if(hadTasks) add('Пустой день с задачами', -10);
  // else: день отдыха (делать было нечего) → ни штрафа, ни наград
  // Награды за качество дня — только в активные дни: иначе пустой день «без анти-тегов»
  // лечил бы здоровье сам по себе, за бездействие.
  if(hasActivity){
    if(allTasksDone) add('Все задачи закрыты', g.hpPerfect);
    if(cleanDay) add('Без анти-тегов', g.hpClean);
    if(habitsAllDone) add('Все привычки отмечены', g.hpHabitsAll);
  }
  if(closedCount>0) add(`Закрыто дел/целей: ${closedCount}`, Math.min(HEALTH_DONE_CAP, g.hpDone*closedCount));
  add(`Анти-теги: ${antiCount}`, -g.hpAnti * antiCount);
  add(`Пропуск привычек: ${missedHabits}`, -Math.min(HEALTH_MISSED_HABIT_CAP, g.hpHabit*missedHabits));
  add(`Провален дедлайн: ${overdueDeadlines}`, -g.hpDeadline * overdueDeadlines);
  return { total: parts.reduce((s,[,v])=>s+v, 0), parts };
};

export const healthDayDelta = (input, g = GAMIFY_DEFAULT) => healthDayBreakdown(input, g).total;

// Сколько ЗАВЕРШЁННЫХ дней максимум доигрываем за один запуск (не заходил месяц — не считаем вечность).
// Курсор сохраняется докуда реально дошли, остаток доигрывается в следующий запуск (session 033).
export const HEALTH_REPLAY_CAP = 60;

// ❤ Реплей здоровья по завершённым дням: от meta.lastHealthCheck до «сегодня» (не включая — сегодня
// ещё не закончился). Возвращает НОВУЮ meta, ничего не пишет: и вызов на старте, и вызов после
// адопции облака должны получать один и тот же результат из одних и тех же данных.
// Идемпотентна по курсору: повторный вызов на уже посчитанном интервале ничего не меняет.
export function replayHealth(store, today = todayStr()){
  const meta = store.meta || {};
  const days = store.days || {};
  const habits = store.habits || [];
  const dailies = store.dailies || [];
  const study = store.study || [];
  const studyArchive = store.studyArchive || [];
  const goals = store.goals || {};
  const goalsArchive = store.goalsArchive || [];
  const g = gamifyCfg(store.settings || {});
  // Закрытые сущности считаем по active+archive: иначе архивация задним числом меняла бы награду
  // (правило «множество», session 033).
  const closableAll = [
    ...study.filter(x=>x.status==='Выполнено'), ...studyArchive,
    ...(goals.year||[]), ...(goals.month||[]), ...(goals.week||[]), ...goalsArchive,
  ];
  // Эпоха анти-тегов = первая дата, где анти-тег вообще отмечался. Награда «день без анти-тегов» —
  // это награда за ОТСУТСТВИЕ признака: без эпохи вся история до появления фичи выглядит идеальной
  // (тот же класс бага, что cleanDays, session 033). Если анти-теги не использовались НИ РАЗУ, эпохи
  // нет и делить историю не на что — награду даём (фича просто не используется).
  const antiEpoch = Object.keys(days).filter(d => ((days[d]||{}).antiTags||[]).length>0).sort()[0] || null;

  let cursor = meta.lastHealthCheck || today;
  let health = meta.health ?? 100;
  const log = {...(meta.healthLog||{})};   // {дата: значение ❤ ПОСЛЕ этого дня} — витрина для графика
  let lastDay = meta.healthLastDay || null; // расшифровка последнего посчитанного дня («за что»)
  let steps = 0;
  while(cursor < today && steps < HEALTH_REPLAY_CAP){
    const dayE = days[cursor] || {};
    const hasActivity = (dayE.tasks||[]).some(x=>x.done) ||
      Object.values(dayE.dailyCompletions||{}).some(Boolean) ||
      habits.some(h => h.log && h.log[cursor]);
    // «было что делать» = одноразовые задачи на этот день ИЛИ активные «Ежедневные». Раньше учитывались
    // только одноразовые → кто живёт на ежедневных, штраф за пустой день не получал никогда. session 033
    const hadTasks = (dayE.tasks||[]).length>0
      || dailies.some(d => d.active!==false && (!d.createdAt || d.createdAt<=cursor));
    // Гейт createdAt: без него привычка, созданная сегодня, ретроактивно штрафует за дни, когда её
    // ещё не было (habitCurrentStreak/habitBestStreak такой гейт имеют, здоровье — нет). session 033
    const scheduledHabits = habits.filter(h => (!h.createdAt || h.createdAt<=cursor)
      && isHabitScheduled(h,cursor));
    const missedHabits = scheduledHabits.filter(h => !(h.log && h.log[cursor])).length;
    const dayTasks = dayE.tasks||[];
    // Дедлайн ПРОВАЛЕН в этот день — разовый штраф на следующий день после срока. Это ДРУГОЙ вопрос,
    // чем «просрочено прямо сейчас» (уведомления): дело, закрытое позже срока, дедлайн провалило, но
    // просроченным уже не является. Оба правила живут в lib/deadlines.js и не разъезжаются.
    const overdueDeadlines = study.filter(x => missedStudyDeadlineOn(x, cursor)).length;
    const br = healthDayBreakdown({
      hasActivity, hadTasks,
      allTasksDone: dayTasks.length>0 && dayTasks.every(x=>x.done),
      cleanDay: (dayE.antiTags||[]).length===0 && (!antiEpoch || cursor>=antiEpoch),
      habitsAllDone: scheduledHabits.length>0 && missedHabits===0,
      closedCount: closableAll.filter(x => x.completedAt===cursor).length,
      antiCount: (dayE.antiTags||[]).length,
      missedHabits, overdueDeadlines,
    }, g);
    health = Math.max(0, Math.min(100, health + br.total));
    // История ❤ по дням: сама шкала — свёрнутое число, по нему нельзя построить график и нельзя
    // объяснить, «за что». Пишем значение ПОСЛЕ дня (для графика) и расшифровку последнего дня.
    log[cursor] = health;
    lastDay = { date: cursor, total: br.total, parts: br.parts };
    cursor = addDays(cursor, 1);
    steps++;
  }
  // lastHealthCheck = докуда РЕАЛЬНО дошёл цикл, а не «сегодня»: при упоре в кэп (не заходил долго)
  // остаток дней раньше молча терялся навсегда — теперь досчитается при следующем запуске. session 033
  // Лог подрезаем: это витрина для графика, а не источник правды — здоровье живёт в meta.health.
  const logKeys = Object.keys(log).sort();
  const trimmed = logKeys.length>HEALTH_LOG_DAYS
    ? Object.fromEntries(logKeys.slice(-HEALTH_LOG_DAYS).map(k=>[k, log[k]])) : log;
  return {...meta, health, lastHealthCheck: cursor, healthLog: trimmed, healthLastDay: lastDay};
}

// 🔴 Слияние meta, пришедшей ИЗ ОБЛАКА, с локальной. Все поля — last-write-wins (облако новее), КРОМЕ
// пары {health, lastHealthCheck}: она МОНОТОННА по курсору — кто дальше прошёл по дням, тот уже учёл
// их вклад в шкалу. Принять пару с более РАННИМ курсором = откатить учтённые дни: здоровье падает
// обратно, а те же дни доигрываются заново при каждом запуске (и никогда не доезжают до облака,
// потому что реплей на старте случается ДО того, как поднимется синк). Это и есть баг
// «здоровье на секунду правильное, потом минимальное». session 037.
export function mergeMetaHealth(local, remote){
  if(!local || !remote) return remote;
  const lc = local.lastHealthCheck, rc = remote.lastHealthCheck;
  if(!lc || (rc && rc >= lc)) return remote;   // облако не отстаёт — берём его целиком, как раньше
  return {
    ...remote,
    health: local.health, lastHealthCheck: lc,
    // Лог — витрина: склеиваем оба, локальные значения главнее (они соответствуют оставленной шкале).
    healthLog: {...(remote.healthLog||{}), ...(local.healthLog||{})},
    healthLastDay: local.healthLastDay || remote.healthLastDay,
  };
}

export const COMBO_CAP_DAYS = 10;      // на скольких днях подряд комбо-бонус максимален
export const WEEKLY_XP = 50;           // награда за испытание недели

// 🎯 Ежедневные квесты: детерминированно 3/день из пула; бонус XP разово при выполнении. session 024.
export const QUEST_POOL = [
  {id:'q_tasks3',  icon:'✅', label:'Выполни 3 задачи',            xp:5, done:c=>c.tasksDone>=3},
  {id:'q_perfect', icon:'🎯', label:'Закрой все задачи дня (3+)',  xp:8, done:c=>c.taskTotal>=3 && c.tasksDone===c.taskTotal},
  {id:'q_daily',   icon:'🔁', label:'Закрой ежедневную',           xp:3, need:c=>c.hasDailies, done:c=>c.dailyDone>=1},
  {id:'q_habit',   icon:'💪', label:'Отметь привычку',             xp:3, need:c=>c.hasHabits,  done:c=>c.habitDone>=1},
  {id:'q_rating',  icon:'⭐', label:'Оцени день',                  xp:3, done:c=>c.rated},
  {id:'q_note',    icon:'📓', label:'Опиши день',                  xp:3, done:c=>c.noted},
  // deferred: «весь день» условие — засчитывается ТОЛЬКО когда день прошёл (settle за вчера), не авансом. session 032
  {id:'q_clean',   icon:'🧼', label:'День без анти-тегов',         xp:5, deferred:true, done:c=>c.tasksDone>0 && c.antiCount===0},
  {id:'q_sleep',   icon:'😴', label:'Отметь сон 7ч+',              xp:3, done:c=>c.sleep>=7},
];
const _hashStr = (s) => { let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h>>>0; };
// детерминированный выбор n элементов по сид-строке (одинаков для одной даты)
export function pickSeeded(arr, n, seedStr){
  const pool=[...arr]; const out=[]; let h=_hashStr(seedStr);
  while(out.length<Math.min(n,arr.length) && pool.length){ h=(Math.imul(h,1103515245)+12345)>>>0; out.push(pool.splice(h%pool.length,1)[0]); }
  return out;
}
export const questsForDate = (dateStr, ctx) => pickSeeded(QUEST_POOL.filter(q=>!q.need || q.need(ctx)), 3, 'q'+dateStr);

// 🏆 Испытание недели: одно на ISO-неделю (детерминированно). val(w) — прогресс за неделю.
export const WEEKLY_POOL = [
  {id:'w_tasks20',  icon:'✅', label:'Выполни 20 задач за неделю', target:20, val:w=>w.tasksDone},
  {id:'w_perfect3', icon:'🎯', label:'3 идеальных дня',           target:3,  val:w=>w.perfectDays},
  {id:'w_active6',  icon:'🔥', label:'6 активных дней',           target:6,  val:w=>w.activeDays},
  {id:'w_study3',   icon:'🎓', label:'Закрой 3 дела',             target:3,  val:w=>w.studyDone},
  {id:'w_rating5',  icon:'⭐', label:'Оцени 5 дней',              target:5,  val:w=>w.ratedDays},
];
export const weeklyForPeriod = (period) => pickSeeded(WEEKLY_POOL, 1, 'w'+period)[0];

// Уровни: плавно растущая стоимость с ПОТОЛКОМ (session 024). Сумма до 50 ≈ 17k XP.
export const LEVEL_CAP = 50;
export const LEVEL_CUM = (()=>{ const cum=[0,0]; // cum[L] = суммарный XP, чтобы БЫТЬ на уровне L; cum[1]=0
  for(let L=2; L<=LEVEL_CAP; L++){ cum[L] = cum[L-1] + Math.round(100 + 10.4*(L-2)); }
  return cum; })();
export function levelForXp(xp){
  xp = Math.max(0, Math.floor(xp||0));
  let level = 1;
  for(let L=LEVEL_CAP; L>=1; L--){ if(xp >= LEVEL_CUM[L]){ level = L; break; } }
  if(level >= LEVEL_CAP) return { level: LEVEL_CAP, into: 0, needed: 0, max: true };
  return { level, into: xp - LEVEL_CUM[level], needed: LEVEL_CUM[level+1] - LEVEL_CUM[level], max: false };
}
// Ранги/титулы поверх уровня (session 024) — крупные вехи с иконкой; показываются в профиле/шапке.
export const RANKS = [
  {min:1,  name:'Новобранец', icon:'🌱', color:C.dim},
  {min:5,  name:'Искатель',   icon:'🧭', color:C.cyan},
  {min:10, name:'Ветеран',    icon:'🛡', color:C.cyan},
  {min:18, name:'Мастер',     icon:'⚔️', color:C.green},
  {min:27, name:'Эксперт',    icon:'🎖', color:C.amber},
  {min:37, name:'Легенда',    icon:'🔥', color:C.amber},
  {min:50, name:'Абсолют',    icon:'👑', color:C.purple},
];
export const rankForLevel = (lvl) => { let r=RANKS[0]; for(const x of RANKS){ if(lvl>=x.min) r=x; } return r; };
export const nextRank = (lvl) => RANKS.find(x=>x.min>lvl) || null;

let _audioCtx = null;
// «фанфара» на новый уровень — восходящее арпеджио, ярче обычного «дзиня» наград. session 024
export function playLevelUpSound(){
  try{
    _audioCtx = _audioCtx || new (window.AudioContext||window.webkitAudioContext)();
    const ctx=_audioCtx; if(ctx.state==='suspended') ctx.resume();
    const now=ctx.currentTime;
    [[523.25,0],[659.25,0.09],[783.99,0.18],[1046.5,0.27],[1318.5,0.40]].forEach(([f,dt])=>{
      const o=ctx.createOscillator(), g=ctx.createGain(); o.type='triangle'; o.frequency.value=f;
      o.connect(g); g.connect(ctx.destination); const t=now+dt;
      g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.22,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.45);
      o.start(t); o.stop(t+0.5);
    });
  }catch(e){}
}
// короткий приятный «дзинь» при получении награды — через WebAudio, без внешних файлов (офлайн/Android)
export function playAchSound(){
  try{
    _audioCtx = _audioCtx || new (window.AudioContext||window.webkitAudioContext)();
    const ctx=_audioCtx; if(ctx.state==='suspended') ctx.resume();
    const now=ctx.currentTime;
    [[880,0],[1174.66,0.10],[1567.98,0.20]].forEach(([f,dt])=>{
      const o=ctx.createOscillator(), g=ctx.createGain(); o.type='sine'; o.frequency.value=f;
      o.connect(g); g.connect(ctx.destination); const t=now+dt;
      g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.18,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.28);
      o.start(t); o.stop(t+0.3);
    });
  }catch(e){}
}
// остаток штрафа импульса от «сдаться» — линейно затухает за IMPULSE_DECAY_DAYS дней (session: habit-surrender-penalty)
export const impulsePenaltyRemaining = (pen, today=todayStr()) => {
  if(!pen || !pen.amt || !pen.date) return 0;
  const frac = Math.max(0, (IMPULSE_DECAY_DAYS - daysBetween(pen.date, today)) / IMPULSE_DECAY_DAYS);
  return pen.amt * frac;
};

// Сколько дней истории ❤ храним в meta.healthLog. ~полгода: достаточно для любого периода Статистики
// (максимум там — год, но график здоровья за год нечитаем), а localStorage это почти не занимает.
export const HEALTH_LOG_DAYS = 180;
