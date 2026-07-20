// Геймификация: настраиваемые штрафы/бонусы, уровни с потолком, ранги, звуки, квесты, испытания.
import { C } from './theme.js';
import { todayStr, daysBetween } from './dates.js';

// Настраиваемые значения (Настройки→Геймификация). settings.gamify перекрывает дефолты.
export const GAMIFY_DEFAULT = {
  antiXp: 15,      // сколько XP снимает один анти-тег на дне (сразу, обратимо)
  hpAnti: 5,       // здоровья за анти-тег/день (на replay)
  hpHabit: 3,      // здоровья за пропущенную запланированную привычку (cap ниже)
  hpDeadline: 4,   // здоровья за просроченный дедлайн дела (разово)
  comboBonus: 5,   // XP-бонус за каждый день комбо (× streak, cap COMBO_CAP_DAYS)
  hpSurrender: 10, // здоровья за «сдаться» у привычки (разово)
  impSurrender: 15,// импульса за «сдаться» (затухает за 7 дней, т.к. импульс вычисляемый)
};
export const IMPULSE_DECAY_DAYS = 7; // за сколько дней штраф импульса от «сдаться» сходит на нет
export const gamifyCfg = (settings) => ({...GAMIFY_DEFAULT, ...((settings&&settings.gamify)||{})});
export const HEALTH_MISSED_HABIT_CAP = 9;
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
  {id:'q_clean',   icon:'🧼', label:'День без анти-тегов',         xp:5, done:c=>c.tasksDone>0 && c.antiCount===0},
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
