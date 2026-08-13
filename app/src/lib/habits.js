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
// исторический рекорд стрика (для достижений): идём вперёд от createdAt.
export const habitBestStreak = (h, today) => {
  if(!h.createdAt) return habitCurrentStreak(h, today);
  let run=0, max=0, guard=0; const freeze={}; let cursor=h.createdAt;
  while(cursor<=today && guard++<4000){
    if(isHabitScheduled(h,cursor)){
      if(habitDoneOn(h,cursor)){ run++; if(run>max) max=run; }
      else if(cursor===today){ /* сегодня ещё не поздно */ }
      else { const m=cursor.slice(0,7); if((h.freezesPerMonth||0)>(freeze[m]||0)) freeze[m]=(freeze[m]||0)+1; else run=0; }
    }
    cursor=addDays(cursor,1);
  }
  return Math.max(max, run);
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
