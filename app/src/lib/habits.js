// Привычки: расписание и расчёт стриков (с заморозками). Стрик по ЗАПЛАНИРОВАННЫМ дням, сгорает при пропуске.
import { addDays } from './dates.js';

export const HABIT_WD = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']; // индекс = Date.getDay()
export const isHabitScheduled = (h, ds) => (h.schedule && h.schedule.type==='weekdays')
  ? (h.schedule.days||[]).includes(new Date(ds+'T00:00:00').getDay()) : true;
export const habitDoneOn = (h, ds) => !!(h.log && h.log[ds]);
export const habitCompletedCount = (h) => Object.values(h.log||{}).filter(Boolean).length;
export const habitScheduleLabel = (h) => (h.schedule && h.schedule.type==='weekdays')
  ? ((h.schedule.days||[]).slice().sort((a,b)=>((a+6)%7)-((b+6)%7)).map(d=>HABIT_WD[d]).join(' ') || 'дни не выбраны')
  : 'каждый день';
// текущий стрик: идём назад от сегодня по запланированным дням; сегодня «не поздно» выполнить (не рвём).
export const habitCurrentStreak = (h, today) => {
  let streak=0, first=true, guard=0; const freeze={}; let cursor=today;
  const start = h.createdAt || '2000-01-01';
  while(cursor>=start && guard++<4000){
    if(isHabitScheduled(h,cursor)){
      if(habitDoneOn(h,cursor)) streak++;
      else if(first && cursor===today){ /* сегодня ещё можно выполнить */ }
      else { const m=cursor.slice(0,7); if((h.freezesPerMonth||0)>(freeze[m]||0)) freeze[m]=(freeze[m]||0)+1; else break; }
    }
    first=false; cursor=addDays(cursor,-1);
  }
  return streak;
};
// Исторический рекорд серии (для «челлендж пройден» и достижений).
// 🔴 session 043: рекорд = наибольшее число отметок в НЕПРЕРЫВНОМ отрезке расписания, где в каждом месяце
// пропусков не больше freezesPerMonth — то же правило, что у текущей серии (она — такой отрезок, кончающийся
// сегодня). Раньше проход шёл вперёд с одним общим счётчиком заморозок: пустые дни до начала серии и пропуски
// уже оборванной серии съедали лимит, и рекорд выходил МЕНЬШЕ текущей серии (репро: 17 против 7), а «пройден»
// у челленджа с разрешёнными пропусками не засчитывался. Жадный перезапуск тоже не годится: иногда выгоднее
// начать серию позже и потратить лимит на более поздние пропуски. Поэтому — скользящее окно, один проход.
export const habitBestStreak = (h, today) => {
  if(!h.createdAt) return habitCurrentStreak(h, today);
  const F = h.freezesPerMonth||0;
  const win = []; let l=0, done=0, best=0, guard=0; const miss={}; let cursor=h.createdAt;
  while(cursor<=today && guard++<4000){
    if(isHabitScheduled(h,cursor)){
      if(habitDoneOn(h,cursor)){ win.push(1); done++; }
      else if(cursor!==today){ // сегодня ещё не поздно — не пропуск
        const m=cursor.slice(0,7); win.push(m); miss[m]=(miss[m]||0)+1;
        while(miss[m]>F){ const x=win[l++]; if(x===1) done--; else miss[x]--; }
      }
      if(done>best) best=done;
    }
    cursor=addDays(cursor,1);
  }
  return Math.max(best, habitCurrentStreak(h, today));
};
// 🔴 Челлендж считается по СЕРИИ, а не по общему числу отметок. Раньше здесь стоял
// `habitCompletedCount(h) >= h.targetDays` — сумма всех галочек за всё время, без непрерывности и без
// заморозок. Из-за этого шкала челленджа продолжала набираться после срыва: «дней подряд» обнулялось,
// а прогресс челленджа рос, потому что считал ДРУГУЮ величину. Два правила про одну и ту же дисциплину
// разъехались — тот же класс, что «просрочено» в session 035.
//
// Теперь обе величины считает один и тот же ход по журналу (habitCurrentStreak/habitBestStreak),
// который уважает разрешённые пропуски `freezesPerMonth`: можно пропустить N раз в месяц и серия живёт;
// пропустил сверх лимита — серия и прогресс челленджа начинаются заново.
//
// Прогресс = ТЕКУЩАЯ серия; «пройден» = ЛУЧШАЯ серия за всю историю (решение пользователя):
// раз дошёл — заслужил, и последующий срыв награду не отбирает, хотя шкала честно стартует с нуля.
export const habitChallengeRun = (h, today) => habitCurrentStreak(h, today);
export const habitChallengeDone = (h, today) => (h.targetDays>0) && (habitBestStreak(h, today) >= h.targetDays);
