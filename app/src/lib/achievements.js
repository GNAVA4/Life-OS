// Движок достижений: награды ВЫЧИСЛЯЮТСЯ из всей истории; хранится только {unlocked:{[id]:дата}, seeded}.
import { C } from './theme.js';
import { fmtMoney, compactNum } from './format.js';
import { BASE_EPICS } from './constants.js';
import { todayStr, daysBetween } from './dates.js';
import { levelForXp } from './gamify.js';
import { habitCompletedCount, habitBestStreak, habitChallengeDone } from './habits.js';
import { accountBalanceNow, unassignedNetOn } from './finance.js';

export const ACH_TIERS = {
  common:  {c:C.cyan,   label:'обычная',     pts:1},
  uncommon:{c:C.green,  label:'необычная',   pts:2},
  rare:    {c:C.amber,  label:'редкая',      pts:3},
  epic:    {c:C.purple, label:'эпическая',   pts:5},
  legend:  {c:C.red,    label:'легендарная', pts:10},
};
// самая длинная серия ИДУЩИХ ПОДРЯД дат в отсортированном списке дат
export const longestRun = (sortedDates) => {
  let max=0, run=0, prev=null;
  for(const ds of sortedDates){ run = (prev && daysBetween(prev,ds)===1) ? run+1 : 1; if(run>max) max=run; prev=ds; }
  return max;
};

export function computeAchStats({days, goals, study, notes, finance, meta, ongoing, budgets, habits, goalsArchive, studyArchive, habitsArchive}){
  // Архивные дела/привычки ДОЛЖНЫ учитываться в достижениях: награды не липкие (ADR-002), поэтому
  // без слияния архивированное дело выпадает из метрик → достижение сбрасывается. Цели уже так лечат
  // (goalsArchive ниже). session: archive-counts-in-achievements.
  const allStudy = [...(study||[]), ...(studyArchive||[])];
  const allHabits = [...(habits||[]), ...(habitsArchive||[])];
  const s = {};
  let tasksDone=0, perfectDays=0, noteDays=0, rating10count=0, ratingDays=0, sleepNights=0, daysLogged=0, maxTagsDay=0, maxTasksDay=0;
  let questsDone=0, cleanDays=0; // геймификация (session 024): выполнено квестов, активных дней без анти-тегов
  const doneDates=[], ratingHighDates=[], sleepDates=[], activeDates=[], perfectDates=[];
  const tagSet=new Set(), monthSet=new Set();
  Object.entries(days).forEach(([ds,e])=>{
    const oneOff=(e.tasks||[]).filter(t=>t.done).length;
    const daily=Object.values(e.dailyCompletions||{}).filter(Boolean).length;
    const done=oneOff+daily;
    tasksDone+=done; if(done>maxTasksDay) maxTasksDay=done;
    const total=(e.tasks||[]).length;
    const perfect = total>=3 && (e.tasks||[]).every(t=>t.done);
    if(perfect){ perfectDays++; perfectDates.push(ds); }
    if(e.note && e.note.trim()) noteDays++;
    if(e.rating!=null){ ratingDays++; if(e.rating>=10) rating10count++; if(e.rating>=8) ratingHighDates.push(ds); }
    if(e.sleepHours!=null){ sleepNights++; if(e.sleepHours>=7) sleepDates.push(ds); }
    const dayTags=e.tags||[];
    dayTags.forEach(t=>tagSet.add(t)); if(dayTags.length>maxTagsDay) maxTagsDay=dayTags.length;
    const active = done>0 || dayTags.length>0 || (e.note&&e.note.trim()) || e.rating!=null || e.sleepHours!=null;
    if(active){ daysLogged++; activeDates.push(ds); monthSet.add(ds.slice(0,7)); }
    if(done>0) doneDates.push(ds);
    questsDone += (e.questsClaimed||[]).length;
    if(active && (e.antiTags||[]).length===0) cleanDays++;
  });
  doneDates.sort(); ratingHighDates.sort(); sleepDates.sort(); activeDates.sort(); perfectDates.sort();
  s.tasksDone=tasksDone; s.perfectDays=perfectDays; s.noteDays=noteDays; s.rating10count=rating10count;
  s.ratingDays=ratingDays; s.sleepNights=sleepNights; s.daysLogged=daysLogged;
  s.distinctTags=tagSet.size; s.maxTagsDay=maxTagsDay; s.maxTasksDay=maxTasksDay; s.monthSpan=monthSet.size;
  s.questsDone=questsDone; s.cleanDays=cleanDays; s.weeklyDone=Object.keys((meta&&meta.weeklyClaimed)||{}).length;
  s.maxStreak=longestRun(doneDates); s.ratingHigh7=longestRun(ratingHighDates); s.sleep7=longestRun(sleepDates);
  s.maxPerfectRun=longestRun(perfectDates);
  // серия месяцев подряд с активностью
  const monthIdx = ym => { const [y,m]=ym.split('-').map(Number); return y*12+(m-1); };
  const monthsSorted=[...monthSet].sort(); let monthStreak=0, mrun=0, mprev=null;
  for(const ym of monthsSorted){ mrun=(mprev!=null && monthIdx(ym)-monthIdx(mprev)===1)?mrun+1:1; if(mrun>monthStreak)monthStreak=mrun; mprev=ym; }
  s.monthStreak=monthStreak;
  // возвращение: разрыв ≥ 8 календарных дней между соседними активными днями = пауза 7+ дней, затем возврат
  let comeback=0; for(let i=1;i<activeDates.length;i++){ if(daysBetween(activeDates[i-1],activeDates[i])>=8){ comeback=1; break; } }
  s.comeback=comeback;
  // цели — считаем и текущие завершённые, и АРХИВНЫЕ завершённые (из прошлых периодов)
  let goalsDone=0, yearGoalsDone=0, anyGoal=0;
  ['year','month','week','day'].forEach(scope=>{ (goals[scope]||[]).forEach(g=>{ anyGoal=1;
    if(g.progress>=100){ goalsDone++; if(scope==='year') yearGoalsDone++; } }); });
  (goalsArchive||[]).forEach(g=>{ if((g.progress||0)>=100){ goalsDone++; if(g.scope==='year') yearGoalsDone++; } });
  s.goalsDone=goalsDone; s.yearGoalsDone=yearGoalsDone;
  // дела (бывш. учёба) — включая архивные (иначе архивация сбрасывает награду)
  s.studyDone=allStudy.filter(x=>x.status==='Выполнено').length;
  s.routineDone=allStudy.filter(x=>x.epic==='Рутина' && x.status==='Выполнено').length;
  const epicMap={}; allStudy.forEach(x=>{ (epicMap[x.epic]=epicMap[x.epic]||[]).push(x); });
  s.distinctEpics=Object.keys(epicMap).length;
  s.epicsDone=Object.values(epicMap).filter(list=>list.length>=3 && list.every(x=>x.status==='Выполнено')).length;
  // дел закрыто в срок (дедлайн стоял и закрыто не позже него) + задействованы базовые сферы
  s.deadlineHits=allStudy.filter(x=>x.status==='Выполнено' && x.deadline && x.completedAt && x.completedAt<=x.deadline).length;
  s.baseEpicsUsed=BASE_EPICS.filter(e=>allStudy.some(x=>x.epic===e)).length;
  s.notesTotal=(notes||[]).length;
  s.remindersCount=(notes||[]).filter(n=>n.type==='Напоминание').length;
  // многодневные
  s.ongoingDone=(ongoing||[]).filter(o=>o.done).length;
  // финансы
  s.txCount=finance.transactions.filter(t=>!t.debtFlow).length; // движения долгов — не «операции»
  s.accountsCount=finance.accounts.length;
  s.snapshotsCount=finance.accounts.reduce((n,a)=>n+a.snapshots.length,0);
  s.debtorsCount=(finance.debtors||[]).length;
  s.netWorth=finance.accounts.reduce((sum,a)=>sum+accountBalanceNow(a, finance.transactions),0) + unassignedNetOn(finance.transactions, todayStr());
  let totalIncome=0, totalExpense=0, maxIncomeTx=0; const byMonth={};
  finance.transactions.forEach(t=>{ if(t.exclude) return;
    const k=t.date.slice(0,7); (byMonth[k]=byMonth[k]||{inc:0,exp:0});
    if(t.type==='income'){ totalIncome+=t.amount; byMonth[k].inc+=t.amount; if(t.amount>maxIncomeTx) maxIncomeTx=t.amount; }
    else { totalExpense+=t.amount; byMonth[k].exp+=t.amount; } });
  s.totalIncome=totalIncome; s.totalExpense=totalExpense; s.maxIncomeTx=maxIncomeTx;
  // Норма сбережений — только по ЗАВЕРШЁННЫМ месяцам (текущий не считается): в начале месяца
  // приходит доход, а расходов ещё нет → (доход−0)/доход=100% → незаслуженная награда. session: saverate-endofmonth.
  // bestMonthIncome — по всем месяцам (доход, полученный рано, УЖЕ заработан, недоделанным месяцем не искажается).
  const savCurYm = todayStr().slice(0,7);
  let bestSavingsRatePct=0, bestMonthIncome=0;
  Object.entries(byMonth).forEach(([ym,m])=>{ if(m.inc>bestMonthIncome) bestMonthIncome=m.inc;
    if(ym<savCurYm && m.inc>0){ const r=Math.round((m.inc-m.exp)/m.inc*100); if(r>bestSavingsRatePct) bestSavingsRatePct=r; } });
  s.bestSavingsRatePct=bestSavingsRatePct; s.bestMonthIncome=bestMonthIncome;
  // дисциплина бюджета — только по ЗАВЕРШЁННЫМ месяцам (текущий не считается)
  const curYm=todayStr().slice(0,7); let disc=0;
  Object.keys(budgets||{}).forEach(ym=>{ if(ym>=curYm) return; const mb=(budgets||{})[ym]||{}; const cats=Object.keys(mb); if(!cats.length) return;
    const spent={}; finance.transactions.filter(t=>!t.exclude && t.type==='expense' && t.date.slice(0,7)===ym).forEach(t=>{ spent[t.category]=(spent[t.category]||0)+t.amount; });
    if(cats.every(c=>(spent[c]||0)<=mb[c])) disc=1; });
  s.budgetDiscipline=disc;
  // мета / уровень
  s.level = levelForXp(meta.xp||0).level;
  // всесторонность: задействованы все 5 разделов (дела — включая архивные)
  s.facetsCount = (tasksDone>0?1:0)+(anyGoal?1:0)+(allStudy.length>0?1:0)+((notes||[]).length>0?1:0)+(s.txCount>0?1:0);
  // полимат (секрет): силён во всех измерениях сразу
  s.polymath = (s.maxStreak>=30 && goalsDone>=5 && s.studyDone>=10 && s.txCount>=50 && s.level>=10) ? 1 : 0;
  // привычки — включая архивные (снимок хранит log, поэтому метрики восстанавливаются)
  const H = allHabits; const tdy = todayStr();
  // «Привычек заведено» НЕ считает сдавшиеся (outcome==='failed'): бросил привычку — она не идёт в зачёт
  // как созданная. Реальные отметки/стрики/челленджи ниже считаем по всем (они были заработаны). session 028b.
  s.habitsCount = H.filter(h=>h.outcome!=='failed').length;
  s.habitCompletions = H.reduce((n,h)=>n+habitCompletedCount(h),0);
  s.habitBestStreak = H.reduce((mx,h)=>Math.max(mx, habitBestStreak(h, tdy)), 0);
  s.habitsChallengeDone = H.filter(h=>habitChallengeDone(h)).length;
  return s;
}

// тир награды по позиции порога в лестнице (первые — обычные, последние — легендарные)
const tierForFrac = (f) => f<0.30?'common' : f<0.55?'uncommon' : f<0.78?'rare' : f<0.93?'epic' : 'legend';
// Яркие имена по позициям порогов (выровнены с ACH_LADDERS[*].tiers).
const ACH_NAMES = {
  tasks:       ['Первый шаг','','Разогрев','','Сотник','','Пятисотый','Тысячник','','','Марафонец','','Легион'],
  busyday:     ['','Продуктивный день','','Машина','','Бог продуктивности','Одержимый'],
  ongoing:     ['','','Долгожитель','','Проектный магнат','Вечный двигатель'],
  streak:      ['','','Искра','Неделя огня','','Две недели стали','','Несокрушимый','','','Квартал дисциплины','','Полугодовой марш','','Год силы','','Титан времени'],
  perfect:     ['','','Безупречный','Перфекционист','','','Мастер идеала','','Абсолют','','Живая легенда'],
  monthstreak: ['','Три месяца в потоке','','Полгода без пропусков','','Год без срывов','','Два года дисциплины'],
  dayslog:     ['Новичок','','','Месяц наблюдений','','','Ветеран','','','','Год наблюдений','','Хранитель времени'],
  monthspan:   ['','','','','Полгода пути','','Год в системе','','','Три года истории'],
  notedays:    ['','Хронист','','Летописец','Мемуарист','','','','Хранитель летописи'],
  ratingcount: ['','Наблюдатель','','Рефлексёр','Аналитик себя','','Год саморефлексии'],
  rating10:    ['Идеальный день','','Коллекционер десяток','','','Гедонист'],
  ratingrun:   ['','','На волне','Неделя счастья','','','Три недели в потоке','Дзен'],
  sleepnights: ['','Соня','','Хранитель сна','','','Год здорового сна'],
  sleeprun:    ['','','Режим','Неделя силы','','','Идеальный ритм','Мастер восстановления'],
  tags:        ['','','Разноцветный','Коллекционер тегов','','Радужный архив','','Энциклопедист'],
  tagsday:     ['','','','Радуга дня','','Полный спектр'],
  goals:       ['Первая победа','','Целеустремлённый','Разрушитель целей','','','Легенда целей','','Властелин целей'],
  yeargoals:   ['Стратег','','Архитектор года','','Провидец'],
  study:       ['','','Исполнитель','','Мастер дел','Профессионал','','','Гуру продуктивности'],
  epics:       ['','','Эпик пройден','','Покоритель эпиков','Сага завершена'],
  distepics:   ['','','Многостаночник','','Полимат сфер'],
  deadlines:   ['Первый дедлайн','','Пунктуальный','','Мастер сроков','Всё точно в срок'],
  routine:     ['','','Ритм рутины','','Механизм','Автопилот','','Дзен рутины'],
  reminders:   ['Первое напоминание','','Не забуду','','Личный планировщик'],
  notes:       ['','Записная книжка','','Картотека','Архивариус мыслей','','Библиотека идей'],
  tx:          ['Первый рубль','','','Бухгалтер','','Казначей','Финансовый архивариус','','Повелитель цифр'],
  accounts:    ['','','','Инвестор','','Диверсификатор','Финансовая империя'],
  snaps:       ['','','Ревизор','','Аудитор','','Тотальный контроль'],
  debtors:     ['','Кредитор','','Банк для друзей'],
  networth:    ['','','','Подушка','','Полмиллиона','Первый миллион','','','Магнат'],
  income:      ['','','','Первые сто тысяч','','Миллион заработан','','','Денежный поток'],
  expense:     ['','','','Учтено сто тысяч','','Миллион под контролем','','Всевидящий бюджет'],
  monthincome: ['','','','Хороший месяц','','Полмиллиона за месяц','Золотой месяц'],
  bigincome:   ['','','','Крупная сделка','','Джекпот','Куш'],
  saverate:    ['','','Сберегатель','','Половина отложена','','Аскет','','Монах-финансист'],
  level:       ['','','Новобранец','','Ветеран','','Мастер','','Эксперт','','Легенда','','Полубог','Абсолют'],
  habits:      ['Первая привычка','','Три ритуала','','','Система привычек'],
  habitchecks: ['','Разгон','','Сотня отметок','','Полтысячи','Тысяча галочек','','Машина привычек'],
  habitstreak: ['Три дня','Неделя','Две недели','Три недели','Месяц силы','','Привычка сформирована','Сотня дней','','','Год ритуала'],
  habitchal:   ['Челлендж пройден','','Пятёрка челленджей','Десятка','Мастер челленджей'],
};
// «лестница»: одна метрика × список порогов -> серия наград нарастающей редкости
const buildLadder = (L) => { const names=ACH_NAMES[L.id]||[]; return L.tiers.map((target,i)=>{
  const disp = L.fmt==='money' ? compactNum(target)+' ₽' : L.fmt==='pct' ? target+'%' : compactNum(target);
  return { id:`${L.id}_${target}`, g:L.g, icon:L.icon, title: names[i] ? names[i] : `${L.title} · ${disp}`,
    desc:`${L.desc}: ${disp}`, tier:tierForFrac(L.tiers.length>1 ? i/(L.tiers.length-1) : 1),
    target, val:L.val, fmt:L.fmt };
}); };

const ACH_LADDERS = [
  {id:'tasks',       g:'Задачи',    icon:'✅', title:'Выполнено задач',  desc:'Всего выполненных задач',                val:s=>s.tasksDone,        tiers:[1,10,25,50,100,250,500,1000,2000,3500,5000,7500,10000]},
  {id:'busyday',     g:'Задачи',    icon:'⚡', title:'Задач за день',    desc:'Задач выполнено за один день',           val:s=>s.maxTasksDay,      tiers:[3,5,7,10,15,20,30]},
  {id:'ongoing',     g:'Задачи',    icon:'🧗', title:'Многодневные',     desc:'Завершено многодневных задач',           val:s=>s.ongoingDone,      tiers:[1,3,5,10,25,50]},
  {id:'streak',      g:'Стрики',    icon:'🔥', title:'Дней подряд',      desc:'Серия дней подряд с делами',             val:s=>s.maxStreak,        tiers:[2,3,5,7,10,14,21,30,45,60,90,120,180,270,365,500,730]},
  {id:'perfect',     g:'Стрики',    icon:'🎯', title:'Идеальных дней',   desc:'Дней со 100% выполнением (3+ задач)',     val:s=>s.perfectDays,      tiers:[1,3,5,10,20,35,50,75,100,150,200]},
  {id:'monthstreak', g:'Стрики',    icon:'🔗', title:'Месяцев подряд',   desc:'Месяцев подряд с активностью',           val:s=>s.monthStreak,      tiers:[2,3,4,6,9,12,18,24]},
  {id:'dayslog',     g:'Стаж',      icon:'🗓', title:'Дней с записями',  desc:'Всего дней с любой активностью',         val:s=>s.daysLogged,       tiers:[1,7,14,30,50,75,100,150,200,300,365,500,730]},
  {id:'monthspan',   g:'Стаж',      icon:'📅', title:'Месяцев в системе',desc:'Разных месяцев с записями',              val:s=>s.monthSpan,        tiers:[1,2,3,4,6,9,12,18,24,36]},
  {id:'notedays',    g:'Рефлексия', icon:'📓', title:'Записей дня',      desc:'Дней с описанием «что было · почему»',    val:s=>s.noteDays,         tiers:[1,10,25,50,100,150,200,300,365]},
  {id:'ratingcount', g:'Рефлексия', icon:'⭐', title:'Оценённых дней',   desc:'Дней с проставленной оценкой',           val:s=>s.ratingDays,       tiers:[1,10,30,50,100,200,365]},
  {id:'rating10',    g:'Рефлексия', icon:'🔟', title:'Дней на 10/10',    desc:'Дней с оценкой 10',                      val:s=>s.rating10count,    tiers:[1,5,10,25,50,100]},
  {id:'ratingrun',   g:'Рефлексия', icon:'😌', title:'Оценка 8+ подряд', desc:'Дней подряд с оценкой ≥ 8',              val:s=>s.ratingHigh7,      tiers:[2,3,5,7,10,14,21,30]},
  {id:'sleepnights', g:'Рефлексия', icon:'🌙', title:'Ночей записано',   desc:'Всего ночей с отметкой сна',             val:s=>s.sleepNights,      tiers:[1,10,30,50,100,200,365]},
  {id:'sleeprun',    g:'Рефлексия', icon:'😴', title:'Сон 7ч+ подряд',   desc:'Ночей подряд со сном ≥ 7 ч',             val:s=>s.sleep7,           tiers:[2,3,5,7,10,14,21,30]},
  {id:'tags',        g:'Рефлексия', icon:'🎨', title:'Разных тегов',     desc:'Использовано разных тегов дня',          val:s=>s.distinctTags,     tiers:[1,3,5,10,15,20,30,40]},
  {id:'tagsday',     g:'Рефлексия', icon:'🌈', title:'Тегов за день',    desc:'Разных тегов за один день',              val:s=>s.maxTagsDay,       tiers:[2,3,4,5,6,8]},
  {id:'goals',       g:'Цели',      icon:'🥇', title:'Целей достигнуто', desc:'Всего завершённых целей',                val:s=>s.goalsDone,        tiers:[1,3,5,10,20,35,50,75,100]},
  {id:'yeargoals',   g:'Цели',      icon:'🗺', title:'Годовых целей',    desc:'Завершено годовых целей',                val:s=>s.yearGoalsDone,    tiers:[1,2,3,5,10]},
  {id:'study',       g:'Дела',      icon:'🎓', title:'Дел выполнено',    desc:'Завершено дел',                          val:s=>s.studyDone,        tiers:[1,5,10,25,50,100,200,350,500]},
  {id:'epics',       g:'Дела',      icon:'📚', title:'Эпиков закрыто',   desc:'Полностью закрытых эпиков (3+ задачи)',   val:s=>s.epicsDone,        tiers:[1,2,3,5,10,20]},
  {id:'distepics',   g:'Дела',      icon:'🗂', title:'Разных эпиков',    desc:'Заведено разных эпиков',                 val:s=>s.distinctEpics,    tiers:[1,3,5,10,20]},
  {id:'deadlines',   g:'Дела',      icon:'⏰', title:'Дел в срок',       desc:'Дел закрыто до дедлайна',                val:s=>s.deadlineHits,     tiers:[1,5,10,25,50,100]},
  {id:'routine',     g:'Дела',      icon:'🔄', title:'Рутинных дел',     desc:'Выполнено дел из эпика «Рутина»',        val:s=>s.routineDone,      tiers:[1,5,10,25,50,100,250,500]},
  {id:'reminders',   g:'Заметки',   icon:'🔔', title:'Напоминаний',      desc:'Создано напоминаний',                    val:s=>s.remindersCount,   tiers:[1,5,10,25,50]},
  {id:'notes',       g:'Заметки',   icon:'🗒', title:'Заметок создано',  desc:'Всего заметок',                          val:s=>s.notesTotal,       tiers:[1,10,25,50,100,200,500]},
  {id:'tx',          g:'Финансы',   icon:'🧾', title:'Операций',         desc:'Всего финансовых операций',              val:s=>s.txCount,          tiers:[1,10,50,100,250,500,1000,2500,5000]},
  {id:'accounts',    g:'Финансы',   icon:'🏦', title:'Счетов',           desc:'Заведено счетов',                        val:s=>s.accountsCount,    tiers:[1,2,3,4,6,8,10]},
  {id:'snaps',       g:'Финансы',   icon:'📸', title:'Замеров активов',  desc:'Сделано замеров активов',                val:s=>s.snapshotsCount,   tiers:[1,5,10,25,50,100,200]},
  {id:'debtors',     g:'Финансы',   icon:'🤝', title:'Должников',        desc:'Записано должников',                     val:s=>s.debtorsCount,     tiers:[1,3,5,10]},
  {id:'networth',    g:'Финансы',   icon:'💎', title:'Чистые активы',    desc:'Чистые активы достигли',                 val:s=>s.netWorth,   fmt:'money', tiers:[1000,10000,50000,100000,250000,500000,1000000,3000000,5000000,10000000]},
  {id:'income',      g:'Финансы',   icon:'💰', title:'Всего доходов',    desc:'Суммарный учтённый доход',               val:s=>s.totalIncome,fmt:'money', tiers:[1000,10000,50000,100000,500000,1000000,3000000,5000000,10000000]},
  {id:'expense',     g:'Финансы',   icon:'💸', title:'Всего расходов',   desc:'Суммарный учтённый расход',              val:s=>s.totalExpense,fmt:'money',tiers:[1000,10000,50000,100000,500000,1000000,3000000,5000000]},
  {id:'monthincome', g:'Финансы',   icon:'📈', title:'Доход за месяц',   desc:'Лучший месячный доход',                  val:s=>s.bestMonthIncome,fmt:'money',tiers:[1000,10000,50000,100000,300000,500000,1000000]},
  {id:'bigincome',   g:'Финансы',   icon:'🤑', title:'Крупный доход',    desc:'Крупнейшая разовая операция дохода',      val:s=>s.maxIncomeTx,fmt:'money', tiers:[1000,5000,10000,50000,100000,500000,1000000]},
  {id:'saverate',    g:'Финансы',   icon:'🐿', title:'Норма сбережений', desc:'Лучшая месячная норма сбережений',       val:s=>s.bestSavingsRatePct,fmt:'pct',tiers:[10,20,30,40,50,60,70,80,90]},
  {id:'level',       g:'Уровни',    icon:'🏆', title:'Уровень',          desc:'Достигнут уровень',                      val:s=>s.level,            tiers:[2,3,5,7,10,15,20,25,30,40,50]},
  {id:'quests',      g:'Геймификация', icon:'🎯', title:'Заданий дня',    desc:'Выполнено ежедневных заданий',           val:s=>s.questsDone,       tiers:[1,10,25,50,100,250,500,1000]},
  {id:'weekly',      g:'Геймификация', icon:'🏆', title:'Испытаний недели', desc:'Пройдено недельных испытаний',          val:s=>s.weeklyDone,       tiers:[1,3,5,10,20,52,104]},
  {id:'cleandays',   g:'Геймификация', icon:'🧼', title:'Чистых дней',    desc:'Активных дней без анти-тегов',           val:s=>s.cleanDays,        tiers:[1,7,14,30,60,100,200,365]},
  {id:'habits',      g:'Привычки',  icon:'🔁', title:'Привычек заведено', desc:'Всего создано привычек',                 val:s=>s.habitsCount,        tiers:[1,3,5,8,12,20]},
  {id:'habitchecks', g:'Привычки',  icon:'☑️', title:'Отметок привычек',  desc:'Всего выполнений привычек',              val:s=>s.habitCompletions,   tiers:[1,10,50,100,250,500,1000,2500,5000]},
  {id:'habitstreak', g:'Привычки',  icon:'🔥', title:'Стрик привычки',    desc:'Лучший стрик одной привычки',            val:s=>s.habitBestStreak,    tiers:[3,7,14,21,30,50,66,100,150,200,365]},
  {id:'habitchal',   g:'Привычки',  icon:'🏁', title:'Челленджей пройдено',desc:'Привычек, достигших цели на N дней',    val:s=>s.habitsChallengeDone,tiers:[1,3,5,10,20]},
];

// особые (не пороговые / комбинированные / секретные)
const ACH_SPECIAL = [
  {id:'comeback',     g:'Особые',  icon:'🔄', title:'Возвращение',        desc:'Вернись к делам после паузы 7+ дней', tier:'rare',   target:1, val:s=>s.comeback},
  {id:'allrounder',   g:'Особые',  icon:'🧩', title:'Всесторонний',       desc:'Задействуй все разделы: задачи, цели, дела, заметки, финансы', tier:'rare', target:5, val:s=>s.facetsCount},
  {id:'all_base_epics',g:'Дела',   icon:'🗂', title:'Все сферы жизни',     desc:'Заведи дела во всех базовых категориях (Учёба, Саморазвитие, Личное, Работа, Рутина)', tier:'uncommon', target:5, val:s=>s.baseEpicsUsed},
  {id:'budget_disc',  g:'Финансы', icon:'📊', title:'Дисциплина бюджета', desc:'Уложись во все планы расходов за месяц', tier:'epic', target:1, val:s=>s.budgetDiscipline},
  {id:'perfect_week', g:'Особые',  icon:'💠', title:'Идеальная неделя',   desc:'7 идеальных дней подряд',             tier:'legend', target:7, val:s=>s.maxPerfectRun, secret:true},
  {id:'polymath',     g:'Особые',  icon:'🌟', title:'Полимат',            desc:'Секрет: будь силён во всех измерениях сразу', tier:'legend', target:1, val:s=>s.polymath, secret:true},
];

export const ACHIEVEMENTS = [...ACH_SPECIAL, ...ACH_LADDERS.flatMap(buildLadder)];
export const ACH_GROUPS = ['Задачи','Привычки','Стрики','Стаж','Рефлексия','Цели','Дела','Заметки','Финансы','Уровни','Особые'];
export const achValDisplay = (a, v) => a.fmt==='money' ? fmtMoney(v) : a.fmt==='pct' ? Math.round(v)+'%' : Math.round(v).toLocaleString('ru-RU');
