import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Chart, registerables } from 'chart.js';
// xlsx грузится лениво (динамический import в exportExcel) — иначе ~400КБ в стартовом бандле. session 022.
import { onAuth, login, logout, getCloudState, pushKey, subscribe, LIFEOS_KEYS } from './sync.js';
import { saveOrShare } from './backup.js';
import { syncNotifications, requestNotif, testNotification, notifDiagnostics } from './notifications.js';

Chart.register(...registerables);

// Видимый штамп сборки — показывается в Настройках. Меняй при каждой пересборке APK,
// чтобы точно знать, свежую версию установили или старую (session 013 не смогла это исключить).
const BUILD_ID = '2026-07-18o-privacy-fonts-codesplit-goalarchive-compactconfirm';

// ---------- tokens & helpers ----------
const C = {bg:'#0B0E13',panel:'#141A22',panelAlt:'#1B222C',border:'#2A323D',text:'#E7EAEE',dim:'#8992A3',amber:'#F2A93B',cyan:'#4FD1C5',red:'#E2584F',green:'#6FCF97',purple:'#9B7BD9'};
const PIE_COLORS = [C.amber,C.cyan,C.red,C.green,C.purple,'#6FA8DC','#D98E5C','#E0C36B'];

const EXPENSE_DEFAULT = ['Еда','Кафе','Алкоголь','Табак','Транспорт','Учёба','Спорт','Развлечения','Подписки','Непредвиденные','Постоянные','Щедрость','Долг','Прочее'];
const INCOME_DEFAULT = ['Зарплата','Стипендия','Помощь','Доп. доход','Возврат долга','Прочее'];
const TAGS_DEFAULT = ['Учёба','Спорт','Англ','Работа','Прогулка','Чтение','Встреча','Диплом'];
const STUDY_PRIORITIES = ['Сегодня','В течение 3 дней','В течение недели','В течение месяца','Когда захочу'];
const STUDY_STATUSES = ['Не начато','В процессе','Выполнено'];
const STUDY_IMPORTANCE = ['Не важно','Средне','Важно','Очень важно'];
const NOTE_TYPES = ['Заметка','Напоминание']; // Дело переехало во вкладку «Дела», Идея = обычная заметка
const NOTE_REPEATS = [{id:'none',label:'Не повторять'},{id:'daily',label:'Каждый день'},{id:'weekly',label:'Каждую неделю'},{id:'monthly',label:'Каждый месяц'}];
// value = JS getDay() (0=Вс), порядок показа с понедельника
const WEEKDAY_OPTS = [{value:'1',label:'Пн'},{value:'2',label:'Вт'},{value:'3',label:'Ср'},{value:'4',label:'Чт'},{value:'5',label:'Пт'},{value:'6',label:'Сб'},{value:'0',label:'Вс'}];
const weekdayLabel = (wd) => (WEEKDAY_OPTS.find(w=>w.value===String(wd))||{}).label || '';
const DEFAULT_ACCOUNTS = ['Наличные','На картах','Накопительный','Крипта'];
const IMPORTANCE_COLOR = {'Не важно':C.dim,'Средне':C.cyan,'Важно':C.amber,'Очень важно':C.red};
// срочность — отдельная ось (дедлайновость); чем срочнее, тем краснее
const STUDY_URGENCY = ['Не срочно','На неделе','Скоро','Срочно'];
const URGENCY_COLOR = {'Не срочно':C.dim,'На неделе':C.cyan,'Скоро':C.amber,'Срочно':C.red};
const STATUS_COLOR = {'Не начато':C.dim,'В процессе':C.amber,'Выполнено':C.green};
// базовые эпики-категории для вкладки «Дела» (пресеты; свои эпики тоже можно заводить)
const BASE_EPICS = ['Учёба','Саморазвитие','Личное','Работа'];
// у этих скоупов закрытие цели просят подтвердить (день — без подтверждения)
const PERIOD_SCOPES = ['year','month','week'];
// период цели по скоупу: неделя '2026-W29', месяц '2026-07', год '2026'
const periodOf = (scope, ds=todayStr()) => scope==='week'?isoWeek(ds) : scope==='month'?ds.slice(0,7) : scope==='year'?ds.slice(0,4) : null;
const PERIOD_LABEL = {week:'неделя', month:'месяц', year:'год'};
const DIFF_XP = {easy:5, medium:10, hard:20};

const toLocalISODate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const todayStr = () => toLocalISODate(new Date());
const addDays = (ds,n) => { const d=new Date(ds+'T00:00:00'); d.setDate(d.getDate()+n); return toLocalISODate(d); };
const daysAgoStr = (n) => addDays(todayStr(), -n);
const isoWeek = (ds) => {
  const d=new Date(ds+'T00:00:00'); const t=new Date(d.valueOf());
  const dayNr=(d.getDay()+6)%7; t.setDate(t.getDate()-dayNr+3);
  const first=new Date(t.getFullYear(),0,4); const diff=t-first;
  return `${t.getFullYear()}-W${String(1+Math.round(diff/(7*864e5))).padStart(2,'0')}`;
};
const fmtMoney = (n) => (Math.round(n)||0).toLocaleString('ru-RU')+' ₽';
// приватность: если hidden — показываем ••••••, иначе сумму. session 022.
const maskMoney = (hidden, n) => hidden ? '••••••' : fmtMoney(n);
const uid = () => Math.random().toString(36).slice(2,10);
const formatDateRu = (ds) => new Date(ds+'T00:00:00').toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'});
const formatDateShort = (ds) => new Date(ds+'T00:00:00').toLocaleDateString('ru-RU',{weekday:'short',day:'numeric',month:'short'});
const openDatePicker = (e) => { try{ e.target.showPicker && e.target.showPicker(); }catch(err){} };
const shiftMonth = (ym,n) => { const [y,m]=ym.split('-').map(Number); const d=new Date(y, m-1+n, 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
const monthLabelRu = (ym) => { const [y,m]=ym.split('-').map(Number); return new Date(y,m-1,1).toLocaleDateString('ru-RU',{month:'long',year:'numeric'}); };
// Планы (budgets/incomePlans) стали помесячными: {YYYY-MM:{cat:план}}. Миграция старой ПЛОСКОЙ
// формы {cat:план} -> оборачиваем в текущий месяц. Уже вложенную форму оставляем как есть.
const migratePlans = (obj) => {
  if(!obj || typeof obj!=='object' || Array.isArray(obj)) return {};
  const vals=Object.values(obj); if(vals.length===0) return {};
  const nested = vals.every(v=> v && typeof v==='object' && !Array.isArray(v));
  return nested ? obj : { [todayStr().slice(0,7)]: obj };
};

// Миграция заметок под новую модель {title,body,type} + перенос старых заметок типа «Дело» во вкладку «Дела».
// Идемпотентна: «Дело» получают детерминированный id ('note_'+oldId) для дедупликации; «Идея»→«Заметка».
const isLegacyNote = (n) => n && n.body===undefined && typeof n.text==='string';
const migrateNotes = (raw) => {
  const notes=[], toStudy=[]; let changed=false;
  (raw||[]).forEach(n=>{
    if(!isLegacyNote(n)){
      const type = NOTE_TYPES.includes(n.type) ? n.type : 'Заметка';
      if(type!==n.type){ changed=true; notes.push({...n, type}); } else notes.push(n);
      return;
    }
    changed=true; const text=n.text||'';
    if(n.type==='Дело'){
      toStudy.push({id:'note_'+n.id, createdAt:n.createdAt||todayStr(), epic:'Личное', task:text,
        status:n.done?'Выполнено':'Не начато', ...(n.done?{completedAt:n.createdAt||todayStr()}:{}), importance:'Средне', urgency:'На неделе'});
      return;
    }
    const type = n.type==='Напоминание' ? 'Напоминание' : 'Заметка'; // Идея/Заметка → Заметка
    notes.push({id:n.id, type, title:'', body:text, createdAt:n.createdAt||todayStr(), updatedAt:n.createdAt||todayStr()});
  });
  return {notes, toStudy, changed};
};
const mergeStudyById = (base, extra) => { if(!extra.length) return base; const have=new Set(base.map(s=>s.id));
  return [...extra.filter(s=>!have.has(s.id)), ...base]; };

// расчётный баланс счёта на дату: последний замер ≤ даты + операции этого счёта после замера.
// при совпадении дат порядок решает ts (момент реального добавления записи в приложение);
// если у одной из записей нет ts (старые данные до этой фичи) — считаем операцию произошедшей после замера.
const snapshotValueRub = (s) => s.currency==='USD' ? s.amount*(s.rate||90) : s.amount;
const accountBalanceOn = (account, transactions, date) => {
  const past = account.snapshots.filter(s=>s.date<=date).sort((a,b)=> b.date.localeCompare(a.date) || (b.ts||0)-(a.ts||0));
  const anchor = past[0];
  const base = anchor ? snapshotValueRub(anchor) : 0;
  const countsAfterAnchor = (t) => {
    if(t.date!==anchor.date) return t.date>anchor.date;
    if(t.ts==null || anchor.ts==null) return true;
    return t.ts>=anchor.ts;
  };
  const net = transactions
    .filter(t=>t.accountId===account.id && !t.exclude && t.date<=date && (!anchor || countsAfterAnchor(t)))
    .reduce((s,t)=> s + (t.type==='income'?t.amount:-t.amount), 0);
  return base + net;
};
// «текущий» баланс счёта: считаем на дату max(сегодня, самый свежий снапшот этого счёта).
// иначе снапшот-сверка, датированный на день вперёд относительно часов устройства,
// молча игнорируется и headline показывает расчётный дрейф вместо введённой пользователем истины.
// в обычном сценарии (все записи одним днём) max = сегодня, поведение не меняется.
const accountBalanceNow = (account, transactions) => {
  const asOf = account.snapshots.reduce((m,s)=> s.date>m ? s.date : m, todayStr());
  return accountBalanceOn(account, transactions, asOf);
};
// «нераспределённый» пул: чистый поток операций БЕЗ счёта (доход +, расход −) на дату.
// позволяет чистым активам двигаться и от операций, не привязанных к конкретному счёту.
// внимание: этот пул ничем не сверяется (у него нет снапшота-якоря), поэтому со временем может накапливать погрешность.
const unassignedNetOn = (transactions, date) => transactions
  .filter(t=> !t.accountId && !t.exclude && t.date<=date)
  .reduce((s,t)=> s + (t.type==='income'?t.amount:-t.amount), 0);

// ---------- привычки ----------
// Модель: {id,name,schedule:{type:'daily'|'weekdays',days:[0-6]},targetDays,freezesPerMonth,createdAt,log:{[date]:true}}
// Стрик считается по ЗАПЛАНИРОВАННЫМ дням и СГОРАЕТ при пропуске; заморозки прощают N пропусков в месяц.
const HABIT_WD = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']; // индекс = Date.getDay()
const isHabitScheduled = (h, ds) => (h.schedule && h.schedule.type==='weekdays')
  ? (h.schedule.days||[]).includes(new Date(ds+'T00:00:00').getDay()) : true;
const habitDoneOn = (h, ds) => !!(h.log && h.log[ds]);
const habitCompletedCount = (h) => Object.values(h.log||{}).filter(Boolean).length;
const habitScheduleLabel = (h) => (h.schedule && h.schedule.type==='weekdays')
  ? ((h.schedule.days||[]).slice().sort((a,b)=>((a+6)%7)-((b+6)%7)).map(d=>HABIT_WD[d]).join(' ') || 'дни не выбраны')
  : 'каждый день';
// текущий стрик: идём назад от сегодня по запланированным дням; сегодня «не поздно» выполнить (не рвём).
const habitCurrentStreak = (h, today) => {
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
const habitBestStreak = (h, today) => {
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
const habitChallengeDone = (h) => (h.targetDays>0) && (habitCompletedCount(h) >= h.targetDays);

// ---------- module visibility (Settings tab) ----------
// _hidden is refreshed by App on every render; vis(id) is a plain lookup usable inline in any component.
let _hidden = {};
const vis = (id) => !_hidden[id];
const MODULE_GROUPS = [
  {group:'Вкладки', items:[
    {id:'tab.habits', label:'Вкладка «Привычки»'},
    {id:'tab.goals', label:'Вкладка «Цели»'},
    {id:'tab.study', label:'Вкладка «Дела»'},
    {id:'tab.notes', label:'Вкладка «Заметки»'},
    {id:'tab.finance', label:'Вкладка «Финансы»'},
    {id:'tab.stats', label:'Вкладка «Статистика»'},
    {id:'tab.achievements', label:'Вкладка «Награды»'},
  ]},
  {group:'Сегодня', items:[
    {id:'today.carryover', label:'Кнопка «Перенести незакрытые со вчера»'},
    {id:'today.daily', label:'Ежедневные'},
    {id:'today.ongoing', label:'На несколько дней'},
    {id:'today.tags', label:'Теги дня'},
    {id:'today.rating', label:'Оценка дня'},
    {id:'today.sleep', label:'Сон'},
    {id:'today.note', label:'Что было · почему'},
  ]},
  {group:'Финансы — операции', items:[
    {id:'ops.planExpense', label:'Планируемые расходы'},
    {id:'ops.planIncome', label:'Планируемые доходы'},
    {id:'ops.bills', label:'Регулярные платежи'},
    {id:'ops.expensePie', label:'Расходы по категориям (пирог)'},
    {id:'ops.incomePie', label:'Доходы по категориям (пирог)'},
    {id:'ops.expenseDaily', label:'Расходы по дням (гистограмма)'},
    {id:'ops.budgetAlerts', label:'Бюджет-алерты + прогноз'},
  ]},
  {group:'Финансы — активы', items:[
    {id:'assets.allocation', label:'Распределение (пирог)'},
    {id:'assets.netWorth', label:'Чистые активы во времени'},
    {id:'assets.accountTrends', label:'Баланс по счетам во времени'},
  ]},
  {group:'Статистика', items:[
    {id:'stats.weekly', label:'Обзор за период'},
    {id:'stats.analysis', label:'Анализ факторов оценки дня'},
    {id:'stats.heatmap', label:'Дисциплин-грид'},
    {id:'stats.tasks', label:'Выполнение задач'},
    {id:'stats.rating', label:'Оценка дня'},
    {id:'stats.sleep', label:'Сон'},
    {id:'stats.monthly', label:'Доход/расход по месяцам'},
    {id:'stats.net', label:'Чистый доход по месяцам'},
    {id:'stats.savings', label:'Норма сбережений'},
    {id:'stats.balanceLine', label:'Баланс операций во времени'},
    {id:'stats.incomeCat', label:'Доходы по категориям (период)'},
    {id:'stats.expenseCat', label:'Расходы по категориям (период)'},
    {id:'stats.tagFreq', label:'Частота тегов'},
    {id:'stats.planfact', label:'План / факт по месяцу'},
  ]},
];

function loadKey(key, fallback){ try{ const raw=localStorage.getItem(key); if(raw) return JSON.parse(raw); }catch(e){} return fallback; }
// _pushHook is wired to Firestore when the user is signed in; every local write mirrors up.
let _pushHook = null;
function saveKey(key, value){
  const s = JSON.stringify(value);
  try{ localStorage.setItem(key, s); }catch(e){}
  try{ if(_pushHook) _pushHook(key, s); }catch(e){}
}
function levelForXp(xp){ return { level: Math.floor(xp/100)+1, into: xp%100, needed: 100 }; }

// короткий приятный «дзинь» при получении награды — через WebAudio, без внешних файлов (офлайн/Android)
let _audioCtx = null;
function playAchSound(){
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

// ---------- achievements engine ----------
// Награды ВЫЧИСЛЯЮТСЯ из всей истории данных (задачи/дни/финансы/цели/учёба), а хранится
// только { unlocked:{[id]:дата}, seeded }. Открытие «липкое»: заслуженная награда не пропадает,
// даже если показатель позже упал (стрик сломался и т.п.). Цвета тиров — из токенов C (не новая палитра).
const ACH_TIERS = {
  common:  {c:C.cyan,   label:'обычная',     pts:1},
  uncommon:{c:C.green,  label:'необычная',   pts:2},
  rare:    {c:C.amber,  label:'редкая',      pts:3},
  epic:    {c:C.purple, label:'эпическая',   pts:5},
  legend:  {c:C.red,    label:'легендарная', pts:10},
};
const daysBetween = (a,b) => Math.round((new Date(b+'T00:00:00') - new Date(a+'T00:00:00'))/864e5);
// самая длинная серия ИДУЩИХ ПОДРЯД дат в отсортированном списке дат, удовлетворяющих условию
const longestRun = (sortedDates) => {
  let max=0, run=0, prev=null;
  for(const ds of sortedDates){ run = (prev && daysBetween(prev,ds)===1) ? run+1 : 1; if(run>max) max=run; prev=ds; }
  return max;
};

function computeAchStats({days, goals, study, notes, finance, meta, ongoing, budgets, habits, goalsArchive}){
  const s = {};
  let tasksDone=0, perfectDays=0, noteDays=0, rating10count=0, ratingDays=0, sleepNights=0, daysLogged=0, maxTagsDay=0, maxTasksDay=0;
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
  });
  doneDates.sort(); ratingHighDates.sort(); sleepDates.sort(); activeDates.sort(); perfectDates.sort();
  s.tasksDone=tasksDone; s.perfectDays=perfectDays; s.noteDays=noteDays; s.rating10count=rating10count;
  s.ratingDays=ratingDays; s.sleepNights=sleepNights; s.daysLogged=daysLogged;
  s.distinctTags=tagSet.size; s.maxTagsDay=maxTagsDay; s.maxTasksDay=maxTasksDay; s.monthSpan=monthSet.size;
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
  let goalsDone=0, yearGoalsDone=0, potFull=0, anyGoal=0;
  ['year','month','week','day'].forEach(scope=>{ (goals[scope]||[]).forEach(g=>{ anyGoal=1;
    if(g.progress>=100){ goalsDone++; if(scope==='year') yearGoalsDone++; }
    if(g.savingsPot && g.savingsPot.target>0 && g.savingsPot.current>=g.savingsPot.target) potFull++; }); });
  (goalsArchive||[]).forEach(g=>{ if((g.progress||0)>=100){ goalsDone++; if(g.scope==='year') yearGoalsDone++; }
    if(g.savingsPot && g.savingsPot.target>0 && g.savingsPot.current>=g.savingsPot.target) potFull++; });
  s.goalsDone=goalsDone; s.yearGoalsDone=yearGoalsDone; s.potFull=potFull;
  // дела (бывш. учёба)
  s.studyDone=study.filter(x=>x.status==='Выполнено').length;
  const epicMap={}; study.forEach(x=>{ (epicMap[x.epic]=epicMap[x.epic]||[]).push(x); });
  s.distinctEpics=Object.keys(epicMap).length;
  s.epicsDone=Object.values(epicMap).filter(list=>list.length>=3 && list.every(x=>x.status==='Выполнено')).length;
  // дел закрыто в срок (дедлайн стоял и закрыто не позже него) + задействованы базовые сферы
  s.deadlineHits=study.filter(x=>x.status==='Выполнено' && x.deadline && x.completedAt && x.completedAt<=x.deadline).length;
  s.baseEpicsUsed=BASE_EPICS.filter(e=>study.some(x=>x.epic===e)).length;
  s.notesTotal=(notes||[]).length;
  s.remindersCount=(notes||[]).filter(n=>n.type==='Напоминание').length;
  // многодневные
  s.ongoingDone=(ongoing||[]).filter(o=>o.done).length;
  // финансы
  s.txCount=finance.transactions.length;
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
  let bestSavingsRatePct=0, bestMonthIncome=0;
  Object.values(byMonth).forEach(m=>{ if(m.inc>bestMonthIncome) bestMonthIncome=m.inc;
    if(m.inc>0){ const r=Math.round((m.inc-m.exp)/m.inc*100); if(r>bestSavingsRatePct) bestSavingsRatePct=r; } });
  s.bestSavingsRatePct=bestSavingsRatePct; s.bestMonthIncome=bestMonthIncome;
  // дисциплина бюджета — только по ЗАВЕРШЁННЫМ месяцам (текущий, ещё не прошедший, не считается)
  const curYm=todayStr().slice(0,7); let disc=0;
  Object.keys(budgets||{}).forEach(ym=>{ if(ym>=curYm) return; const mb=(budgets||{})[ym]||{}; const cats=Object.keys(mb); if(!cats.length) return;
    const spent={}; finance.transactions.filter(t=>!t.exclude && t.type==='expense' && t.date.slice(0,7)===ym).forEach(t=>{ spent[t.category]=(spent[t.category]||0)+t.amount; });
    if(cats.every(c=>(spent[c]||0)<=mb[c])) disc=1; });
  s.budgetDiscipline=disc;
  // мета / уровень
  s.level = levelForXp(meta.xp||0).level;
  // всесторонность: задействованы все 5 разделов
  s.facetsCount = (tasksDone>0?1:0)+(anyGoal?1:0)+(study.length>0?1:0)+((notes||[]).length>0?1:0)+(s.txCount>0?1:0);
  // полимат (секрет): силён во всех измерениях сразу
  s.polymath = (s.maxStreak>=30 && goalsDone>=5 && s.studyDone>=10 && s.txCount>=50 && s.level>=10) ? 1 : 0;
  // привычки
  const H = habits||[]; const tdy = todayStr();
  s.habitsCount = H.length;
  s.habitCompletions = H.reduce((n,h)=>n+habitCompletedCount(h),0);
  s.habitBestStreak = H.reduce((mx,h)=>Math.max(mx, habitBestStreak(h, tdy)), 0);
  s.habitsChallengeDone = H.filter(h=>habitChallengeDone(h)).length;
  return s;
}

// Компактное число для заголовков (1000000 -> «1 млн», 3500 -> «3.5к»).
const compactNum = (n) => n>=1e6 ? String(n/1e6).replace(/\.0$/,'')+' млн' : n>=1e3 ? String(n/1e3).replace(/\.0$/,'')+'к' : String(n);
// тир награды по позиции порога в лестнице (первые — обычные, последние — легендарные)
const tierForFrac = (f) => f<0.30?'common' : f<0.55?'uncommon' : f<0.78?'rare' : f<0.93?'epic' : 'legend';
// Яркие имена по позициям порогов (выровнены с ACH_LADDERS[*].tiers). '' = базовый порог,
// оставляем обычное имя «{метрика} · {число}». Названы в основном редкие/эпические/легендарные.
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
  pot:         ['Копилка полна','','Накопитель','','Магнат копилок'],
  study:       ['','','Исполнитель','','Мастер дел','Профессионал','','','Гуру продуктивности'],
  epics:       ['','','Эпик пройден','','Покоритель эпиков','Сага завершена'],
  distepics:   ['','','Многостаночник','','Полимат сфер'],
  deadlines:   ['Первый дедлайн','','Пунктуальный','','Мастер сроков','Всё точно в срок'],
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
  saverate:    ['','','Сберегатель','','Половина в копилку','','Аскет','','Монах-финансист'],
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
  {id:'pot',         g:'Цели',      icon:'🐖', title:'Копилок собрано',  desc:'Заполнено копилок целей на 100%',        val:s=>s.potFull,          tiers:[1,2,3,5,10]},
  {id:'study',       g:'Дела',      icon:'🎓', title:'Дел выполнено',    desc:'Завершено дел',                          val:s=>s.studyDone,        tiers:[1,5,10,25,50,100,200,350,500]},
  {id:'epics',       g:'Дела',      icon:'📚', title:'Эпиков закрыто',   desc:'Полностью закрытых эпиков (3+ задачи)',   val:s=>s.epicsDone,        tiers:[1,2,3,5,10,20]},
  {id:'distepics',   g:'Дела',      icon:'🗂', title:'Разных эпиков',    desc:'Заведено разных эпиков',                 val:s=>s.distinctEpics,    tiers:[1,3,5,10,20]},
  {id:'deadlines',   g:'Дела',      icon:'⏰', title:'Дел в срок',       desc:'Дел закрыто до дедлайна',                val:s=>s.deadlineHits,     tiers:[1,5,10,25,50,100]},
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
  {id:'level',       g:'Уровни',    icon:'🏆', title:'Уровень',          desc:'Достигнут уровень',                      val:s=>s.level,            tiers:[2,3,5,7,10,15,20,25,30,40,50,65,80,100]},
  {id:'habits',      g:'Привычки',  icon:'🔁', title:'Привычек заведено', desc:'Всего создано привычек',                 val:s=>s.habitsCount,        tiers:[1,3,5,8,12,20]},
  {id:'habitchecks', g:'Привычки',  icon:'☑️', title:'Отметок привычек',  desc:'Всего выполнений привычек',              val:s=>s.habitCompletions,   tiers:[1,10,50,100,250,500,1000,2500,5000]},
  {id:'habitstreak', g:'Привычки',  icon:'🔥', title:'Стрик привычки',    desc:'Лучший стрик одной привычки',            val:s=>s.habitBestStreak,    tiers:[3,7,14,21,30,50,66,100,150,200,365]},
  {id:'habitchal',   g:'Привычки',  icon:'🏁', title:'Челленджей пройдено',desc:'Привычек, достигших цели на N дней',    val:s=>s.habitsChallengeDone,tiers:[1,3,5,10,20]},
];

// особые (не пороговые / комбинированные / секретные)
const ACH_SPECIAL = [
  {id:'comeback',     g:'Особые',  icon:'🔄', title:'Возвращение',        desc:'Вернись к делам после паузы 7+ дней', tier:'rare',   target:1, val:s=>s.comeback},
  {id:'allrounder',   g:'Особые',  icon:'🧩', title:'Всесторонний',       desc:'Задействуй все разделы: задачи, цели, дела, заметки, финансы', tier:'rare', target:5, val:s=>s.facetsCount},
  {id:'all_base_epics',g:'Дела',   icon:'🗂', title:'Все сферы жизни',     desc:'Заведи дела во всех базовых категориях (Учёба, Саморазвитие, Личное, Работа)', tier:'uncommon', target:4, val:s=>s.baseEpicsUsed},
  {id:'budget_disc',  g:'Финансы', icon:'📊', title:'Дисциплина бюджета', desc:'Уложись во все планы расходов за месяц', tier:'epic', target:1, val:s=>s.budgetDiscipline},
  {id:'perfect_week', g:'Особые',  icon:'💠', title:'Идеальная неделя',   desc:'7 идеальных дней подряд',             tier:'legend', target:7, val:s=>s.maxPerfectRun, secret:true},
  {id:'polymath',     g:'Особые',  icon:'🌟', title:'Полимат',            desc:'Секрет: будь силён во всех измерениях сразу', tier:'legend', target:1, val:s=>s.polymath, secret:true},
];

const ACHIEVEMENTS = [...ACH_SPECIAL, ...ACH_LADDERS.flatMap(buildLadder)];
const ACH_GROUPS = ['Задачи','Привычки','Стрики','Стаж','Рефлексия','Цели','Дела','Заметки','Финансы','Уровни','Особые'];
const achValDisplay = (a, v) => a.fmt==='money' ? fmtMoney(v) : a.fmt==='pct' ? Math.round(v)+'%' : Math.round(v).toLocaleString('ru-RU');

// ---------- reusable styled dropdown ----------
// Замена нативному <select>: единый вид на десктопе и телефоне (нативный особенно уродлив в WebView).
// options: массив строк ИЛИ {value,label}. onChange(value). Поддерживает точечную подсветку (dotColor).
function Select({value, onChange, options, placeholder='—', style, disabled, small}){
  const [open,setOpen] = useState(false);
  const ref = useRef(null);
  const opts = options.map(o=> typeof o==='object' ? o : {value:o, label:o});
  const cur = opts.find(o=>o.value===value);
  useEffect(()=>{ if(!open) return;
    const on = (e)=>{ if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown',on); return ()=>document.removeEventListener('mousedown',on);
  }, [open]);
  const pad = small ? '5px 8px' : '9px 10px';
  const fs = small ? 12 : 13.5;
  return (
    <div ref={ref} style={{position:'relative', minWidth:0, ...(style||{})}}>
      <button type="button" disabled={disabled} onClick={()=>!disabled&&setOpen(o=>!o)}
        style={{width:'100%',display:'flex',alignItems:'center',gap:8,justifyContent:'space-between',background:C.panelAlt,
          border:`1px solid ${open?C.amber:C.border}`,borderRadius:6,padding:pad,color:cur?C.text:C.dim,fontSize:fs,
          cursor:disabled?'default':'pointer',opacity:disabled?.5:1,textAlign:'left',minWidth:0}}>
        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:7,minWidth:0}}>
          {cur&&cur.dotColor&&<span style={{width:8,height:8,borderRadius:4,background:cur.dotColor,flexShrink:0}}/>}
          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cur?cur.label:placeholder}</span>
        </span>
        <span style={{color:C.dim,fontSize:10,transform:open?'rotate(180deg)':'none',transition:'transform .12s'}}>▾</span>
      </button>
      {open && (
        <div className="sel-pop" style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:80,background:C.panel,
          border:`1px solid ${C.border}`,borderRadius:8,boxShadow:'0 10px 30px rgba(0,0,0,.5)',maxHeight:260,overflowY:'auto',padding:4}}>
          {opts.map(o=>(
            <div key={String(o.value)} onClick={()=>{ onChange(o.value); setOpen(false); }}
              style={{display:'flex',alignItems:'center',gap:8,padding:'9px 10px',borderRadius:6,cursor:'pointer',fontSize:fs,
                background:o.value===value?C.panelAlt:'transparent',color:o.value===value?C.amber:C.text}}
              onMouseEnter={e=>{ if(o.value!==value) e.currentTarget.style.background=C.panelAlt; }}
              onMouseLeave={e=>{ if(o.value!==value) e.currentTarget.style.background='transparent'; }}>
              {o.dotColor&&<span style={{width:8,height:8,borderRadius:4,background:o.dotColor,flexShrink:0}}/>}
              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- reusable modal (полноэкранный на телефоне, карточка на десктопе) ----------
function Modal({onClose, children, title, compact}){
  useEffect(()=>{ const on=(e)=>{ if(e.key==='Escape') onClose(); }; document.addEventListener('keydown',on);
    return ()=>document.removeEventListener('keydown',on); }, [onClose]);
  // compact — небольшая карточка по центру (для подтверждений); обычная модалка на телефоне фуллскрин.
  return (
    <div className="anim-fade" style={S.modalOverlay} onClick={onClose}>
      <div className={(compact?'':'modal-card-mobile ')+'anim-pop'} style={compact?{...S.modalCard, maxWidth:360}:S.modalCard} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:16,fontWeight:700}}>{title}</div>
          <button className="icon-btn" style={{fontSize:20}} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- привязка «выполнил → вклад в цель» (для разовых/ежедневных задач и привычек) ----------
const GL_SCOPE = {year:'Год',month:'Месяц',week:'Неделя',day:'День'};
const goalLinkOptions = (goals) => { const out=[{value:'',label:'— без привязки —'}];
  ['year','month','week','day'].forEach(sc=>(goals[sc]||[]).forEach(g=>out.push({value:`${sc}|${g.id}`,
    label:`${GL_SCOPE[sc]}: ${g.title}${g.counter?` (${g.counter.current||0}/${g.counter.target})`:''}`}))); return out; };
const goalByKey = (goals, key) => { if(!key) return null; const [sc,gid]=key.split('|'); return (goals[sc]||[]).find(g=>g.id===gid)||null; };
// нормализация: новая модель goalLinks (массив) ИЛИ легаси goalLink (один) → всегда массив. session 015.
const goalLinksOf = (item) => item && Array.isArray(item.goalLinks) ? item.goalLinks : (item && item.goalLink ? [item.goalLink] : []);
// МУЛЬТИ-привязка: задача/привычка может вкладываться сразу в несколько целей. session 015.
function GoalLinkPicker({goals, links=[], onLinks}){
  const [key,setKey] = useState('');
  const [amount,setAmount] = useState('');
  const g = goalByKey(goals, key);
  const add = () => {
    if(!key) return; const [scope,goalId]=key.split('|');
    const amt=parseFloat(amount); const a=(isNaN(amt)||amt<=0)?1:amt;
    const rest = links.filter(l=>!(l.scope===scope && l.goalId===goalId)); // одна цель — одна запись, сумму обновляем
    onLinks([...rest, {scope,goalId,amount:a}]); setKey(''); setAmount('');
  };
  const remove = (l) => onLinks(links.filter(x=>!(x.scope===l.scope && x.goalId===l.goalId)));
  return (
    <div style={{marginTop:8,width:'100%'}}>
      {links.length>0 && (
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
          {links.map((l,i)=>{ const gg=(goals[l.scope]||[]).find(x=>x.id===l.goalId);
            return <div key={l.scope+'|'+l.goalId+'_'+i} className="chip" style={{background:C.panelAlt,color:C.amber,borderColor:C.border,display:'flex',gap:6,alignItems:'center',maxWidth:'100%'}}>
              <span style={{minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>🎯 {GL_SCOPE[l.scope]}: {gg?gg.title:'—'} +{l.amount}</span>
              <span style={{cursor:'pointer',flexShrink:0}} onClick={()=>remove(l)}>✕</span>
            </div>; })}
        </div>
      )}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',width:'100%'}}>
        <Select style={{flex:'1 1 150px',minWidth:0,maxWidth:'100%'}} value={key} onChange={setKey} options={goalLinkOptions(goals)} />
        <input style={{...S.input,flex:'0 0 auto',width:90,minWidth:0}} type="number" placeholder={g&&g.counter?'+ штук':'+ %'} value={amount} onChange={e=>setAmount(e.target.value)} />
        <button style={{...S.iconBtnAmber,width:32,height:32,fontSize:14}} title="добавить цель" onClick={add}>+</button>
      </div>
      {g && <span style={{fontSize:11,color:C.dim,display:'block',marginTop:4}}>{g.counter?'к счётчику при выполнении':'% к цели при выполнении'} · по умолчанию 1</span>}
    </div>
  );
}

// ---------- двухшаговое подтверждение (window.confirm НЕ рисуется в Android WebView, session 014) ----------
// Первый клик «вооружает» кнопку (показывает «точно?»), второй — выполняет. Авто-сброс через 3с.
function ConfirmIconBtn({onConfirm, title='удалить', icon='✕', confirmLabel='точно?'}){
  const [armed,setArmed] = useState(false);
  useEffect(()=>{ if(!armed) return; const t=setTimeout(()=>setArmed(false),3000); return ()=>clearTimeout(t); },[armed]);
  if(armed) return <button className="icon-btn" style={{color:C.red,fontSize:11,fontWeight:700,whiteSpace:'nowrap'}} onClick={(e)=>{ e.stopPropagation(); setArmed(false); onConfirm(); }}>{confirmLabel}</button>;
  return <button className="icon-btn" title={title} onClick={(e)=>{ e.stopPropagation(); setArmed(true); }}>{icon}</button>;
}

// ---------- rollover целей: по каждому скоупу (неделя/месяц/год) свой выбор carry/fresh ----------
function RolloverModal({scopes, onApply, onClose}){
  const [choices,setChoices] = useState(()=>Object.fromEntries(scopes.map(s=>[s,'carry'])));
  return (
    <Modal onClose={onClose} title="Новый период">
      <div style={{fontSize:13.5,color:C.text,marginBottom:14,lineHeight:1.5}}>
        Начался новый период. Что сделать с целями прошлого периода — по каждому типу отдельно:
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {scopes.map(sc=>(
          <div key={sc} style={{...S.panel,padding:12,marginBottom:0}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>{PERIOD_LABEL[sc]||sc}</div>
            <div style={{display:'flex',gap:6}}>
              {[{id:'carry',label:'Перенести незавершённые'},{id:'fresh',label:'Начать заново'}].map(({id,label})=>(
                <div key={id} className="chip" onClick={()=>setChoices(c=>({...c,[sc]:id}))}
                  style={{flex:1,textAlign:'center',background:choices[sc]===id?C.amber:C.panelAlt,color:choices[sc]===id?'#1A1200':C.dim,borderColor:choices[sc]===id?C.amber:C.border}}>{label}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button style={{...S.sheetBtn,marginTop:14,width:'100%',flex:'none',borderColor:C.amber,color:C.amber}} onClick={()=>onApply(choices)}>Применить</button>
      <div style={{fontSize:11,color:C.dim,marginTop:12}}>Ничего не удаляется — при «Начать заново» цели уходят в архив (вкладка «Цели»).</div>
    </Modal>
  );
}

// ---------- reusable chart canvas ----------
function ChartCanvas({type, data, options, height=210}){
  const ref = useRef(null); const chartRef = useRef(null);
  useEffect(() => {
    if(!ref.current) return;
    if(chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(ref.current.getContext('2d'), { type, data, options });
    return () => { if(chartRef.current) chartRef.current.destroy(); };
  }, [JSON.stringify(data), JSON.stringify(options), type]);
  return <div style={{width:'100%',height}}><canvas ref={ref}></canvas></div>;
}
const axisColor = C.dim;
const gridColor = C.border;
const baseChartOpts = (extra={}) => ({
  responsive:true, maintainAspectRatio:false,
  plugins:{ legend:{display:false}, tooltip:{backgroundColor:C.panelAlt, borderColor:C.border, borderWidth:1} },
  scales:{ x:{ticks:{color:axisColor,font:{size:10}},grid:{color:gridColor}}, y:{ticks:{color:axisColor,font:{size:10}},grid:{color:gridColor}} },
  ...extra
});

// узнаём мобильный экран (реактивно на ресайз/поворот)
function useIsMobile(bp=720){
  const [m,setM] = useState(typeof window!=='undefined' && window.innerWidth<=bp);
  useEffect(()=>{ const mq=window.matchMedia(`(max-width:${bp}px)`); const on=()=>setM(mq.matches); on();
    mq.addEventListener('change',on); return ()=>mq.removeEventListener('change',on); }, [bp]);
  return m;
}
// метаданные вкладок для мобильной навигации (иконка+подпись)
const TAB_META = {
  today:{label:'Сегодня',icon:'🗓'}, habits:{label:'Привычки',icon:'🔁'}, goals:{label:'Цели',icon:'🎯'},
  study:{label:'Дела',icon:'🗂'}, notes:{label:'Заметки',icon:'🗒'}, finance:{label:'Финансы',icon:'💰'},
  stats:{label:'Статистика',icon:'📊'}, achievements:{label:'Награды',icon:'🏅'},
};
const ALL_MOBILE_TAB_IDS = ['today','habits','goals','study','notes','finance','stats','achievements'];
const DEFAULT_MOBILE_TABS = ['today','habits','goals','finance']; // нижняя навбар по умолчанию; настраивается в Настройках

// ============================================================
function App(){
  const [tab,setTab] = useState('today');
  const isMobile = useIsMobile();
  const [sheetOpen,setSheetOpen] = useState(false);
  const [days,setDays] = useState({});
  const [dailyTasks,setDailyTasks] = useState([]);
  const [ongoing,setOngoing] = useState([]);
  const [tags,setTags] = useState(TAGS_DEFAULT);
  const [goals,setGoals] = useState({year:[],month:[],week:[],day:[]});
  const [study,setStudy] = useState([]);
  const [notes,setNotes] = useState([]);
  const [categories,setCategories] = useState({expense:EXPENSE_DEFAULT, income:INCOME_DEFAULT});
  const [budgets,setBudgets] = useState({});
  const [incomePlans,setIncomePlans] = useState({});
  const [settings,setSettings] = useState({hidden:{}});
  const [bills,setBills] = useState([]);
  const [habits,setHabits] = useState([]);
  const [finance,setFinance] = useState({transactions:[],accounts:[],debtors:[]});
  const [meta,setMeta] = useState({xp:0, health:100, lastHealthCheck: todayStr()});
  const [achievements,setAchievements] = useState({unlocked:{}, seeded:false});
  const [toasts,setToasts] = useState([]);
  const [selectedDate,setSelectedDate] = useState(todayStr());
  const [profileOpen,setProfileOpen] = useState(false);
  const [goalsArchive,setGoalsArchive] = useState([]);
  const [habitsArchive,setHabitsArchive] = useState([]);
  const [studyArchive,setStudyArchive] = useState([]);
  const [archiveOpen,setArchiveOpen] = useState(false);
  const [searchOpen,setSearchOpen] = useState(false);
  const [searchQ,setSearchQ] = useState('');
  const [taskTemplates,setTaskTemplates] = useState([]);
  const [importPending,setImportPending] = useState(null); // {keys, data} — ждёт подтверждения
  const [importMsg,setImportMsg] = useState('');           // ошибка чтения бэкапа
  const [rollover,setRollover] = useState(null); // {scopes:[...]} когда цели прошлого периода ждут решения
  const [confirmDialog,setConfirmDialog] = useState(null); // {message, onYes} — WebView-safe подтверждение вместо window.confirm
  const [lsWarnDismissed,setLsWarnDismissed] = useState(false); // предупреждение о квоте localStorage закрыто в этой сессии

  useEffect(() => {
    setDays(loadKey('lifeos:days', {}));
    setDailyTasks(loadKey('lifeos:dailyTasks', []));
    setOngoing(loadKey('lifeos:ongoingTasks', []));
    setTags(loadKey('lifeos:tags', TAGS_DEFAULT));
    const loadedGoals = loadKey('lifeos:goals', {
      year:[{id:'y1',title:'Английский до уровня B2+',progress:0},{id:'y2',title:'Определиться: аспирантура / армия',progress:0},{id:'y3',title:'Стабильные кардио-тренировки 3+ раза в неделю',progress:0}],
      month:[{id:'m1',title:'Закрыть текущую сессию в магистратуре',progress:0},{id:'m2',title:'12 тренировок на велотренажёре',progress:0}],
      week:[{id:'w1',title:'3 тренировки на велотренажёре',progress:0},{id:'w2',title:'4 сессии английского в метро',progress:0}],
      day:[],
    });
    // периодизация: легаси-целям без period проставляем ТЕКУЩИЙ период (без rollover); потом ищем «просроченные»
    let goalsPeriodChanged=false;
    ['week','month','year'].forEach(sc=>{ loadedGoals[sc]=(loadedGoals[sc]||[]).map(x=>{ if(!x.period){ goalsPeriodChanged=true; return {...x, period:periodOf(sc)}; } return x; }); });
    setGoals(loadedGoals); if(goalsPeriodChanged) saveKey('lifeos:goals', loadedGoals);
    setGoalsArchive(loadKey('lifeos:goalsArchive', []));
    const staleScopes = ['week','month','year'].filter(sc=>(loadedGoals[sc]||[]).some(x=>x.period && x.period!==periodOf(sc)));
    if(staleScopes.length) setRollover({scopes:staleScopes});
    // миграция заметок: перенос старых «Дело» в «Дела» + новая модель заметок
    const rawStudy = loadKey('lifeos:study', []);
    const { notes:migNotes, toStudy, changed:notesChanged } = migrateNotes(loadKey('lifeos:notes', []));
    const finalStudy = mergeStudyById(rawStudy, toStudy);
    setStudy(finalStudy); setNotes(migNotes);
    if(notesChanged || toStudy.length){ saveKey('lifeos:notes', migNotes); if(toStudy.length) saveKey('lifeos:study', finalStudy); }
    setCategories(loadKey('lifeos:categories', {expense:EXPENSE_DEFAULT, income:INCOME_DEFAULT}));
    setBudgets(migratePlans(loadKey('lifeos:budgets', {})));
    setIncomePlans(migratePlans(loadKey('lifeos:incomePlans', {})));
    setSettings(loadKey('lifeos:settings', {hidden:{}}));
    setBills(loadKey('lifeos:recurringBills', []));
    setHabits(loadKey('lifeos:habits', []));
    setHabitsArchive(loadKey('lifeos:habitsArchive', []));
    setStudyArchive(loadKey('lifeos:studyArchive', []));
    setTaskTemplates(loadKey('lifeos:taskTemplates', []));
    setAchievements(loadKey('lifeos:achievements', {unlocked:{}, seeded:false}));
    const f = loadKey('lifeos:finance', {transactions:[],accounts:[],debtors:[]});
    setFinance({transactions:f.transactions||[], accounts:f.accounts||[], debtors:f.debtors||[]});

    // health recompute
    const loadedDays = loadKey('lifeos:days', {});
    const loadedHabits = loadKey('lifeos:habits', []);
    let m = loadKey('lifeos:meta', {xp:0, health:100, lastHealthCheck: todayStr()});
    let cursor = m.lastHealthCheck || todayStr();
    const t = todayStr();
    let steps = 0;
    let health = m.health ?? 100;
    while (cursor < t && steps < 60){
      const hasActivity = (loadedDays[cursor]?.tasks||[]).some(x=>x.done) ||
        Object.values(loadedDays[cursor]?.dailyCompletions||{}).some(Boolean) ||
        loadedHabits.some(h => h.log && h.log[cursor]);
      health = hasActivity ? Math.min(100, health+5) : Math.max(0, health-10);
      cursor = addDays(cursor, 1);
      steps++;
    }
    m = {...m, health, lastHealthCheck: t};
    setMeta(m); saveKey('lifeos:meta', m);
  }, []);

  // ---------- Phase B: Firestore sync ----------
  const [user,setUser] = useState(null);

  // apply a change coming FROM the cloud into local state + localStorage.
  // uses raw localStorage.setItem (NOT saveKey) so it does not echo back up to the cloud.
  const applyRemote = useCallback((key, valueString) => {
    try {
      localStorage.setItem(key, valueString);
      const v = JSON.parse(valueString);
      switch(key){
        case 'lifeos:days': setDays(v); break;
        case 'lifeos:dailyTasks': setDailyTasks(v); break;
        case 'lifeos:ongoingTasks': setOngoing(v); break;
        case 'lifeos:tags': setTags(v); break;
        case 'lifeos:goals': setGoals(v); break;
        case 'lifeos:study': setStudy(v); break;
        case 'lifeos:notes': {
          const { notes:mn, toStudy } = migrateNotes(v);
          setNotes(mn);
          if(toStudy.length) setStudy(prev => mergeStudyById(prev, toStudy));
          break;
        }
        case 'lifeos:categories': setCategories(v); break;
        case 'lifeos:budgets': setBudgets(migratePlans(v)); break;
        case 'lifeos:incomePlans': setIncomePlans(migratePlans(v)); break;
        case 'lifeos:settings': setSettings(v); break;
        case 'lifeos:recurringBills': setBills(v); break;
        case 'lifeos:habits': setHabits(v); break;
        case 'lifeos:habitsArchive': setHabitsArchive(v); break;
        case 'lifeos:taskTemplates': setTaskTemplates(v); break;
        case 'lifeos:studyArchive': setStudyArchive(v); break;
        case 'lifeos:finance': setFinance(v); break;
        case 'lifeos:meta': setMeta(v); break;
        case 'lifeos:achievements': setAchievements(v); break;
        case 'lifeos:goalsArchive': setGoalsArchive(v); break;
        default: break;
      }
    } catch(e){}
  }, []);

  useEffect(() => onAuth(u => {
    setUser(u);
    _pushHook = u ? (key, valStr) => pushKey(u.uid, key, valStr) : null;
  }), []);

  useEffect(() => {
    if(!user) return;
    let unsub = () => {};
    let cancelled = false;
    (async () => {
      const uid = user.uid;
      let cloud = {};
      try { cloud = await getCloudState(uid); } catch(e){}
      if(cancelled) return;
      // cloud wins for keys it already has (this device adopts the shared state)
      Object.entries(cloud).forEach(([key, valStr]) => applyRemote(key, valStr));
      // seed gaps: push local keys the cloud doesn't have yet (first device seeds the cloud)
      for(const key of LIFEOS_KEYS){
        if(!(key in cloud)){ const raw = localStorage.getItem(key); if(raw!=null){ try{ await pushKey(uid, key, raw); }catch(e){} } }
      }
      if(cancelled) return;
      unsub = subscribe(uid, applyRemote); // live updates from other devices
    })();
    return () => { cancelled = true; unsub(); };
  }, [user, applyRemote]);

  const persist = {
    days: (n)=>{setDays(n); saveKey('lifeos:days',n);},
    dailyTasks: (n)=>{setDailyTasks(n); saveKey('lifeos:dailyTasks',n);},
    ongoing: (n)=>{setOngoing(n); saveKey('lifeos:ongoingTasks',n);},
    tags: (n)=>{setTags(n); saveKey('lifeos:tags',n);},
    goals: (n)=>{setGoals(n); saveKey('lifeos:goals',n);},
    study: (n)=>{setStudy(n); saveKey('lifeos:study',n);},
    notes: (n)=>{setNotes(n); saveKey('lifeos:notes',n);},
    categories: (n)=>{setCategories(n); saveKey('lifeos:categories',n);},
    budgets: (n)=>{setBudgets(n); saveKey('lifeos:budgets',n);},
    incomePlans: (n)=>{setIncomePlans(n); saveKey('lifeos:incomePlans',n);},
    settings: (n)=>{setSettings(n); saveKey('lifeos:settings',n);},
    bills: (n)=>{setBills(n); saveKey('lifeos:recurringBills',n);},
    habits: (n)=>{setHabits(n); saveKey('lifeos:habits',n);},
    taskTemplates: (n)=>{setTaskTemplates(n); saveKey('lifeos:taskTemplates',n);},
    finance: (n)=>{setFinance(n); saveKey('lifeos:finance',n);},
  };
  const addXp = (amount) => setMeta(prev => { const n={...prev, xp:Math.max(0,(prev.xp||0)+amount)}; saveKey('lifeos:meta', n); return n; });

  const entry = days[selectedDate] || {tasks:[],sleepHours:null,note:'',rating:null,tags:[],dailyCompletions:{}};
  const updateEntry = (patch) => { const e = days[selectedDate] || {tasks:[],sleepHours:null,note:'',rating:null,tags:[],dailyCompletions:{}}; persist.days({...days,[selectedDate]:{...e,...patch}}); };

  // вклад выполненной задачи в привязанную цель. link={scope,goalId,amount}. sign +1 при выполнении, -1 при откате.
  // счётчиковая цель — прибавляем к counter.current (штуки); обычная — к progress (проценты).
  const contributeToGoal = (link, sign) => {
    if(!link || !link.goalId || !link.amount) return;
    setGoals(prev => {
      const list = (prev[link.scope]||[]).map(g=>{
        if(g.id!==link.goalId) return g;
        if(g.counter){ const cur=Math.max(0,(g.counter.current||0)+sign*link.amount);
          return {...g, counter:{...g.counter, current:cur}, progress: g.counter.target>0? Math.min(100,Math.round(cur/g.counter.target*100)) : g.progress}; }
        return {...g, progress: Math.max(0,Math.min(100,(g.progress||0)+sign*link.amount))};
      });
      const next = {...prev, [link.scope]:list}; saveKey('lifeos:goals', next); return next;
    });
  };
  // мульти-привязка: вклад во ВСЕ привязанные цели. session 015.
  const contributeToGoals = (links, sign) => { (links||[]).forEach(l=>contributeToGoal(l, sign)); };
  const addTask = (text, difficulty, goalLinks) => updateEntry({ tasks:[...entry.tasks, {id:uid(),text,done:false,difficulty, ...(goalLinks&&goalLinks.length?{goalLinks}:{})}] });
  const toggleTask = (id) => {
    let delta=0, links=[], nowDone=false;
    const tasks = entry.tasks.map(t=>{ if(t.id===id){ const xp = DIFF_XP[t.difficulty]||10; delta = t.done?-xp:xp; nowDone=!t.done; links=goalLinksOf(t); return {...t,done:!t.done}; } return t; });
    updateEntry({tasks}); if(delta) addXp(delta);
    contributeToGoals(links, nowDone?1:-1);
  };
  const deleteTask = (id) => { const rem = entry.tasks.find(t=>t.id===id); updateEntry({tasks: entry.tasks.filter(t=>t.id!==id)}); if(rem && rem.done){ addXp(-(DIFF_XP[rem.difficulty]||10)); contributeToGoals(goalLinksOf(rem),-1); } };
  const toggleTagOnDay = (name) => { const cur = entry.tags||[]; updateEntry({tags: cur.includes(name)? cur.filter(x=>x!==name) : [...cur,name]}); };
  // 🔁 перенос невыполненных задач с предыдущего дня в текущий (selectedDate). session 019.
  const prevUndoneTasks = ((days[addDays(selectedDate,-1)]?.tasks)||[]).filter(t=>!t.done);
  const carryOverTasks = () => {
    if(!prevUndoneTasks.length) return;
    const existing = new Set((entry.tasks||[]).map(t=>t.text));
    const add = prevUndoneTasks.filter(t=>!existing.has(t.text)).map(t=>({id:uid(), text:t.text, done:false, difficulty:t.difficulty||'medium', ...(goalLinksOf(t).length?{goalLinks:goalLinksOf(t)}:{})}));
    if(add.length) updateEntry({ tasks:[...entry.tasks, ...add] });
  };

  const toggleDaily = (dailyId) => {
    const cur = entry.dailyCompletions||{}; const was = !!cur[dailyId];
    updateEntry({dailyCompletions:{...cur,[dailyId]:!was}}); addXp(was?-10:10);
    const d = dailyTasks.find(x=>x.id===dailyId); if(d) contributeToGoals(goalLinksOf(d), was?-1:1);
  };
  const addDailyTask = (text, goalLinks) => persist.dailyTasks([...dailyTasks, {id:uid(), text, active:true, ...(goalLinks&&goalLinks.length?{goalLinks}:{})}]);
  const deleteDailyTask = (id) => persist.dailyTasks(dailyTasks.filter(d=>d.id!==id));

  const addOngoing = (item) => persist.ongoing([{id:uid(), done:false, ...item}, ...ongoing]);
  const finishOngoing = (id) => { const o = ongoing.map(x=>x.id===id?{...x,done:true,doneDate:todayStr()}:x); persist.ongoing(o); addXp(15); };
  const deleteOngoing = (id) => persist.ongoing(ongoing.filter(x=>x.id!==id));

  const addTagGlobal = (name) => { if(!tags.includes(name)) persist.tags([...tags,name]); };
  const removeTagGlobal = (name) => persist.tags(tags.filter(t=>t!==name));

  // новая цель — БЕЗ трекера (mode:'none'); привязана к текущему периоду (нед/мес/год)
  const addGoal = (scope,text) => persist.goals({...goals,[scope]:[...(goals[scope]||[]),{id:uid(),title:text,progress:0,mode:'none',period:periodOf(scope)}]});
  const persistArchive = (n) => { setGoalsArchive(n); saveKey('lifeos:goalsArchive', n); };
  const restoreGoal = (id, archivedAt) => {
    const g = goalsArchive.find(x=>x.id===id && x.archivedAt===archivedAt); if(!g) return;
    const {archivedAt:_a, scope, ...rest} = g; const sc = scope || 'week';
    persist.goals({...goals, [sc]:[...(goals[sc]||[]), {...rest, period:periodOf(sc)}]});
    persistArchive(goalsArchive.filter(x=>!(x.id===id && x.archivedAt===archivedAt)));
  };
  // ручная архивация цели (в т.ч. завершённой) — снимок в goalsArchive, удаление из активных. session 022.
  const archiveGoal = (scope, id) => {
    const g = (goals[scope]||[]).find(x=>x.id===id); if(!g) return;
    persistArchive([...goalsArchive, {...g, scope, archivedAt:todayStr()}]);
    persist.goals({...goals, [scope]:goals[scope].filter(x=>x.id!==id)});
  };
  // rollover ПО-СКОУПНО: choices={week:'carry'|'fresh', month:..., year:...}. 'carry' — перенести
  // незавершённые (завершённые в архив); 'fresh' — всё прошлое в архив. Каждый скоуп решается отдельно.
  const applyRollover = (choices) => {
    const arch=[...goalsArchive]; const ng={...goals};
    ['week','month','year'].forEach(sc=>{ const cur=periodOf(sc);
      const stale=(goals[sc]||[]).filter(x=>x.period && x.period!==cur);
      const fresh=(goals[sc]||[]).filter(x=>!x.period || x.period===cur);
      const mode = choices[sc] || 'carry';
      stale.forEach(x=>{
        if(mode==='carry' && (x.progress||0)<100){ fresh.push({...x, period:cur}); }
        else { arch.push({...x, scope:sc, archivedAt:todayStr()}); }
      });
      ng[sc]=fresh;
    });
    persist.goals(ng); persistArchive(arch); setRollover(null);
  };
  // Закрытие цели на 100% (нед/мес/год) спрашивает подтверждение через модалку — window.confirm
  // не рисуется в Android WebView (session 018). needClose = стоит ли спрашивать.
  const needClose = (scope,g) => PERIOD_SCOPES.includes(scope) && (g.progress||0)<100;
  const askClose = (g, onYes) => setConfirmDialog({message:`Закрыть цель «${g.title}» на 100%?`, onYes});
  const setGoalProgress = (scope,id,progress) => {
    const g = (goals[scope]||[]).find(x=>x.id===id); if(!g) return;
    const doApply = () => {
      const list = goals[scope].map(x=>{ if(x.id!==id) return x; const was=x.progress>=100, now=progress>=100;
        if(!was&&now) addXp(20); if(was&&!now) addXp(-20);
        return {...x,progress, completedAt: now ? (x.completedAt||todayStr()) : undefined}; });
      persist.goals({...goals,[scope]:list});
    };
    if(progress>=100 && needClose(scope,g)){ askClose(g, doApply); return; }
    doApply();
  };
  // единый выбор режима цели: none | slider | subtasks | counter (взаимоисключимы)
  const setGoalMode = (scope,id,mode) => {
    const list = goals[scope].map(g=>{ if(g.id!==id) return g;
      if(mode==='none')     return {...g, mode:'none', counter:undefined, subtasks:undefined, progress:0};
      if(mode==='slider')   return {...g, mode:'slider', counter:undefined, subtasks:undefined};
      if(mode==='subtasks') return {...g, mode:'subtasks', counter:undefined, subtasks:g.subtasks||[], progress:g.subtasks?g.progress:0};
      if(mode==='counter')  return {...g, mode:'counter', subtasks:undefined, counter:g.counter||{current:0,target:10}, progress:0};
      return g; });
    persist.goals({...goals,[scope]:list});
  };
  const setGoalCounter = (scope,id,patch) => {
    const g = (goals[scope]||[]).find(x=>x.id===id); if(!g||!g.counter) return;
    const target = Math.max(1, patch.target!=null?patch.target:g.counter.target);
    const current = Math.max(0, patch.current!=null?patch.current:g.counter.current||0);
    const doApply = () => {
      const list = goals[scope].map(x=>{ if(x.id!==id||!x.counter) return x;
        const counter={current, target}; const progress=Math.min(100,Math.round(current/target*100));
        const was=(x.progress||0)>=100, now=progress>=100; if(!was&&now) addXp(20); if(was&&!now) addXp(-20);
        return {...x, counter, progress, completedAt: now ? (x.completedAt||todayStr()) : undefined}; });
      persist.goals({...goals,[scope]:list});
    };
    if(current/target>=1 && needClose(scope,g)){ askClose(g, doApply); return; }
    doApply();
  };
  // subtaskXp: подзадачи меняют progress → начисляем/снимаем XP на переходе через 100% (фикс: раньше не начислялось)
  const addGoalSubtask = (scope,id,text) => {
    const list = goals[scope].map(g=>{ if(g.id!==id) return g; const sub=[...(g.subtasks||[]),{id:uid(),text,done:false}];
      const progress = Math.round(sub.filter(s=>s.done).length/sub.length*100);
      const was=(g.progress||0)>=100, now=progress>=100; if(!was&&now) addXp(20); if(was&&!now) addXp(-20);
      return {...g, subtasks:sub, progress, completedAt: now ? (g.completedAt||todayStr()) : undefined}; });
    persist.goals({...goals,[scope]:list});
  };
  const toggleGoalSubtask = (scope,gid,sid) => {
    const g = (goals[scope]||[]).find(x=>x.id===gid); if(!g) return;
    const wouldSub = g.subtasks.map(s=>s.id===sid?{...s,done:!s.done}:s);
    const wouldProg = wouldSub.length? Math.round(wouldSub.filter(s=>s.done).length/wouldSub.length*100) : 0;
    const doApply = () => {
      const list = goals[scope].map(x=>{ if(x.id!==gid) return x; const sub=x.subtasks.map(s=>s.id===sid?{...s,done:!s.done}:s);
        const progress = sub.length? Math.round(sub.filter(s=>s.done).length/sub.length*100) : 0;
        const was=(x.progress||0)>=100, now=progress>=100; if(!was&&now) addXp(20); if(was&&!now) addXp(-20);
        return {...x,subtasks:sub,progress, completedAt: now ? (x.completedAt||todayStr()) : undefined}; });
      persist.goals({...goals,[scope]:list});
    };
    if(wouldProg>=100 && needClose(scope,g)){ askClose(g, doApply); return; }
    doApply();
  };
  const deleteGoalSubtask = (scope,gid,sid) => {
    const list = goals[scope].map(g=>{ if(g.id!==gid) return g; const sub=g.subtasks.filter(s=>s.id!==sid);
      const progress = sub.length? Math.round(sub.filter(s=>s.done).length/sub.length*100) : 0;
      const was=(g.progress||0)>=100, now=progress>=100; if(!was&&now) addXp(20); if(was&&!now) addXp(-20);
      return {...g,subtasks:sub,progress, completedAt: now ? (g.completedAt||todayStr()) : undefined}; });
    persist.goals({...goals,[scope]:list});
  };
  const deleteGoal = (scope,id) => persist.goals({...goals,[scope]:goals[scope].filter(g=>g.id!==id)});

  const addStudyTask = (item) => persist.study([{id:uid(), createdAt:todayStr(), ...item}, ...study]);
  const updateStudyTask = (id,patch) => {
    const prevItem = study.find(s=>s.id===id);
    // при переходе в «Выполнено» фиксируем дату закрытия (для достижений «в срок»)
    if(patch.status==='Выполнено') patch = {...patch, completedAt: todayStr()};
    const next = study.map(s=>s.id===id?{...s,...patch}:s); persist.study(next);
    if(patch.status==='Выполнено' && prevItem && prevItem.status!=='Выполнено') addXp(15);
    if(patch.status && patch.status!=='Выполнено' && prevItem && prevItem.status==='Выполнено') addXp(-15);
  };
  const deleteStudyTask = (id) => persist.study(study.filter(s=>s.id!==id));
  const persistStudyArchive = (n) => { setStudyArchive(n); saveKey('lifeos:studyArchive', n); };
  const archiveStudyTask = (id) => {
    const s = study.find(x=>x.id===id); if(!s) return;
    persistStudyArchive([...studyArchive, {...s, archivedAt:todayStr()}]);
    persist.study(study.filter(x=>x.id!==id));
  };
  const deleteArchivedStudy = (id, archivedAt) => persistStudyArchive(studyArchive.filter(s=>!(s.id===id && s.archivedAt===archivedAt)));
  const restoreStudy = (id, archivedAt) => {
    const s = studyArchive.find(x=>x.id===id && x.archivedAt===archivedAt); if(!s) return;
    const {archivedAt:_a, ...rest} = s;
    persist.study([rest, ...study]);
    persistStudyArchive(studyArchive.filter(x=>!(x.id===id && x.archivedAt===archivedAt)));
  };

  const addNote = (note) => { const n={id:uid(), createdAt:todayStr(), updatedAt:todayStr(), type:'Заметка', title:'', body:'', ...note}; persist.notes([n, ...notes]); return n.id; };
  const updateNote = (id,patch) => persist.notes(notes.map(n=>n.id===id?{...n,...patch,updatedAt:todayStr()}:n));
  const deleteNote = (id) => persist.notes(notes.filter(n=>n.id!==id));

  const addTransaction = (tx) => persist.finance({...finance, transactions:[{id:uid(), ts:Date.now(), ...tx}, ...finance.transactions]});
  const deleteTransaction = (id) => persist.finance({...finance, transactions:finance.transactions.filter(t=>t.id!==id)});
  const addCategory = (kind,name) => { const next={...categories,[kind]:[...categories[kind],name]}; persist.categories(next); };
  const removeCategory = (kind,name) => persist.categories({...categories,[kind]:categories[kind].filter(c=>c!==name)});
  // планы помесячные: {YYYY-MM:{cat:план}}
  const setBudget = (month, cat, limit) => persist.budgets({...budgets, [month]:{...(budgets[month]||{}), [cat]:limit}});
  const setBudgetsBatch = (month, patch) => persist.budgets({...budgets, [month]:{...(budgets[month]||{}), ...patch}});
  const removeBudget = (month, cat) => { const mm={...(budgets[month]||{})}; delete mm[cat]; persist.budgets({...budgets, [month]:mm}); };
  const setIncomePlan = (month, cat, amount) => persist.incomePlans({...incomePlans, [month]:{...(incomePlans[month]||{}), [cat]:amount}});
  const setIncomePlansBatch = (month, patch) => persist.incomePlans({...incomePlans, [month]:{...(incomePlans[month]||{}), ...patch}});
  const removeIncomePlan = (month, cat) => { const mm={...(incomePlans[month]||{})}; delete mm[cat]; persist.incomePlans({...incomePlans, [month]:mm}); };
  const toggleModule = (id) => { const hidden={...(settings.hidden||{})}; if(hidden[id]) delete hidden[id]; else hidden[id]=true; persist.settings({...settings, hidden}); };
  const setDefault = (key, value) => persist.settings({...settings, defaults:{...(settings.defaults||{}), [key]:value}});
  const setSettingFlag = (key, value) => persist.settings({...settings, [key]:value});
  const [notifMsg, setNotifMsg] = useState('');
  // ВАЖНО: результат пишем на экран (setNotifMsg), НЕ через alert() —
  // в Android WebView alert() может вообще не отображаться (session 013 симптом «кнопки молчат»).
  const requestNotifs = async () => {
    setNotifMsg('⏳ Запрашиваю разрешение…');
    try {
      const r = await requestNotif();
      if(r.reason==='web'){ setNotifMsg('⚠️ Только в приложении на телефоне (в браузере не работает).'); return; }
      if(r.reason==='not-implemented'){ setNotifMsg('⚠️ Плагин уведомлений не найден — на телефоне СТАРЫЙ APK. Переустанови свежий.'); return; }
      if(r.ok){ setSettingFlag('notifOff', false);
        const n = await syncNotifications({habits: habitsForNotif(), notes, study, deadlineCfg: settings.deadlineNotif, morningCfg: settings.morningSummary, morningBody: computeMorningBody(), enabled:true});
        setNotifMsg(`✅ Разрешение выдано. Запланировано уведомлений: ${n}.`); }
      else setNotifMsg('❌ Разрешение не выдано: '+(r.display||r.reason||'')+(r.message?` — ${r.message}`:''));
    } catch(e){ setNotifMsg('💥 Ошибка при запросе: '+((e&&e.message)||String(e))); }
  };
  const testNotif = async () => {
    setNotifMsg('⏳ Планирую тест…');
    try {
      const r = await testNotification();
      if(r.ok) setNotifMsg('✅ Тест запланирован — сверни приложение, уведомление придёт через 5 секунд.');
      else if(r.reason==='web') setNotifMsg('⚠️ Только на телефоне (в браузере не сработает).');
      else if(r.reason==='not-implemented') setNotifMsg('⚠️ Старый APK без плагина — переустанови свежий.');
      else if(r.reason==='denied') setNotifMsg('❌ Разрешение не выдано ('+(r.display||'')+'). Дай его в системных настройках приложения.');
      else setNotifMsg('❌ Не удалось: '+((r.message||r.reason)||'?'));
    } catch(e){ setNotifMsg('💥 Ошибка теста: '+((e&&e.message)||String(e))); }
  };
  const showNotifDiag = async () => {
    setNotifMsg('⏳ Диагностика…');
    try { const d = await notifDiagnostics(); setNotifMsg('🔍 '+JSON.stringify(d)); }
    catch(e){ setNotifMsg('💥 Диагностика упала: '+((e&&e.message)||String(e))); }
  };
  const toggleMobileTab = (id) => {
    const cur = (settings.mobileTabs && settings.mobileTabs.length ? settings.mobileTabs : DEFAULT_MOBILE_TABS);
    let next;
    if(cur.includes(id)) next = cur.filter(x=>x!==id); else { if(cur.length>=4) return; next=[...cur,id]; }
    if(next.length===0) return; // хотя бы одна вкладка внизу
    persist.settings({...settings, mobileTabs:next});
  };
  const addBill = (name,amount,dayOfMonth) => persist.bills([...bills,{id:uid(),name,amount,dayOfMonth}]);
  const deleteBill = (id) => persist.bills(bills.filter(b=>b.id!==id));

  const addHabit = (habit) => persist.habits([...habits, {id:uid(), createdAt:todayStr(), log:{}, ...habit}]);
  const updateHabit = (id, patch) => persist.habits(habits.map(h=>h.id===id?{...h,...patch}:h));
  const deleteHabit = (id) => persist.habits(habits.filter(h=>h.id!==id));
  const persistHabitsArchive = (n) => { setHabitsArchive(n); saveKey('lifeos:habitsArchive', n); };
  // в архив: убираем из активных, сохраняем привычку целиком + снимок статистики (стрик/выполнено) на момент архивации
  const archiveHabit = (id) => {
    const h = habits.find(x=>x.id===id); if(!h) return;
    const t = todayStr();
    const snap = {...h, archivedAt:t, bestStreak:habitBestStreak(h,t), completedCount:habitCompletedCount(h), challengeDone:habitChallengeDone(h)};
    persistHabitsArchive([...habitsArchive, snap]);
    persist.habits(habits.filter(x=>x.id!==id));
  };
  const deleteArchivedHabit = (id, archivedAt) => persistHabitsArchive(habitsArchive.filter(h=>!(h.id===id && h.archivedAt===archivedAt)));
  const restoreHabit = (id, archivedAt) => {
    const h = habitsArchive.find(x=>x.id===id && x.archivedAt===archivedAt); if(!h) return;
    const {archivedAt:_a, bestStreak:_b, completedCount:_c, challengeDone:_d, ...rest} = h;
    persist.habits([...habits, rest]);
    persistHabitsArchive(habitsArchive.filter(x=>!(x.id===id && x.archivedAt===archivedAt)));
  };
  const toggleHabitDay = (id, ds) => {
    let delta=0; const h0 = habits.find(h=>h.id===id);
    const next = habits.map(h=>{ if(h.id!==id) return h; const log={...(h.log||{})};
      if(log[ds]){ delete log[ds]; delta=-10; } else { log[ds]=true; delta=10; } return {...h, log}; });
    persist.habits(next); if(delta) addXp(delta);
    if(h0 && delta) contributeToGoals(goalLinksOf(h0), delta>0?1:-1);
  };

  // ⚡ Шаблоны задач: сохранить набор задач и добавлять одним тапом. session 015.
  const saveTaskTemplate = (name, items) => { if(!name.trim()||!items.length) return;
    persist.taskTemplates([...taskTemplates, {id:uid(), name:name.trim(), tasks:items.map(t=>({text:t.text, difficulty:t.difficulty||'medium'}))}]); };
  const deleteTaskTemplate = (id) => persist.taskTemplates(taskTemplates.filter(t=>t.id!==id));
  const applyTaskTemplate = (id) => { const tpl=taskTemplates.find(t=>t.id===id); if(!tpl) return;
    const add=(tpl.tasks||[]).map(t=>({id:uid(),text:t.text,done:false,difficulty:t.difficulty||'medium'}));
    updateEntry({ tasks:[...entry.tasks, ...add] }); };

  const addAccount = (name) => persist.finance({...finance, accounts:[...finance.accounts,{id:uid(),name,snapshots:[]}]});
  const deleteAccount = (id) => persist.finance({...finance, accounts:finance.accounts.filter(a=>a.id!==id)});
  const addSnapshot = (accId,snap) => persist.finance({...finance, accounts: finance.accounts.map(a=>a.id===accId?{...a,snapshots:[{id:uid(),ts:Date.now(),...snap},...a.snapshots]}:a)});
  const deleteSnapshot = (accId,snapId) => persist.finance({...finance, accounts: finance.accounts.map(a=>a.id===accId?{...a,snapshots:a.snapshots.filter(s=>s.id!==snapId)}:a)});
  const addDebtor = (name,amount) => persist.finance({...finance, debtors:[...finance.debtors,{id:uid(),name,amount}]});
  const updateDebtor = (id,amount) => persist.finance({...finance, debtors:finance.debtors.map(d=>d.id===id?{...d,amount}:d)});
  const deleteDebtor = (id) => persist.finance({...finance, debtors:finance.debtors.filter(d=>d.id!==id)});

  const streak = useMemo(() => {
    let count=0, cursor=todayStr();
    const hasDone = (ds) => (days[ds]?.tasks||[]).some(t=>t.done) || Object.values(days[ds]?.dailyCompletions||{}).some(Boolean);
    if(!hasDone(cursor)) cursor = addDays(cursor,-1);
    while(hasDone(cursor)){ count++; cursor = addDays(cursor,-1); }
    return count;
  }, [days]);

  const {level,into,needed} = levelForXp(meta.xp||0);

  // ⚡ Импульс: активность за последние 7 дней (задачи + ежедневные + привычки), 0–100.
  // ~3 действия/день = 100%. Растёт когда делаешь много, падает когда сбавляешь — в отличие от XP,
  // который только копится, и от здоровья, которое штрафует за полностью пустые дни.
  const impulse = useMemo(() => {
    let c = 0;
    for(let i=0;i<7;i++){ const ds = daysAgoStr(i);
      c += (days[ds]?.tasks||[]).filter(t=>t.done).length
         + Object.values(days[ds]?.dailyCompletions||{}).filter(Boolean).length
         + habits.reduce((n,h)=> n + (h.log && h.log[ds] ? 1 : 0), 0);
    }
    return Math.min(100, Math.round(c/21*100));
  }, [days, habits]);

  // 🔍 глобальный поиск по задачам/делам/заметкам/целям/привычкам. session 015.
  const searchResults = useMemo(() => {
    const q = searchQ.trim().toLowerCase(); if(q.length<2) return [];
    const out=[]; const push=(o)=>{ if(out.length<50) out.push(o); };
    const hit=(s)=> s && String(s).toLowerCase().includes(q);
    Object.entries(days).forEach(([ds,e])=>{ (e.tasks||[]).forEach(t=>{ if(hit(t.text)) push({type:'Задача',label:t.text,sub:ds,go:()=>{ setSelectedDate(ds); setTab('today'); }}); }); });
    dailyTasks.forEach(d=>{ if(hit(d.text)) push({type:'Ежедневная',label:d.text,sub:'',go:()=>setTab('today')}); });
    ongoing.forEach(o=>{ if(hit(o.text)) push({type:'Долгое дело',label:o.text,sub:o.startDate||'',go:()=>setTab('today')}); });
    study.forEach(s=>{ if(hit(s.task)||hit(s.epic)) push({type:'Дело',label:s.task||s.epic||'—',sub:s.epic||'',go:()=>setTab('study')}); });
    notes.forEach(n=>{ if(hit(n.title)||hit(n.body)) push({type:n.type||'Заметка',label:n.title||(n.body||'').slice(0,40)||'—',sub:'',go:()=>setTab('notes')}); });
    ['year','month','week','day'].forEach(sc=>{ (goals[sc]||[]).forEach(g=>{ if(hit(g.title)) push({type:'Цель · '+GL_SCOPE[sc],label:g.title,sub:'',go:()=>setTab('goals')}); }); });
    habits.forEach(h=>{ if(hit(h.name)) push({type:'Привычка',label:h.name,sub:'',go:()=>setTab('habits')}); });
    return out;
  }, [searchQ, days, dailyTasks, ongoing, study, notes, goals, habits]);
  const runSearchGo = (go) => { go(); setSearchOpen(false); setSearchQ(''); };

  // ---------- achievements: unlocked-множество ОТРАЖАЕТ ТЕКУЩЕЕ состояние (session 011) ----------
  // Раньше было «липко» (раз получил — навсегда). Теперь отменяемо: откатил действие → награда
  // уходит. Стрик/суммарные награды не пропадают, т.к. их метрики — исторические максимумы/тоталы.
  const mountAtRef = useRef(Date.now());
  const achStats = useMemo(()=>computeAchStats({days,goals,study,notes,finance,meta,ongoing,budgets,habits,goalsArchive}),
    [days,goals,study,notes,finance,meta,ongoing,budgets,habits,goalsArchive]);
  // primitive dep so the unlock effect only fires when the earned SET actually changes
  const earnedIds = useMemo(()=> ACHIEVEMENTS.filter(a=>a.val(achStats)>=a.target).map(a=>a.id).join(','), [achStats]);
  useEffect(() => {
    const earned = earnedIds ? earnedIds.split(',') : [];
    const earnedSet = new Set(earned);
    const cur = achievements.unlocked||{};
    // unlocked = ровно текущий earned-набор; дату первого получения сохраняем
    const nextUnlocked = {}; const fresh=[]; let changed=false;
    earned.forEach(id=>{ nextUnlocked[id] = cur[id] || todayStr(); if(!cur[id]){ changed=true; fresh.push(id); } });
    // удаления: id, которые были открыты, но больше не заслужены (откат действия / орфаны каталога)
    Object.keys(cur).forEach(id=>{ if(!earnedSet.has(id)) changed=true; });
    if(!changed) return; // no add/remove → return before setState, no loop
    const next = {unlocked:nextUnlocked, seeded:true};
    setAchievements(next); saveKey('lifeos:achievements', next);
    // Тостим только награды, открытые ДЕЙСТВИЯМИ в сессии. Первые секунды после загрузки
    // (первый заход, синк, рост каталога) — молча. Откаты/удаления тоже без тостов.
    const silent = (Date.now() - mountAtRef.current) < 4000;
    if(silent || !fresh.length) return;
    // XP-бонус за новые достижения (взвешенно по «крутости»: обычная +5 … легендарная +50). session 020.
    // Только за открытые ДЕЙСТВИЯМИ в сессии (silent-окно отсеивает первичный seed/синк — без ретро-накрутки).
    const bonusXp = fresh.reduce((s,id)=>{ const a=ACHIEVEMENTS.find(x=>x.id===id); return s + (a?ACH_TIERS[a.tier].pts*5:0); }, 0);
    if(bonusXp) addXp(bonusXp);
    if(!settings.soundOff) playAchSound();
    if(fresh.length > 4) setToasts(prev => [...prev, {tid:uid(), summary:fresh.length}]);
    else setToasts(prev => [...prev, ...fresh.map(id=>({tid:uid(), id}))]);
  }, [earnedIds, achievements]);
  useEffect(() => { if(toasts.length===0) return; const t=setTimeout(()=>setToasts(x=>x.slice(1)), 4500); return ()=>clearTimeout(t); }, [toasts]);
  // нативные уведомления: пересобираем расписание при изменении привычек/напоминаний/тумблера (на вебе no-op)
  const habitsForNotif = () => habits.map(h => ({ ...h, streak: habitCurrentStreak(h, todayStr()) }));
  // 🌅 текст утренней сводки: сколько привычек/дедлайнов/напоминаний на сегодня. session 019.
  const computeMorningBody = () => {
    const t=todayStr(); const dObj=new Date(t+'T00:00:00'); const wd=dObj.getDay(); const dom=dObj.getDate();
    const habitsToday = habits.filter(h=>isHabitScheduled(h,t) && !habitDoneOn(h,t)).length;
    const remToday = notes.filter(n=>n.type==='Напоминание').filter(n=>{ const r=n.repeat||'none';
      if(r==='daily') return true;
      if(r==='weekly') return (n.remindWeekday!=null?n.remindWeekday:(n.remindDate?new Date(n.remindDate+'T00:00:00').getDay():-1))===wd;
      if(r==='monthly') return (n.remindDay!=null?n.remindDay:(n.remindDate?new Date(n.remindDate+'T00:00:00').getDate():-1))===dom;
      return n.remindDate===t; }).length;
    const dl = study.filter(s=>s.deadline && s.status!=='Выполнено' && s.deadline>=t && s.deadline<=addDays(t,3)).length;
    const parts=[]; if(habitsToday) parts.push(`${habitsToday} привыч.`); if(dl) parts.push(`${dl} дедлайн.`); if(remToday) parts.push(`${remToday} напомин.`);
    return parts.length ? `Сегодня: ${parts.join(' · ')}` : 'На сегодня ничего не запланировано — начни что-то новое!';
  };
  useEffect(() => { syncNotifications({ habits: habitsForNotif(), notes, study, deadlineCfg: settings.deadlineNotif, morningCfg: settings.morningSummary, morningBody: computeMorningBody(), enabled: !settings.notifOff }); }, [habits, notes, study, settings.notifOff, settings.deadlineNotif, settings.morningSummary]);
  // считаем только награды текущего каталога (старые ID из прежней схемы игнорируем)
  const achUnlockedCount = ACHIEVEMENTS.reduce((n,a)=> n + ((achievements.unlocked||{})[a.id]?1:0), 0);

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const dayRows = Object.entries(days).map(([date,e]) => ({
      date, sleepHours:e.sleepHours, rating:e.rating, note:e.note,
      tags:(e.tags||[]).join('; '), tasks:(e.tasks||[]).map(t=>`${t.done?'[x]':'[ ]'} ${t.text}`).join('; '),
      dailyCompletions: Object.entries(e.dailyCompletions||{}).filter(([,v])=>v).map(([id])=>{ const d=dailyTasks.find(x=>x.id===id); return d?d.text:id; }).join('; '),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dayRows), 'Дни');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailyTasks), 'Ежедневные');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ongoing), 'Многодневные');
    const goalRows = [];
    ['year','month','week','day'].forEach(scope => (goals[scope]||[]).forEach(g => goalRows.push({scope, title:g.title, progress:g.progress, subtasks:(g.subtasks||[]).map(s=>`${s.done?'[x]':'[ ]'} ${s.text}`).join('; ')})));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(goalRows), 'Цели');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(study), 'Учёба');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(notes), 'Заметки');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(finance.transactions), 'Операции');
    const snapRows = [];
    finance.accounts.forEach(a => a.snapshots.forEach(s => snapRows.push({account:a.name, date:s.date, amount:s.amount, currency:s.currency, rate:s.rate})));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(snapRows), 'Активы');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(finance.debtors), 'Должники');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bills), 'Регулярные платежи');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{...budgets}]), 'Бюджеты');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([meta]), 'Метаданные');
    // saveOrShare вместо XLSX.writeFile — на телефоне writeFile (blob download) не сохраняет файл. session 019.
    try{
      const b64 = XLSX.write(wb, { bookType:'xlsx', type:'base64' });
      await saveOrShare(`life_os_${todayStr()}.xlsx`, b64, { mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64:true });
    }catch(e){ setImportMsg('Не удалось выгрузить Excel: '+((e&&e.message)||String(e))); }
  };

  // --- Phase A: полный бэкап/перенос через JSON (без потерь, в отличие от xlsx) ---
  const fileInputRef = useRef(null);
  const exportJson = async () => {
    const data = {};
    for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k && k.startsWith('lifeos:')) data[k]=localStorage.getItem(k); }
    try{ await saveOrShare(`life_os_backup_${todayStr()}.json`, JSON.stringify(data,null,2), { mime:'application/json' }); }
    catch(e){ setImportMsg('Не удалось выгрузить JSON: '+((e&&e.message)||String(e))); }
  };
  // Импорт бэкапа. НЕ используем confirm()/alert() — они не рисуются в Android WebView (пользователь
  // не мог восстановить данные на телефоне). Подтверждение — через модалку. session 018.
  const importJson = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      let data; try{ data = JSON.parse(reader.result); }catch(e){ setImportMsg('Не удалось прочитать JSON: '+e.message); return; }
      const keys = Object.keys(data||{}).filter(k=>k.startsWith('lifeos:'));
      if(keys.length===0){ setImportMsg('В файле нет ключей lifeos:* — это не бэкап Life OS.'); return; }
      setImportPending({keys, data});
    };
    reader.readAsText(file);
  };
  const applyImport = () => {
    if(!importPending) return;
    importPending.keys.forEach(k=>{ const v=importPending.data[k]; localStorage.setItem(k, typeof v==='string'? v : JSON.stringify(v)); });
    location.reload();
  };

  _hidden = settings.hidden || {};
  // приблизительная занятость localStorage (ключи lifeos:*). Квота WebView/браузера обычно ~5 МБ;
  // предупреждаем на 80% (≈4 МБ), т.к. при переполнении setItem бросает и данные не сохранятся.
  // UTF-16 → 2 байта/символ (порог не обсуждался — разумный дефолт, см. OPEN.md). session 022.
  const LS_QUOTA = 5*1024*1024;
  let lsBytes = 0; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith('lifeos:')) lsBytes += (k.length + (localStorage.getItem(k)||'').length)*2; }
  const lsPct = Math.round(lsBytes/LS_QUOTA*100);
  // маски приватности финансов: master maskAllFinance перекрывает все типы. session 022.
  const finMask = {
    net:   !!(settings.maskAllFinance || settings.maskNetWorth),
    debts: !!(settings.maskAllFinance || settings.maskDebts),
    ops:   !!(settings.maskAllFinance || settings.maskOps),
  };
  const NAV = [
    {id:'today', label:'Сегодня'}, {id:'habits', label:'Привычки'}, {id:'goals', label:'Цели'}, {id:'study', label:'Дела'},
    {id:'notes', label:'Заметки'}, {id:'finance', label:'Финансы'}, {id:'stats', label:'Статистика'},
    {id:'achievements', label:'🏅 Награды'}, {id:'settings', label:'⚙'},
  ];
  // нижняя навигация (телефон): выбранные в настройках вкладки; «Сегодня» всегда доступна
  const mobileTabIds = (settings.mobileTabs && settings.mobileTabs.length ? settings.mobileTabs : DEFAULT_MOBILE_TABS)
    .filter(id => id==='today' || vis('tab.'+id));
  const sheetTabIds = ALL_MOBILE_TAB_IDS.filter(id => !mobileTabIds.includes(id) && vis('tab.'+id));

  return (
    <div style={{...S.root, padding: isMobile?'16px 12px 92px':'20px 20px 40px'}}>
      <div style={S.header}>
        <div style={{minWidth:0}}>
          <div style={S.eyebrow}>LIFE OS</div>
          <div style={S.h1compact}>{formatDateShort(todayStr())}</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
          <div style={S.miniGauge} title="Здоровье"><span style={{fontSize:15}}>❤</span><span style={S.gaugeVal}>{meta.health ?? 100}</span></div>
          <div style={S.miniGauge} title={`Уровень · ${into}/${needed} XP`}><span style={{fontSize:15}}>🏆</span><span style={S.gaugeVal}>{level}</span></div>
          <button onClick={()=>setSearchOpen(true)} title="Поиск" style={S.profileBtn}>🔍</button>
          <button onClick={()=>setProfileOpen(true)} title="Профиль" style={S.profileBtn}>👤</button>
        </div>
        <input ref={fileInputRef} type="file" accept="application/json,.json" style={{display:'none'}}
          onChange={e=>{ const f=e.target.files[0]; if(f) importJson(f); e.target.value=''; }} />
      </div>

      {searchOpen && (
        <Modal onClose={()=>{ setSearchOpen(false); setSearchQ(''); }} title="🔍 Поиск">
          <input autoFocus style={S.input} placeholder="Задачи, дела, заметки, цели, привычки…" value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
          <div style={{marginTop:12}}>
            {searchQ.trim().length<2 && <div style={S.emptyState}>Введи хотя бы 2 символа</div>}
            {searchQ.trim().length>=2 && searchResults.length===0 && <div style={S.emptyState}>Ничего не найдено</div>}
            {searchResults.map((r,i)=>(
              <div key={i} className="row-hover" style={{padding:'9px 6px',borderBottom:`1px solid ${C.border}`,cursor:'pointer'}} onClick={()=>runSearchGo(r.go)}>
                <div style={{fontSize:13.5,color:C.text,overflowWrap:'anywhere'}}>{r.label}</div>
                <div style={{fontSize:10.5,color:C.dim}}>{r.type}{r.sub?` · ${r.sub}`:''}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {importPending && (
        <Modal onClose={()=>setImportPending(null)} title="Импорт бэкапа">
          <div style={{fontSize:13.5,lineHeight:1.5,marginBottom:14}}>Импортировать <b>{importPending.keys.length}</b> раздел(ов) из файла? Текущие данные будут <b style={{color:C.red}}>перезаписаны</b>. Это действие нельзя отменить.</div>
          <div style={{display:'flex',gap:8}}>
            <button style={{...S.exportBtn,borderColor:C.red,color:C.red,flex:1}} onClick={applyImport}>Импортировать и перезаписать</button>
            <button style={S.exportBtn} onClick={()=>setImportPending(null)}>Отмена</button>
          </div>
        </Modal>
      )}
      {importMsg && (
        <Modal onClose={()=>setImportMsg('')} title="Life OS">
          <div style={{fontSize:13.5,lineHeight:1.5,marginBottom:14}}>{importMsg}</div>
          <button style={S.exportBtn} onClick={()=>setImportMsg('')}>Понятно</button>
        </Modal>
      )}

      {profileOpen && (
        <Modal onClose={()=>setProfileOpen(false)} title={formatDateRu(todayStr())}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div style={S.profTile}><span style={{fontSize:20}}>🔥</span><div><div style={S.gaugeVal}>{streak}</div><div style={S.gaugeLabel}>дней подряд</div></div></div>
            <div style={S.profTile}><span style={{fontSize:20}}>❤</span><div style={{flex:1}}><div style={S.gaugeVal}>{meta.health ?? 100}</div><div style={S.gaugeBarWrap}><div style={{...S.gaugeBarFill, background:C.red, width:`${meta.health ?? 100}%`}}/></div></div></div>
            <div style={S.profTile}><span style={{fontSize:20}}>⚡</span><div style={{flex:1}}><div style={S.gaugeVal}>{impulse}</div><div style={S.gaugeBarWrap}><div style={{...S.gaugeBarFill, background:C.purple, width:`${impulse}%`}}/></div><div style={S.gaugeLabel}>импульс · 7 дней</div></div></div>
            <div style={S.profTile}><span style={{fontSize:20}}>🏆</span><div style={{flex:1}}><div style={S.gaugeVal}>Ур. {level}</div><div style={S.gaugeBarWrap}><div style={{...S.gaugeBarFill, width:`${(into/needed)*100}%`}}/></div><div style={S.gaugeLabel}>{into}/{needed} XP</div></div></div>
          </div>
          {vis('tab.achievements') && <button style={{...S.sheetRow,marginTop:12}} onClick={()=>{ setTab('achievements'); setProfileOpen(false); }}>🏅 Награды · {achUnlockedCount}</button>}
          <div style={S.sheetSection}>Аккаунт · синхронизация</div>
          {user
            ? <button style={{...S.sheetRow, borderColor:C.green, color:C.green}} onClick={()=>{ logout(); setProfileOpen(false); }}>☁ Выйти{user.email?` · ${user.email}`:''}</button>
            : <button style={S.sheetRow} onClick={()=>{ login().catch(err=>alert('Вход не удался: '+err.message)); setProfileOpen(false); }}>☁ Войти через Google</button>}
          <div style={S.sheetSection}>Данные</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <button style={S.sheetBtn} onClick={()=>{ exportExcel(); }}>⬇ Excel</button>
            <button style={S.sheetBtn} onClick={()=>{ exportJson(); }}>⬇ JSON</button>
            <button style={S.sheetBtn} onClick={()=>{ fileInputRef.current && fileInputRef.current.click(); setProfileOpen(false); }}>⬆ Импорт</button>
          </div>
        </Modal>
      )}

      {lsPct>=80 && !lsWarnDismissed && (
        <div style={{background:'#3A2417',border:`1px solid ${C.amber}`,borderRadius:8,padding:'10px 12px',marginBottom:14,display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:12.5,color:C.amber,flex:1,lineHeight:1.45}}>⚠️ Хранилище почти заполнено: {lsPct}% (~{Math.round(lsBytes/1024)} КБ из ~5 МБ). Сделай бэкап (Экспорт JSON) и почисти старые данные — иначе новые записи могут не сохраниться.</span>
          <button className="icon-btn" title="скрыть" onClick={()=>setLsWarnDismissed(true)}>✕</button>
        </div>
      )}

      {!isMobile && (
        <div style={S.nav}>
          {NAV.filter(n => n.id==='today' || n.id==='settings' || vis('tab.'+n.id)).map(n => (
            <button key={n.id} className="tab-btn" onClick={()=>setTab(n.id)}
              style={{...S.tabBtn, color: tab===n.id?C.text:C.dim, borderBottom: tab===n.id?`2px solid ${C.amber}`:'2px solid transparent'}}>
              {n.label}
            </button>
          ))}
        </div>
      )}

      <div key={tab} className="anim-tab">
      {tab==='today' && <TodayTab entry={entry} selectedDate={selectedDate} setSelectedDate={setSelectedDate}
        addTask={addTask} toggleTask={toggleTask} deleteTask={deleteTask} updateEntry={updateEntry} goals={goals}
        maskOps={finMask.ops}
        tags={tags} toggleTagOnDay={toggleTagOnDay} addTagGlobal={addTagGlobal} removeTagGlobal={removeTagGlobal}
        dailyTasks={dailyTasks} toggleDaily={toggleDaily} addDailyTask={addDailyTask} deleteDailyTask={deleteDailyTask}
        ongoing={ongoing} addOngoing={addOngoing} finishOngoing={finishOngoing} deleteOngoing={deleteOngoing}
        bills={bills} taskTemplates={taskTemplates} saveTaskTemplate={saveTaskTemplate} applyTaskTemplate={applyTaskTemplate} deleteTaskTemplate={deleteTaskTemplate}
        carryOverTasks={carryOverTasks} prevUndoneCount={prevUndoneTasks.length} />}
      {tab==='habits' && <HabitsTab habits={habits} addHabit={addHabit} toggleHabitDay={toggleHabitDay} deleteHabit={deleteHabit} updateHabit={updateHabit} archiveHabit={archiveHabit} archive={habitsArchive} deleteArchivedHabit={deleteArchivedHabit} restoreHabit={restoreHabit} goals={goals} notifsOn={!settings.notifOff} />}
      {tab==='goals' && <GoalsTab goals={goals} addGoal={addGoal} setGoalProgress={setGoalProgress}
        addGoalSubtask={addGoalSubtask} toggleGoalSubtask={toggleGoalSubtask}
        deleteGoalSubtask={deleteGoalSubtask} deleteGoal={deleteGoal}
        setGoalMode={setGoalMode} setGoalCounter={setGoalCounter} archiveGoal={archiveGoal}
        archive={goalsArchive} openArchive={()=>setArchiveOpen(true)} />}
      {tab==='study' && <StudyTab study={study} addStudyTask={addStudyTask} updateStudyTask={updateStudyTask} deleteStudyTask={deleteStudyTask} archiveStudyTask={archiveStudyTask} archive={studyArchive} deleteArchivedStudy={deleteArchivedStudy} restoreStudy={restoreStudy} />}
      {tab==='notes' && <NotesTab notes={notes} addNote={addNote} updateNote={updateNote} deleteNote={deleteNote} />}
      {tab==='finance' && <FinanceTab finance={finance} categories={categories} budgets={budgets} incomePlans={incomePlans} bills={bills} defaults={settings.defaults||{}}
        finMask={finMask} setSettingFlag={setSettingFlag}
        addTransaction={addTransaction} deleteTransaction={deleteTransaction}
        addCategory={addCategory} removeCategory={removeCategory} setBudget={setBudget} removeBudget={removeBudget}
        setIncomePlan={setIncomePlan} removeIncomePlan={removeIncomePlan} setBudgetsBatch={setBudgetsBatch} setIncomePlansBatch={setIncomePlansBatch}
        addBill={addBill} deleteBill={deleteBill}
        addAccount={addAccount} deleteAccount={deleteAccount} addSnapshot={addSnapshot} deleteSnapshot={deleteSnapshot}
        addDebtor={addDebtor} updateDebtor={updateDebtor} deleteDebtor={deleteDebtor} />}
      {tab==='stats' && <StatsTab days={days} finance={finance} budgets={budgets} incomePlans={incomePlans} habits={habits} finMask={finMask} />}
      {tab==='achievements' && <AchievementsTab stats={achStats} unlocked={achievements.unlocked||{}} />}
      {tab==='settings' && <SettingsTab hidden={settings.hidden||{}} toggleModule={toggleModule}
        defaults={settings.defaults||{}} setDefault={setDefault} categories={categories} accounts={finance.accounts}
        mobileTabs={mobileTabIds} toggleMobileTab={toggleMobileTab}
        soundOff={!!settings.soundOff} notifOff={!!settings.notifOff}
        maskNetWorth={!!settings.maskNetWorth} maskDebts={!!settings.maskDebts} maskOps={!!settings.maskOps} maskAllFinance={!!settings.maskAllFinance}
        morningCfg={settings.morningSummary||null} setSettingFlag={setSettingFlag}
        requestNotifs={requestNotifs} testNotif={testNotif} showNotifDiag={showNotifDiag} notifMsg={notifMsg} deadlineCfg={settings.deadlineNotif||null} />}
      </div>

      {isMobile && (
        <div style={S.bottomNav}>
          {mobileTabIds.map(id => {
            const active = tab===id; const m=TAB_META[id]||{label:id,icon:'•'};
            return (
              <button key={id} onClick={()=>{ setTab(id); setSheetOpen(false); }} style={{...S.bottomItem, color:active?C.amber:C.dim}}>
                <span style={{fontSize:20, filter:active?'none':'grayscale(.4)'}}>{m.icon}</span>
                <span style={{fontSize:10}}>{m.label}</span>
              </button>
            );
          })}
          <button onClick={()=>setSheetOpen(true)} style={{...S.bottomItem, color: (!mobileTabIds.includes(tab))?C.amber:C.dim}}>
            <span style={{fontSize:20}}>☰</span><span style={{fontSize:10}}>Ещё</span>
          </button>
        </div>
      )}

      {isMobile && sheetOpen && (
        <div className="anim-fade" style={S.sheetOverlay} onClick={()=>setSheetOpen(false)}>
          <div className="anim-sheet" style={S.sheet} onClick={e=>e.stopPropagation()}>
            <div style={S.sheetGrab} />
            <div style={S.sheetSection}>Разделы</div>
            <div style={S.sheetGrid}>
              {sheetTabIds.map(id=>{ const m=TAB_META[id]; return (
                <button key={id} onClick={()=>{ setTab(id); setSheetOpen(false); }} style={{...S.sheetTile, ...(tab===id?{borderColor:C.amber,color:C.amber}:{})}}>
                  <span style={{fontSize:22}}>{m.icon}</span><span style={{fontSize:12}}>{m.label}</span>
                </button>
              );})}
              <button onClick={()=>{ setTab('settings'); setSheetOpen(false); }} style={{...S.sheetTile, ...(tab==='settings'?{borderColor:C.amber,color:C.amber}:{})}}>
                <span style={{fontSize:22}}>⚙</span><span style={{fontSize:12}}>Настройки</span>
              </button>
            </div>
            <div style={S.sheetSection}>Аккаунт · синхронизация</div>
            {user
              ? <button style={{...S.sheetRow, borderColor:C.green, color:C.green}} onClick={()=>{ logout(); setSheetOpen(false); }}>☁ Выйти{user.email?` · ${user.email}`:''}</button>
              : <button style={S.sheetRow} onClick={()=>{ login().catch(err=>alert('Вход не удался: '+err.message)); setSheetOpen(false); }}>☁ Войти через Google</button>}
            <div style={S.sheetSection}>Данные</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button style={S.sheetBtn} onClick={()=>{ exportExcel(); setSheetOpen(false); }}>⬇ Excel</button>
              <button style={S.sheetBtn} onClick={()=>{ exportJson(); setSheetOpen(false); }}>⬇ JSON</button>
              <button style={S.sheetBtn} onClick={()=>{ fileInputRef.current && fileInputRef.current.click(); setSheetOpen(false); }}>⬆ Импорт</button>
            </div>
            <button style={{...S.sheetRow, marginTop:14, textAlign:'center', color:C.dim}} onClick={()=>setSheetOpen(false)}>Закрыть</button>
          </div>
        </div>
      )}

      {rollover && (
        <RolloverModal scopes={rollover.scopes} onApply={applyRollover} onClose={()=>setRollover(null)} />
      )}

      {confirmDialog && (
        <Modal compact onClose={()=>setConfirmDialog(null)} title="Подтверждение">
          <div style={{fontSize:13.5,color:C.text,marginBottom:16,lineHeight:1.5}}>{confirmDialog.message}</div>
          <div style={{display:'flex',gap:8}}>
            <button style={{...S.sheetBtn,borderColor:C.amber,color:C.amber}} onClick={()=>{ const f=confirmDialog.onYes; setConfirmDialog(null); f&&f(); }}>Да</button>
            <button style={S.sheetBtn} onClick={()=>setConfirmDialog(null)}>Отмена</button>
          </div>
        </Modal>
      )}

      {archiveOpen && (
        <Modal onClose={()=>setArchiveOpen(false)} title={`Архив целей · ${goalsArchive.length}`}>
          {goalsArchive.length===0 && <div style={S.emptyState}>Архив пуст</div>}
          {[...goalsArchive].reverse().map((g,i)=>(
            <div key={g.id+'_'+g.archivedAt+'_'+i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
              <div style={{flex:1,minWidth:0,overflowWrap:'anywhere'}}>
                <div style={{fontSize:13,color:(g.progress||0)>=100?C.green:C.text}}>{(g.progress||0)>=100?'✓ ':''}{g.title}</div>
                <div style={{fontSize:10.5,color:C.dim}}>{PERIOD_LABEL[g.scope]||g.scope} · {g.period||'—'} · {g.progress||0}%{g.completedAt?` · ✅ выполнено ${g.completedAt}`:''} · архив {g.archivedAt}</div>
              </div>
              <button className="icon-btn" title="вернуть в активные" style={{color:C.cyan}} onClick={()=>restoreGoal(g.id, g.archivedAt)}>↩</button>
              <ConfirmIconBtn onConfirm={()=>persistArchive(goalsArchive.filter(x=>!(x.id===g.id && x.archivedAt===g.archivedAt)))} title="удалить из архива" />
            </div>
          ))}
        </Modal>
      )}

      {toasts.length>0 && (
        <div style={{...S.toastWrap, bottom: isMobile?86:16}}>
          {toasts.map(t=>{
            if(t.summary){
              return (
                <div key={t.tid} className="anim-toast" style={{...S.toast, borderColor:C.amber, cursor:'pointer'}} onClick={()=>setTab('achievements')}>
                  <span style={{fontSize:26}}>🏅</span>
                  <div>
                    <div style={{fontSize:10.5, color:C.amber, letterSpacing:'.08em'}}>ДОСТИЖЕНИЯ</div>
                    <div style={{fontSize:14, fontWeight:700}}>Открыто сразу {t.summary}</div>
                    <div style={{fontSize:11, color:C.dim}}>Загляни во вкладку 🏅 Награды</div>
                  </div>
                </div>
              );
            }
            const a=ACHIEVEMENTS.find(x=>x.id===t.id); if(!a) return null; const tier=ACH_TIERS[a.tier];
            return (
              <div key={t.tid} className="anim-toast" style={{...S.toast, borderColor:tier.c}}>
                <span style={{fontSize:26}}>{a.icon}</span>
                <div>
                  <div style={{fontSize:10.5, color:tier.c, letterSpacing:'.08em'}}>ДОСТИЖЕНИЕ ПОЛУЧЕНО</div>
                  <div style={{fontSize:14, fontWeight:700}}>{a.title}</div>
                  <div style={{fontSize:11, color:C.dim}}>{a.desc}</div>
                </div>
              </div>
            ); })}
        </div>
      )}
    </div>
  );
}

// ============================================================ Today
function TodayTab({entry, selectedDate, setSelectedDate, addTask, toggleTask, deleteTask, updateEntry, goals,
  tags, toggleTagOnDay, addTagGlobal, removeTagGlobal, dailyTasks, toggleDaily, addDailyTask, deleteDailyTask,
  ongoing, addOngoing, finishOngoing, deleteOngoing, bills, maskOps=false,
  taskTemplates=[], saveTaskTemplate, applyTaskTemplate, deleteTaskTemplate, carryOverTasks, prevUndoneCount=0}){
  const [newTaskText,setNewTaskText] = useState('');
  const [tplOpen,setTplOpen] = useState(false);
  const [tplName,setTplName] = useState('');
  const [ratingEdit,setRatingEdit] = useState(false);
  const [ratingDraft,setRatingDraft] = useState(5);
  const [difficulty,setDifficulty] = useState('medium');
  // привязка новой РАЗОВОЙ задачи к цели
  const [linkOpen,setLinkOpen] = useState(false);
  const [taskLinks,setTaskLinks] = useState([]);
  const submitTask = () => { if(!newTaskText.trim()) return; addTask(newTaskText.trim(), difficulty, taskLinks);
    setNewTaskText(''); setTaskLinks([]); };
  // привязка новой ЕЖЕДНЕВНОЙ задачи к цели
  const [dailyLinkOpen,setDailyLinkOpen] = useState(false);
  const [dailyLinks,setDailyLinks] = useState([]);
  const submitDaily = () => { if(!newDailyText.trim()) return; addDailyTask(newDailyText.trim(), dailyLinks);
    setNewDailyText(''); setDailyLinks([]); };
  const [sleepInput,setSleepInput] = useState(entry.sleepHours ?? '');
  const [noteInput,setNoteInput] = useState(entry.note || '');
  const [newTagInput,setNewTagInput] = useState('');
  const [showTagInput,setShowTagInput] = useState(false);
  const [newDailyText,setNewDailyText] = useState('');
  const [ongoingText,setOngoingText] = useState('');
  const [ongoingEnd,setOngoingEnd] = useState('');

  useEffect(()=>{ setSleepInput(entry.sleepHours ?? ''); setNoteInput(entry.note || ''); setRatingEdit(false); }, [selectedDate]);

  const doneCount = entry.tasks.filter(t=>t.done).length;
  const dayNum = parseInt(selectedDate.slice(8,10),10);
  const todaysBill = bills.find(b=>b.dayOfMonth===dayNum);
  const activeOngoing = ongoing.filter(o => !o.done && o.startDate<=selectedDate && (!o.endDate || o.endDate>=selectedDate));

  return (
    <div className="grid2" style={S.grid2}>
      <div>
        <div style={S.panel}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <button style={S.navArrow} onClick={()=>setSelectedDate(addDays(selectedDate,-1))}>◀</button>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13}}>{selectedDate}</span>
              <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} onClick={openDatePicker} style={{...S.input, padding:'4px 6px', minWidth:0}} />
            </div>
            <button style={S.navArrow} onClick={()=>setSelectedDate(addDays(selectedDate,1))}>▶</button>
          </div>
          {selectedDate!==todayStr() && <div style={{...S.dimSpan, marginTop:6}}>не сегодня — редактируешь другую дату</div>}
          {todaysBill && <div style={{...S.dimSpan, marginTop:6, color:C.amber}}>Сегодня платёж: {todaysBill.name} — {maskMoney(maskOps, todaysBill.amount)}</div>}
        </div>

        <div style={S.panel}>
          <div style={S.panelTitle}>Задачи <span style={S.dimSpan}>{doneCount}/{entry.tasks.length}</span></div>
          <div style={S.inputRow}>
            <input style={S.input} placeholder="Например: 10 мин английского" value={newTaskText}
              onChange={e=>setNewTaskText(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') submitTask(); }} />
            <Select style={{minWidth:120}} value={difficulty} onChange={setDifficulty}
              options={[{value:'easy',label:'лёгкая'},{value:'medium',label:'средняя'},{value:'hard',label:'сложная'}]} />
            <button style={S.iconBtnAmber} onClick={submitTask}>+</button>
          </div>
          <div style={{marginTop:8}}>
            <span style={{fontSize:11.5,color:linkOpen?C.amber:C.cyan,cursor:'pointer'}} onClick={()=>setLinkOpen(o=>!o)}>
              🎯 {linkOpen?'убрать привязку к цели':'привязать к цели'}
            </span>
          </div>
          {linkOpen && <GoalLinkPicker goals={goals} links={taskLinks} onLinks={setTaskLinks} />}
          <div style={{marginTop:8}}>
            <span style={{fontSize:11.5,color:tplOpen?C.amber:C.cyan,cursor:'pointer'}} onClick={()=>setTplOpen(o=>!o)}>⚡ {tplOpen?'скрыть шаблоны':'шаблоны задач'}</span>
          </div>
          {tplOpen && (
            <div style={{marginTop:8}}>
              {taskTemplates.length>0 && (
                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
                  {taskTemplates.map(tpl=>(
                    <div key={tpl.id} className="chip" style={{background:C.panelAlt,color:C.text,borderColor:C.border,display:'flex',gap:6,alignItems:'center',maxWidth:'100%'}}>
                      <span style={{cursor:'pointer',minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={`Добавить ${tpl.tasks.length} задач`} onClick={()=>applyTaskTemplate(tpl.id)}>⚡ {tpl.name} · {tpl.tasks.length}</span>
                      <span style={{cursor:'pointer',flexShrink:0,color:C.dim}} title="удалить шаблон" onClick={()=>deleteTaskTemplate(tpl.id)}>✕</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                <input style={{...S.input,flex:'1 1 140px',minWidth:0,fontSize:12}} placeholder="назвать шаблон из текущих задач" value={tplName} onChange={e=>setTplName(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter' && tplName.trim() && entry.tasks.length){ saveTaskTemplate(tplName.trim(), entry.tasks); setTplName(''); } }} />
                <button style={{...S.iconBtnAmber,width:32,height:32,fontSize:14}} title="сохранить текущие задачи как шаблон"
                  disabled={!tplName.trim()||!entry.tasks.length}
                  onClick={()=>{ if(tplName.trim() && entry.tasks.length){ saveTaskTemplate(tplName.trim(), entry.tasks); setTplName(''); } }}>💾</button>
              </div>
              {!entry.tasks.length && <div style={{...S.dimSpan,marginLeft:0,marginTop:4,display:'block',fontSize:10.5}}>Добавь задачи в этот день, чтобы сохранить их как шаблон.</div>}
            </div>
          )}
          {prevUndoneCount>0 && vis('today.carryover') && (
            <div style={{marginTop:8}}>
              <button style={{...S.exportBtn,borderColor:C.cyan,color:C.cyan,width:'100%'}} onClick={carryOverTasks}>🔁 Перенести незакрытые со вчера · {prevUndoneCount}</button>
            </div>
          )}
          <div style={{marginTop:10}}>
            {entry.tasks.length===0 && <div style={S.emptyState}>Пусто. Добавь 1–3 дела.</div>}
            {entry.tasks.map(t=>(
              <div key={t.id} className="row-hover" style={S.taskRow}>
                <input type="checkbox" checked={t.done} onChange={()=>toggleTask(t.id)} />
                <div style={{flex:1, minWidth:0, overflowWrap:'anywhere', textDecoration:t.done?'line-through':'none', color:t.done?C.dim:C.text}}>{t.text}</div>
                {goalLinksOf(t).map((l,i)=><span key={i} title={`Вклад в цель: +${l.amount}`} style={{fontSize:11,color:C.amber,flexShrink:0}}>🎯+{l.amount}</span>)}
                <span style={{fontSize:10, color:C.dim}}>{t.difficulty||'medium'}</span>
                <ConfirmIconBtn onConfirm={()=>deleteTask(t.id)} confirmLabel="удалить?" title="удалить задачу" />
              </div>
            ))}
          </div>
        </div>

        {vis('today.daily') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Ежедневные</div>
          <div style={S.inputRow}>
            <input style={S.input} placeholder="Новая повторяющаяся привычка" value={newDailyText}
              onChange={e=>setNewDailyText(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') submitDaily(); }} />
            <button style={S.iconBtnAmber} onClick={submitDaily}>+</button>
          </div>
          <div style={{marginTop:8}}>
            <span style={{fontSize:11.5,color:dailyLinkOpen?C.amber:C.cyan,cursor:'pointer'}} onClick={()=>setDailyLinkOpen(o=>!o)}>
              🎯 {dailyLinkOpen?'убрать привязку к цели':'привязать к цели'}
            </span>
          </div>
          {dailyLinkOpen && <GoalLinkPicker goals={goals} links={dailyLinks} onLinks={setDailyLinks} />}
          {dailyTasks.length===0 && <div style={S.emptyState}>Пока нет ежедневных дел</div>}
          {dailyTasks.filter(d=>d.active).map(d=>(
            <div key={d.id} className="row-hover" style={S.taskRow}>
              <input type="checkbox" checked={!!(entry.dailyCompletions||{})[d.id]} onChange={()=>toggleDaily(d.id)} />
              <div style={{flex:1,minWidth:0,overflowWrap:'anywhere'}}>{d.text}</div>
              {goalLinksOf(d).map((l,i)=><span key={i} title={`Вклад в цель: +${l.amount}`} style={{fontSize:11,color:C.amber,flexShrink:0}}>🎯+{l.amount}</span>)}
              <button className="icon-btn" onClick={()=>deleteDailyTask(d.id)}>✕</button>
            </div>
          ))}
        </div>
        )}

        {vis('today.ongoing') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>На несколько дней</div>
          <div style={S.inputRow}>
            <input style={S.input} placeholder="Задача" value={ongoingText} onChange={e=>setOngoingText(e.target.value)} />
            <input style={{...S.input, maxWidth:140}} type="date" value={ongoingEnd} onChange={e=>setOngoingEnd(e.target.value)} onClick={openDatePicker} placeholder="до (необязательно)" />
            <button style={S.iconBtnAmber} onClick={()=>{ if(ongoingText.trim()){ addOngoing({text:ongoingText.trim(), startDate:selectedDate, endDate:ongoingEnd||undefined}); setOngoingText(''); setOngoingEnd(''); } }}>+</button>
          </div>
          {activeOngoing.length===0 && <div style={S.emptyState}>Нет активных многодневных задач</div>}
          {activeOngoing.map(o=>(
            <div key={o.id} className="row-hover" style={S.taskRow}>
              <input type="checkbox" checked={false} onChange={()=>finishOngoing(o.id)} />
              <div style={{flex:1,minWidth:0,overflowWrap:'anywhere'}}>{o.text}<div style={{fontSize:10,color:C.dim}}>{o.startDate}{o.endDate?` → ${o.endDate}`:' → бессрочно'}</div></div>
              <button className="icon-btn" onClick={()=>deleteOngoing(o.id)}>✕</button>
            </div>
          ))}
        </div>
        )}

        {vis('today.tags') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Теги дня</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>
            {tags.map(tg=>{ const active=(entry.tags||[]).includes(tg);
              return <div key={tg} className="chip" style={{background:active?C.amber:C.panelAlt, color:active?'#1A1200':C.dim, borderColor:active?C.amber:C.border, display:'inline-flex', alignItems:'center', gap:4, paddingTop:2, paddingBottom:2}}>
                <span style={{cursor:'pointer'}} onClick={()=>toggleTagOnDay(tg)}>{tg}</span>
                <ConfirmIconBtn onConfirm={()=>removeTagGlobal(tg)} title="удалить тег" />
              </div>; })}
            {showTagInput ? (
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <input autoFocus style={{...S.input, maxWidth:120, minWidth:80}} value={newTagInput} onChange={e=>setNewTagInput(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter' && newTagInput.trim()){ addTagGlobal(newTagInput.trim()); setNewTagInput(''); setShowTagInput(false); } if(e.key==='Escape'){ setShowTagInput(false); setNewTagInput(''); } }} />
                <button title="добавить тег" style={{...S.iconBtnAmber,width:30,height:30,fontSize:14}}
                  onClick={()=>{ if(newTagInput.trim()){ addTagGlobal(newTagInput.trim()); setNewTagInput(''); } setShowTagInput(false); }}>✓</button>
                <button className="icon-btn" onClick={()=>{ setShowTagInput(false); setNewTagInput(''); }}>✕</button>
              </div>
            ) : <div className="chip" style={{background:C.panelAlt,color:C.dim,borderColor:C.border}} onClick={()=>setShowTagInput(true)}>+ добавить</div>}
          </div>
        </div>
        )}
      </div>

      <div>
        {vis('today.rating') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Оценка дня</div>
          {!ratingEdit ? (
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1,fontFamily:"'JetBrains Mono',monospace",fontSize:16,fontWeight:700}}>{entry.rating!=null?`${entry.rating} / 10`:<span style={{color:C.dim,fontWeight:400,fontSize:13}}>не оценён</span>}</div>
              <button style={{...S.exportBtn,borderColor:C.amber,color:C.amber}} onClick={()=>{ setRatingDraft(entry.rating||5); setRatingEdit(true); }}>✏ {entry.rating!=null?'изменить':'оценить'}</button>
            </div>
          ) : (
            <div>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <input type="range" min="1" max="10" value={ratingDraft} style={{flex:1}} onChange={e=>setRatingDraft(parseInt(e.target.value,10))} />
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:16,fontWeight:700,minWidth:24,textAlign:'right'}}>{ratingDraft}</div>
              </div>
              <div style={{display:'flex',gap:8,marginTop:10}}>
                <button style={{...S.exportBtn,borderColor:C.green,color:C.green,flex:1}} onClick={()=>{ updateEntry({rating:ratingDraft}); setRatingEdit(false); }}>💾 Сохранить</button>
                <button style={S.exportBtn} onClick={()=>setRatingEdit(false)}>Отмена</button>
              </div>
            </div>
          )}
        </div>
        )}
        {vis('today.sleep') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Сон</div>
          <div style={S.dimSpan}>{entry.sleepHours!=null? `Записано: ${entry.sleepHours} ч` : 'Ещё не записано'}</div>
          <div style={S.inputRow}>
            <input style={S.input} type="number" step="0.5" placeholder="часов" value={sleepInput} onChange={e=>setSleepInput(e.target.value)} />
            <button style={S.iconBtnAmber} onClick={()=>{ const v=parseFloat(sleepInput); if(!isNaN(v)) updateEntry({sleepHours:v}); }}>+</button>
          </div>
        </div>
        )}
        {vis('today.note') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Что было · почему</div>
          <textarea style={S.textarea} rows={6} placeholder="Что получилось, что нет, почему…" value={noteInput}
            onChange={e=>setNoteInput(e.target.value)} onBlur={()=>updateEntry({note:noteInput})} />
        </div>
        )}
      </div>
    </div>
  );
}

// ============================================================ Habits
function HabitsTab({habits, addHabit, toggleHabitDay, deleteHabit, updateHabit, archiveHabit, archive=[], deleteArchivedHabit, restoreHabit, goals={}, notifsOn}){
  const [name,setName] = useState('');
  const [archiveShow,setArchiveShow] = useState(false);
  const [schedType,setSchedType] = useState('daily');
  const [wdays,setWdays] = useState([1,2,3,4,5,6,0]);
  const [target,setTarget] = useState('');
  const [freezes,setFreezes] = useState('');
  const [reminder,setReminder] = useState('');
  const [showOpts,setShowOpts] = useState(false);
  const [habitLinks,setHabitLinks] = useState([]);
  const today = todayStr();
  const WD_ORDER = [1,2,3,4,5,6,0]; // Пн..Вс

  const submit = () => {
    if(!name.trim()) return;
    if(schedType==='weekdays' && wdays.length===0){ alert('Выбери хотя бы один день недели'); return; }
    const schedule = schedType==='weekdays' ? {type:'weekdays', days:[...wdays]} : {type:'daily'};
    const t = parseInt(target,10), f = parseInt(freezes,10);
    addHabit({ name:name.trim(), schedule, targetDays: t>0?t:0, freezesPerMonth: f>0?f:0, reminderTime: reminder||undefined, ...(habitLinks.length?{goalLinks:habitLinks}:{}) });
    setName(''); setTarget(''); setFreezes(''); setReminder(''); setSchedType('daily'); setWdays([1,2,3,4,5,6,0]); setShowOpts(false); setHabitLinks([]);
  };
  const toggleWd = (d) => setWdays(prev => prev.includes(d)? prev.filter(x=>x!==d) : [...prev,d]);

  return (
    <div>
      <div style={S.panel}>
        <div style={S.panelTitle}>Новая привычка</div>
        <div style={S.inputRow}>
          <input style={S.input} placeholder="Например: 10 минут медитации" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />
          <button style={S.iconBtnAmber} onClick={submit}>+</button>
        </div>
        <div style={{marginTop:8}}>
          <span style={{fontSize:11.5,color:C.cyan,cursor:'pointer'}} onClick={()=>setShowOpts(!showOpts)}>{showOpts?'скрыть настройки':'настройки: расписание · цель · заморозки'}</span>
        </div>
        {showOpts && (
          <div style={{marginTop:10, display:'flex', flexDirection:'column', gap:10}}>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
              {[{id:'daily',label:'Каждый день'},{id:'weekdays',label:'Дни недели'}].map(o=>(
                <div key={o.id} className="chip" onClick={()=>setSchedType(o.id)} style={{background:schedType===o.id?C.amber:C.panelAlt,color:schedType===o.id?'#1A1200':C.dim,borderColor:schedType===o.id?C.amber:C.border}}>{o.label}</div>
              ))}
            </div>
            {schedType==='weekdays' && (
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {WD_ORDER.map(d=>{ const on=wdays.includes(d); return (
                  <div key={d} className="chip" onClick={()=>toggleWd(d)} style={{background:on?C.cyan:C.panelAlt,color:on?'#08201E':C.dim,borderColor:on?C.cyan:C.border,minWidth:34,textAlign:'center',padding:'6px 8px'}}>{HABIT_WD[d]}</div>
                ); })}
              </div>
            )}
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <input style={{...S.input,maxWidth:190}} type="number" min="0" placeholder="цель на N дней (0 = без цели)" value={target} onChange={e=>setTarget(e.target.value)} />
              <input style={{...S.input,maxWidth:210}} type="number" min="0" placeholder="заморозки: пропусков в месяц" value={freezes} onChange={e=>setFreezes(e.target.value)} />
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{fontSize:12,color:C.dim}}>🔔 Напоминание в</span>
              <input style={{...S.input,maxWidth:120,flex:'none'}} type="time" value={reminder} onChange={e=>setReminder(e.target.value)} />
              <span style={{fontSize:10.5,color:C.dim}}>{notifsOn?'(придёт на телефон)':'(включи уведомления в Настройках)'}</span>
            </div>
            <div>
              <div style={{fontSize:11,color:C.dim,marginBottom:2}}>🎯 Привязать к цели (вклад при отметке)</div>
              <GoalLinkPicker goals={goals} links={habitLinks} onLinks={setHabitLinks} />
            </div>
          </div>
        )}
      </div>

      {habits.length===0 && <div style={{...S.panel,...S.emptyState}}>Пока нет привычек. Добавь первую 🔁</div>}

      {habits.map(h=>{
        const streak = habitCurrentStreak(h, today);
        const best = habitBestStreak(h, today);
        const done = habitCompletedCount(h);
        const todayScheduled = isHabitScheduled(h, today);
        const todayDone = habitDoneOn(h, today);
        const targetPct = h.targetDays>0 ? Math.min(100, done/h.targetDays*100) : 0;
        const challenge = habitChallengeDone(h);
        const last7 = []; for(let i=6;i>=0;i--) last7.push(addDays(today,-i));
        return (
          <div key={h.id} style={S.panel}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14.5,fontWeight:700}}>{h.name}</div>
                <div style={{fontSize:11,color:C.dim,marginTop:2}}>
                  {habitScheduleLabel(h)}{h.freezesPerMonth>0?` · ❄ ${h.freezesPerMonth}/мес`:''}{h.targetDays>0?` · цель ${h.targetDays} дн.`:''}{goalLinksOf(h).map((l,i)=><span key={i} style={{color:C.amber}}> · 🎯+{l.amount}</span>)}{h.reminderTime?<span style={{color:C.cyan}}> · 🔔 {h.reminderTime}</span>:null}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
                  <span style={{fontSize:10.5,color:C.dim}}>🔔</span>
                  <input style={{...S.input,maxWidth:110,flex:'none',fontSize:11,padding:'4px 6px'}} type="time" value={h.reminderTime||''}
                    onChange={e=>updateHabit(h.id,{reminderTime:e.target.value||undefined})} />
                  {h.reminderTime && <button className="icon-btn" title="убрать напоминание" onClick={()=>updateHabit(h.id,{reminderTime:undefined})}>✕</button>}
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:16,fontWeight:700,color:streak>0?C.amber:C.dim}}>🔥 {streak}</div>
                <div style={{fontSize:10,color:C.dim}}>рекорд {best}</div>
              </div>
              <ConfirmIconBtn onConfirm={()=>archiveHabit(h.id)} icon="🏁" confirmLabel="в архив?" title="в архив (сохранить историю)" />
              <ConfirmIconBtn onConfirm={()=>deleteHabit(h.id)} confirmLabel="удалить?" title="удалить безвозвратно" />
            </div>

            {h.targetDays>0 && (
              <div style={{marginTop:8}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:C.dim,marginBottom:3}}>
                  <span>Челлендж{challenge?' · пройден 🎉':''}</span><span>{done} / {h.targetDays}</span>
                </div>
                <div style={{height:5,background:C.panelAlt,borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${targetPct}%`,background:challenge?C.green:C.amber}}/></div>
              </div>
            )}

            <div style={{display:'flex',gap:6,marginTop:12,flexWrap:'wrap'}}>
              {last7.map(ds=>{ const sched=isHabitScheduled(h,ds); const d=habitDoneOn(h,ds); const isToday=ds===today;
                const wd=HABIT_WD[new Date(ds+'T00:00:00').getDay()];
                return (
                  <div key={ds} onClick={()=> sched && toggleHabitDay(h.id, ds)} title={ds}
                    style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3, cursor:sched?'pointer':'default', opacity:sched?1:0.4}}>
                    <div style={{fontSize:9,color:isToday?C.amber:C.dim}}>{wd}</div>
                    <div style={{width:26,height:26,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,
                      background:d?C.amber:'transparent', border:`1px solid ${d?C.amber:(isToday?C.amber:C.border)}`, color:d?'#1A1200':C.dim}}>{d?'✓':(sched?'':'·')}</div>
                    <div style={{fontSize:9,color:C.dim}}>{ds.slice(8,10)}</div>
                  </div>
                );
              })}
            </div>

            {todayScheduled
              ? <button onClick={()=>toggleHabitDay(h.id, today)}
                  style={{...S.exportBtn, marginTop:12, width:'100%', padding:'10px', background:todayDone?C.panelAlt:C.amber, color:todayDone?C.dim:'#1A1200', borderColor:todayDone?C.border:C.amber, fontWeight:700}}>
                  {todayDone ? '✓ Сегодня выполнено — отменить' : 'Отметить сегодня'}
                </button>
              : <div style={{...S.dimSpan, marginTop:10, marginLeft:0, display:'block'}}>Сегодня не по расписанию</div>}
          </div>
        );
      })}

      {/* Архив привычек — внизу, свёрнут по умолчанию (session 015) */}
      {archive.length>0 && (
        <div style={{marginTop:18}}>
          <div onClick={()=>setArchiveShow(s=>!s)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',userSelect:'none',padding:'6px 2px'}}>
            <span style={{fontSize:12.5,color:C.dim}}>🗄 Архив привычек · {archive.length}</span>
            <span style={{color:C.dim,fontSize:12,transition:'transform .2s ease',transform:archiveShow?'rotate(180deg)':'none'}}>▾</span>
          </div>
          {archiveShow && (
            <div className="anim-collapse" style={{marginTop:8}}>
              {[...archive].reverse().map((h,i)=>(
                <div key={h.id+'_'+h.archivedAt+'_'+i} className="row-hover" style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
                  <div style={{flex:1,minWidth:0,overflowWrap:'anywhere'}}>
                    <div style={{fontSize:13,color:C.text}}>{h.challengeDone?'🎉 ':''}{h.name}</div>
                    <div style={{fontSize:10.5,color:C.dim}}>рекорд 🔥 {h.bestStreak||0} · выполнено {h.completedCount||0}{h.targetDays>0?` / ${h.targetDays}`:''} дн. · архив {h.archivedAt}</div>
                  </div>
                  <button className="icon-btn" title="вернуть в активные" style={{color:C.cyan}} onClick={()=>restoreHabit(h.id, h.archivedAt)}>↩</button>
                  <ConfirmIconBtn onConfirm={()=>deleteArchivedHabit(h.id, h.archivedAt)} title="удалить из архива" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================ Goals
function GoalsTab({goals, addGoal, setGoalProgress, addGoalSubtask, toggleGoalSubtask, deleteGoalSubtask, deleteGoal, setGoalMode, setGoalCounter, archiveGoal, archive, openArchive}){
  const [text,setText] = useState(''); const [scope,setScope] = useState('week');
  const [subtaskInputs,setSubtaskInputs] = useState({});
  const scopes = [{id:'year',label:'Год'},{id:'month',label:'Месяц'},{id:'week',label:'Неделя'},{id:'day',label:'День'}];
  const addFromForm = () => { if(text.trim()){ addGoal(scope,text.trim()); setText(''); } };
  const modeOf = (g) => g.mode ? g.mode : (g.counter?'counter':g.subtasks?'subtasks':'slider'); // legacy: undefined→ползунок

  return (
    <div>
      <div style={S.panel}>
        <div style={S.panelTitle}>Новая цель</div>
        <div style={S.inputRow}>
          <Select style={{minWidth:110}} value={scope} onChange={setScope} options={scopes.map(s=>({value:s.id,label:s.label}))} />
          <input style={S.input} placeholder="Формулировка цели" value={text} onChange={e=>setText(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter') addFromForm(); }} />
          <button style={S.iconBtnAmber} onClick={addFromForm}>+</button>
        </div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))', gap:16}}>
        {scopes.map(({id,label})=>{
          const list = goals[id]||[];
          const avg = list.length? Math.round(list.reduce((s,g)=>s+g.progress,0)/list.length) : 0;
          return (
            <div key={id} style={S.panel}>
              <div style={S.panelTitle}>{label} <span style={S.dimSpan}>{avg}%</span></div>
              {list.length===0 && <div style={S.emptyState}>Целей пока нет</div>}
              {list.map(g=>{ const mode=modeOf(g); const done=(g.progress||0)>=100;
                return (
                <div key={g.id} style={{marginBottom:14, paddingBottom:10, borderBottom:`1px solid ${C.border}`}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
                    <div style={{flex:1,minWidth:0,fontSize:13.5,color:done?C.dim:C.text,textDecoration:done?'line-through':'none',overflowWrap:'anywhere',wordBreak:'break-word'}}>{g.title}</div>
                    <ConfirmIconBtn onConfirm={()=>archiveGoal(id,g.id)} icon="🏁" confirmLabel="в архив?" title="в архив (сохранить)" />
                    <ConfirmIconBtn onConfirm={()=>deleteGoal(id,g.id)} confirmLabel="удалить?" title="удалить безвозвратно" />
                  </div>

                  {mode==='none' && (
                    <div style={{marginTop:6}}>
                      <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                        <input type="checkbox" checked={done} onChange={()=>setGoalProgress(id,g.id,done?0:100)} />
                        <span style={{fontSize:12.5,color:done?C.green:C.dim}}>{done?'✓ Выполнено':'Отметить выполненной'}</span>
                      </label>
                      <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap',alignItems:'center'}}>
                        <span style={{fontSize:10.5,color:C.dim}}>+ трекер:</span>
                        <div className="chip" style={{background:C.panelAlt,color:C.cyan,borderColor:C.border,padding:'4px 10px',fontSize:11}} onClick={()=>setGoalMode(id,g.id,'slider')}>Ползунок</div>
                        <div className="chip" style={{background:C.panelAlt,color:C.cyan,borderColor:C.border,padding:'4px 10px',fontSize:11}} onClick={()=>setGoalMode(id,g.id,'subtasks')}>Шаги</div>
                        <div className="chip" style={{background:C.panelAlt,color:C.amber,borderColor:C.border,padding:'4px 10px',fontSize:11}} onClick={()=>setGoalMode(id,g.id,'counter')}>Счётчик</div>
                      </div>
                    </div>
                  )}

                  {mode==='counter' && g.counter && (
                    <div style={{marginTop:8}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
                        <div style={{display:'flex',alignItems:'center',background:C.panelAlt,border:`1px solid ${C.border}`,borderRadius:8,overflow:'hidden'}}>
                          <button className="cnt-btn" onClick={()=>setGoalCounter(id,g.id,{current:(g.counter.current||0)-1})} style={S.counterBtn} aria-label="минус">−</button>
                          <div style={{fontFamily:"'JetBrains Mono',monospace",minWidth:58,textAlign:'center',display:'flex',alignItems:'baseline',justifyContent:'center',gap:2}}>
                            <span style={{fontSize:14,fontWeight:700,color:done?C.green:C.text}}>{g.counter.current||0}</span>
                            <span style={{color:C.dim,fontSize:12.5,fontWeight:500}}>/ {g.counter.target}</span>
                          </div>
                          <button className="cnt-btn" onClick={()=>setGoalCounter(id,g.id,{current:(g.counter.current||0)+1})} style={S.counterBtn} aria-label="плюс">+</button>
                        </div>
                        <label style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:C.dim}}>цель
                          <input key={g.counter.target} style={{...S.input,fontSize:12,padding:'5px 6px',width:54,minWidth:0,textAlign:'center',flex:'none'}} type="number"
                            defaultValue={g.counter.target} onBlur={e=>setGoalCounter(id,g.id,{target:parseInt(e.target.value,10)||1})} /></label>
                      </div>
                      <div style={{height:5,background:C.panelAlt,borderRadius:3,overflow:'hidden',marginTop:8}}><div style={{height:'100%',background:done?C.green:C.amber,width:`${g.progress||0}%`}}/></div>
                    </div>
                  )}

                  {mode==='subtasks' && (
                    <div style={{marginTop:6}}>
                      {(g.subtasks||[]).map(s=>(
                        <div key={s.id} className="row-hover" style={{display:'flex',alignItems:'center',gap:6,padding:'3px 0'}}>
                          <input type="checkbox" checked={s.done} onChange={()=>toggleGoalSubtask(id,g.id,s.id)} />
                          <div style={{flex:1,minWidth:0,fontSize:12.5,textDecoration:s.done?'line-through':'none',color:s.done?C.dim:C.text,overflowWrap:'anywhere'}}>{s.text}</div>
                          <button className="icon-btn" onClick={()=>deleteGoalSubtask(id,g.id,s.id)}>✕</button>
                        </div>
                      ))}
                      <div style={{display:'flex',gap:6,marginTop:4}}>
                        <input style={{...S.input,fontSize:12,padding:'5px 8px'}} placeholder="+ шаг" value={subtaskInputs[g.id]||''}
                          onChange={e=>setSubtaskInputs({...subtaskInputs,[g.id]:e.target.value})}
                          onKeyDown={e=>{ if(e.key==='Enter' && (subtaskInputs[g.id]||'').trim()){ addGoalSubtask(id,g.id,subtaskInputs[g.id].trim()); setSubtaskInputs({...subtaskInputs,[g.id]:''}); } }} />
                        <button title="добавить шаг" style={{...S.iconBtnAmber,width:30,height:30,fontSize:14}}
                          onClick={()=>{ if((subtaskInputs[g.id]||'').trim()){ addGoalSubtask(id,g.id,subtaskInputs[g.id].trim()); setSubtaskInputs({...subtaskInputs,[g.id]:''}); } }}>✓</button>
                      </div>
                    </div>
                  )}

                  {mode==='slider' && (
                    <div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
                      <input type="range" min="0" max="100" step="5" value={g.progress||0} style={{flex:1,minWidth:0}} onChange={e=>setGoalProgress(id,g.id,parseInt(e.target.value,10))} />
                      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11.5,color:C.dim,minWidth:34,textAlign:'right'}}>{g.progress||0}%</div>
                    </div>
                  )}

                  {mode!=='none' && (
                    <div style={{display:'flex',gap:10,marginTop:6,flexWrap:'wrap'}}>
                      <span style={{fontSize:10.5,color:C.dim,cursor:'pointer'}} onClick={()=>setGoalMode(id,g.id,'none')}>сменить тип</span>
                    </div>
                  )}
                </div>
              );})}
            </div>
          );
        })}
      </div>
      <div style={{display:'flex',justifyContent:'center',marginTop:16}}>
        <span style={{fontSize:12,color:C.dim,cursor:'pointer'}} onClick={openArchive}>🗄 Архив целей{archive&&archive.length?` · ${archive.length}`:''}</span>
      </div>
    </div>
  );
}

// ============================================================ Дела (бывш. Учёба)
// Статус-переключатель с цветами: Не начато (серый) / В процессе (янтарь) / Выполнено (зелёный)
function StatusSeg({value, onChange}){
  return (
    <div style={S.seg}>
      {STUDY_STATUSES.map(s=>{ const active=value===s; const col=STATUS_COLOR[s];
        return <button key={s} onClick={()=>onChange(s)}
          style={{...S.segBtn, background:active?col:'transparent', color:active?(s==='В процессе'?'#1A1200':'#0B0E13'):C.dim}}>{s}</button>; })}
    </div>
  );
}
function StudyTab({study, addStudyTask, updateStudyTask, deleteStudyTask, archiveStudyTask, archive=[], deleteArchivedStudy, restoreStudy}){
  const [epic,setEpic] = useState(''); const [taskText,setTaskText] = useState('');
  const [archiveShow,setArchiveShow] = useState(false);
  const [importance,setImportance] = useState(STUDY_IMPORTANCE[1]); const [urgency,setUrgency] = useState(STUDY_URGENCY[1]);
  const [deadline,setDeadline] = useState('');
  const [filterStatus,setFilterStatus] = useState('Все'); const [sortBy,setSortBy] = useState('createdAt');
  const [collapsed,setCollapsed] = useState({});

  const submit = () => { if(!taskText.trim()) return;
    addStudyTask({epic:epic.trim()||'Входящие', task:taskText.trim(), status:'Не начато', importance, urgency, deadline:deadline||undefined, note:''});
    setTaskText(''); setDeadline(''); };
  const customEpics = [...new Set(study.map(s=>s.epic))].filter(e=>!BASE_EPICS.includes(e));
  const epicOptions = [...BASE_EPICS, ...customEpics];

  const grouped = useMemo(()=>{
    const filtered = study.filter(s=>filterStatus==='Все'||s.status===filterStatus).slice().sort((a,b)=>{
      if(sortBy==='createdAt') return a.createdAt>b.createdAt?-1:1;
      if(sortBy==='importance') return STUDY_IMPORTANCE.indexOf(b.importance)-STUDY_IMPORTANCE.indexOf(a.importance);
      if(sortBy==='urgency') return STUDY_URGENCY.indexOf(b.urgency)-STUDY_URGENCY.indexOf(a.urgency);
      if(sortBy==='deadline') return (a.deadline||'9999')>(b.deadline||'9999')?1:-1;
      return 0;
    });
    // порядок эпиков: базовые вперёд, затем остальные
    const map={}; filtered.forEach(s=>{ (map[s.epic]=map[s.epic]||[]).push(s); });
    const ordered={}; [...BASE_EPICS, ...Object.keys(map).filter(e=>!BASE_EPICS.includes(e))].forEach(e=>{ if(map[e]) ordered[e]=map[e]; });
    return ordered;
  }, [study, filterStatus, sortBy]);
  const today = todayStr();

  return (
    <div>
      <div style={S.panel}>
        <div style={S.panelTitle}>Новое дело</div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
          {epicOptions.map(e=><div key={e} className="chip" onClick={()=>setEpic(e)}
            style={{background:epic===e?C.amber:C.panelAlt,color:epic===e?'#1A1200':C.dim,borderColor:epic===e?C.amber:C.border}}>{e}</div>)}
        </div>
        <div style={S.inputRow}>
          <input style={{...S.input,maxWidth:150}} placeholder="Категория/эпик" value={epic} onChange={e=>setEpic(e.target.value)} />
          <input style={S.input} placeholder="Что нужно сделать" value={taskText} onChange={e=>setTaskText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />
          <button style={S.iconBtnAmber} onClick={submit}>+</button>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8,alignItems:'center'}}>
          <div style={{minWidth:150}}><div style={{fontSize:10.5,color:C.dim,marginBottom:3}}>Важность</div>
            <Select small value={importance} onChange={setImportance} options={STUDY_IMPORTANCE.map(v=>({value:v,label:v,dotColor:IMPORTANCE_COLOR[v]}))} /></div>
          <div style={{minWidth:150}}><div style={{fontSize:10.5,color:C.dim,marginBottom:3}}>Срочность</div>
            <Select small value={urgency} onChange={setUrgency} options={STUDY_URGENCY.map(v=>({value:v,label:v,dotColor:URGENCY_COLOR[v]}))} /></div>
          <div><div style={{fontSize:10.5,color:C.dim,marginBottom:3}}>Дедлайн</div>
            <input style={{...S.input,maxWidth:150}} type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} onClick={openDatePicker} /></div>
        </div>
      </div>
      <div style={{display:'flex',gap:10,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {['Все',...STUDY_STATUSES].map(s=><div key={s} className="chip" onClick={()=>setFilterStatus(s)} style={{background:filterStatus===s?C.amber:C.panelAlt,color:filterStatus===s?'#1A1200':C.dim,borderColor:filterStatus===s?C.amber:C.border}}>{s}</div>)}
        </div>
        <Select small style={{minWidth:150}} value={sortBy} onChange={setSortBy} options={[
          {value:'createdAt',label:'по дате'},{value:'importance',label:'по важности'},{value:'urgency',label:'по срочности'},{value:'deadline',label:'по дедлайну'}]} />
      </div>
      {Object.keys(grouped).length===0 && <div style={{...S.panel,...S.emptyState}}>Дел пока нет</div>}
      {Object.entries(grouped).map(([epicName,tasks])=>{
        const isC = collapsed[epicName]; const doneCount = tasks.filter(t=>t.status==='Выполнено').length;
        return (
          <div key={epicName} style={S.panel}>
            <div style={{...S.panelTitle,cursor:'pointer',display:'flex',alignItems:'center',marginBottom:isC?0:10}} onClick={()=>setCollapsed({...collapsed,[epicName]:!isC})}>
              <span style={{marginRight:6}}>{isC?'▶':'▼'}</span>{epicName}<span style={S.dimSpan}>{doneCount}/{tasks.length}</span>
            </div>
            {!isC && tasks.map(t=>{
              const done = t.status==='Выполнено';
              const overdue = t.deadline && !done && t.deadline < today;
              const dueSoon = t.deadline && !done && !overdue && t.deadline <= addDays(today,2);
              return (
              <div key={t.id} className="row-hover" style={{...S.taskRow,flexWrap:'wrap',alignItems:'flex-start'}}>
                <div style={{display:'flex',gap:4,paddingTop:4}}>
                  <div style={{width:8,height:8,borderRadius:4,background:IMPORTANCE_COLOR[t.importance]||C.dim}} title={`Важность: ${t.importance||'—'}`}/>
                  <div style={{width:8,height:8,borderRadius:4,background:URGENCY_COLOR[t.urgency]||C.dim}} title={`Срочность: ${t.urgency||'—'}`}/>
                </div>
                <div style={{flex:1,minWidth:160,fontSize:13.5,color:done?C.dim:C.text,textDecoration:done?'line-through':'none'}}>
                  {t.task}
                  <div style={{fontSize:11,color:C.dim,marginTop:3,display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                    {t.importance && <span>{t.importance}</span>}
                    {t.urgency && <span style={{color:URGENCY_COLOR[t.urgency]}}>{t.urgency}</span>}
                    {t.deadline && <span style={{color:overdue?C.red:dueSoon?C.amber:C.dim,fontWeight:overdue?700:400}}>
                      ⏰ {t.deadline}{overdue?' · просрочено':''}</span>}
                  </div>
                </div>
                <StatusSeg value={t.status} onChange={v=>updateStudyTask(t.id,{status:v})} />
                <ConfirmIconBtn onConfirm={()=>archiveStudyTask(t.id)} icon="🏁" confirmLabel="в архив?" title="в архив (сохранить)" />
                <ConfirmIconBtn onConfirm={()=>deleteStudyTask(t.id)} confirmLabel="удалить?" title="удалить безвозвратно" />
              </div>
            );})}
          </div>
        );
      })}

      {/* Архив дел — внизу, свёрнут по умолчанию (session 016) */}
      {archive.length>0 && (
        <div style={{marginTop:6}}>
          <div onClick={()=>setArchiveShow(s=>!s)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',userSelect:'none',padding:'6px 2px'}}>
            <span style={{fontSize:12.5,color:C.dim}}>🗄 Архив дел · {archive.length}</span>
            <span style={{color:C.dim,fontSize:12,transition:'transform .2s ease',transform:archiveShow?'rotate(180deg)':'none'}}>▾</span>
          </div>
          {archiveShow && (
            <div className="anim-collapse" style={{marginTop:8}}>
              {[...archive].reverse().map((s,i)=>(
                <div key={s.id+'_'+s.archivedAt+'_'+i} className="row-hover" style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
                  <div style={{flex:1,minWidth:0,overflowWrap:'anywhere'}}>
                    <div style={{fontSize:13,color:s.status==='Выполнено'?C.green:C.text}}>{s.status==='Выполнено'?'✓ ':''}{s.task}</div>
                    <div style={{fontSize:10.5,color:C.dim}}>{s.epic||'—'} · {s.status||'—'}{s.deadline?` · ⏰ ${s.deadline}`:''} · архив {s.archivedAt}</div>
                  </div>
                  <button className="icon-btn" title="вернуть в активные" style={{color:C.cyan}} onClick={()=>restoreStudy(s.id, s.archivedAt)}>↩</button>
                  <ConfirmIconBtn onConfirm={()=>deleteArchivedStudy(s.id, s.archivedAt)} title="удалить из архива" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================ Notes
const NOTE_TYPE_COLOR = {'Напоминание':C.amber,'Заметка':C.cyan};
const noteTitleOf = (n) => (n.title && n.title.trim()) || (n.body||'').split('\n')[0].slice(0,60) || 'Без названия';
const notePreviewOf = (n) => { const body=n.body||''; const firstLine=(n.title&&n.title.trim())?body:body.split('\n').slice(1).join(' '); return firstLine.trim().slice(0,120); };
const repeatLabel = (id) => (NOTE_REPEATS.find(r=>r.id===id)||{}).label || '';
// человекочитаемое «когда» для карточки напоминания
const reminderWhenLabel = (n) => {
  const t = n.remindTime ? ` ${n.remindTime}` : '';
  if(n.repeat==='daily')   return `каждый день${t}`;
  if(n.repeat==='weekly')  return `кажд. ${weekdayLabel(n.remindWeekday!=null?n.remindWeekday:(n.remindDate?new Date(n.remindDate+'T00:00:00').getDay():''))}${t}`;
  if(n.repeat==='monthly') return `${(n.remindDay!=null?n.remindDay:(n.remindDate?new Date(n.remindDate+'T00:00:00').getDate():''))} числа${t}`;
  return n.remindDate ? `${n.remindDate}${t}` : '';
};
const hasReminderWhen = (n) => n.type==='Напоминание' && (n.remindDate || n.repeat==='daily' || (n.repeat==='weekly'&&n.remindWeekday!=null) || (n.repeat==='monthly'&&n.remindDay!=null));

// Полноэкранный редактор заметки/напоминания
function NoteEditor({note, onSave, onDelete, onClose}){
  const [title,setTitle] = useState(note.title||'');
  const [body,setBody] = useState(note.body||'');
  const [type,setType] = useState(note.type||'Заметка');
  const [remindDate,setRemindDate] = useState(note.remindDate||'');
  const [remindTime,setRemindTime] = useState(note.remindTime||'');
  const [repeat,setRepeat] = useState(note.repeat||'none');
  const [remindWeekday,setRemindWeekday] = useState(note.remindWeekday!=null?String(note.remindWeekday):'');
  const [remindDay,setRemindDay] = useState(note.remindDay!=null?String(note.remindDay):'');
  const [pinned,setPinned] = useState(!!note.pinned);
  const [checklist,setChecklist] = useState(Array.isArray(note.checklist)?note.checklist:[]);
  const [newItem,setNewItem] = useState('');
  const isRem = type==='Напоминание';
  const addItem = () => { if(!newItem.trim()) return; setChecklist([...checklist,{id:uid(),text:newItem.trim(),done:false}]); setNewItem(''); };
  const toggleItem = (id) => setChecklist(checklist.map(i=>i.id===id?{...i,done:!i.done}:i));
  const delItem = (id) => setChecklist(checklist.filter(i=>i.id!==id));
  const save = () => { const rep = isRem?repeat:undefined; onSave({title:title.trim(), body, type, pinned, checklist,
    remindTime: isRem?(remindTime||undefined):undefined,
    repeat: rep,
    remindDate: (isRem && rep==='none')?(remindDate||undefined):undefined,
    remindWeekday: (isRem && rep==='weekly' && remindWeekday!=='')?Number(remindWeekday):undefined,
    remindDay: (isRem && rep==='monthly' && remindDay!=='')?Number(remindDay):undefined,
  }); onClose(); };
  return (
    <Modal onClose={onClose} title={note.id?'Редактировать':'Новая запись'}>
      <div style={{display:'flex',gap:6,marginBottom:12,alignItems:'center'}}>
        {NOTE_TYPES.map(t=><div key={t} className="chip" onClick={()=>setType(t)}
          style={{background:type===t?NOTE_TYPE_COLOR[t]:C.panelAlt,color:type===t?'#0B0E13':C.dim,borderColor:type===t?NOTE_TYPE_COLOR[t]:C.border}}>{t}</div>)}
        <div className="chip" onClick={()=>setPinned(p=>!p)} title="закрепить наверху"
          style={{background:pinned?C.amber:C.panelAlt,color:pinned?'#1A1200':C.dim,borderColor:pinned?C.amber:C.border,marginLeft:'auto'}}>📌 {pinned?'закреплено':'закрепить'}</div>
      </div>
      <input style={{...S.input,width:'100%',fontSize:16,fontWeight:600,marginBottom:10}} placeholder="Заголовок" value={title} onChange={e=>setTitle(e.target.value)} autoFocus />
      <textarea style={{...S.textarea,minHeight:160,fontSize:14,lineHeight:1.5}} placeholder="Текст заметки…" value={body} onChange={e=>setBody(e.target.value)} />
      <div style={{marginTop:12,padding:12,background:C.panelAlt,borderRadius:8,border:`1px solid ${C.border}`}}>
        <div style={{fontSize:12,color:C.cyan,marginBottom:8}}>☑ Чек-лист{checklist.length?` · ${checklist.filter(i=>i.done).length}/${checklist.length}`:''}</div>
        {checklist.map(i=>(
          <div key={i.id} className="row-hover" style={{display:'flex',alignItems:'center',gap:8,padding:'3px 0'}}>
            <input type="checkbox" checked={i.done} onChange={()=>toggleItem(i.id)} />
            <div style={{flex:1,minWidth:0,fontSize:13,overflowWrap:'anywhere',textDecoration:i.done?'line-through':'none',color:i.done?C.dim:C.text}}>{i.text}</div>
            <button className="icon-btn" onClick={()=>delItem(i.id)}>✕</button>
          </div>
        ))}
        <div style={{display:'flex',gap:6,marginTop:6}}>
          <input style={{...S.input,fontSize:12,padding:'5px 8px'}} placeholder="+ пункт" value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') addItem(); }} />
          <button style={{...S.iconBtnAmber,width:30,height:30,fontSize:14}} title="добавить пункт" onClick={addItem}>✓</button>
        </div>
      </div>
      {type==='Напоминание' && (
        <div style={{marginTop:12,padding:12,background:C.panelAlt,borderRadius:8,border:`1px solid ${C.border}`}}>
          <div style={{fontSize:12,color:C.amber,marginBottom:8}}>⏰ Когда напомнить</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <Select small style={{minWidth:150}} value={repeat} onChange={setRepeat} options={NOTE_REPEATS.map(r=>({value:r.id,label:r.label}))} />
            {repeat==='none' && <input style={{...S.input,maxWidth:150}} type="date" value={remindDate} onChange={e=>setRemindDate(e.target.value)} onClick={openDatePicker} />}
            {repeat==='weekly' && <Select small style={{minWidth:120}} value={remindWeekday} onChange={setRemindWeekday} placeholder="день недели" options={WEEKDAY_OPTS} />}
            {repeat==='monthly' && <Select small style={{minWidth:110}} value={remindDay} onChange={setRemindDay} placeholder="число" options={Array.from({length:31},(_,i)=>({value:String(i+1),label:String(i+1)}))} />}
            <input style={{...S.input,maxWidth:120}} type="time" value={remindTime} onChange={e=>setRemindTime(e.target.value)} />
          </div>
          <div style={{fontSize:11,color:C.dim,marginTop:8}}>Придёт уведомлением на телефоне. {repeat==='daily'?'Каждый день в это время.':repeat==='weekly'?'Каждую неделю в выбранный день.':repeat==='monthly'?'Каждый месяц в выбранное число.':'Один раз в указанную дату.'}</div>
        </div>
      )}
      <div style={{display:'flex',gap:8,marginTop:16,justifyContent:'space-between'}}>
        {note.id ? <button style={{...S.exportBtn,borderColor:C.red,color:C.red}} onClick={()=>{ onDelete(note.id); onClose(); }}>Удалить</button> : <span/>}
        <button style={{...S.iconBtnAmber,width:'auto',padding:'0 24px',height:38,fontWeight:700}} onClick={save}>Сохранить</button>
      </div>
    </Modal>
  );
}

function NotesTab({notes, addNote, updateNote, deleteNote}){
  const [filter,setFilter] = useState('Все');
  const [editing,setEditing] = useState(null); // note object, or null; {} = new
  const filtered = notes.filter(n=>filter==='Все'||n.type===filter)
    .sort((a,b)=> (b.pinned?1:0)-(a.pinned?1:0) || (((b.updatedAt||b.createdAt||'')>(a.updatedAt||a.createdAt||''))?1:-1)); // закреплённые вверх
  const today = todayStr();
  const openNew = () => setEditing({});
  const handleSave = (patch) => { if(editing && editing.id) updateNote(editing.id, patch); else addNote(patch); };
  return (
    <div>
      <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {['Все',...NOTE_TYPES].map(t=><div key={t} className="chip" onClick={()=>setFilter(t)} style={{background:filter===t?C.amber:C.panelAlt,color:filter===t?'#1A1200':C.dim,borderColor:filter===t?C.amber:C.border}}>{t}</div>)}
        </div>
        <button style={{...S.iconBtnAmber,width:'auto',padding:'0 16px',height:38,fontWeight:700}} onClick={openNew}>＋ Новая</button>
      </div>
      {filtered.length===0 && <div style={{...S.panel,...S.emptyState}}>Записей нет. Нажми «＋ Новая».</div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
        {filtered.map(n=>{
          const col=NOTE_TYPE_COLOR[n.type]||C.cyan;
          const oneShot = n.type==='Напоминание' && (!n.repeat || n.repeat==='none') && n.remindDate;
          const overdue = oneShot && n.remindDate < today;
          const soon = oneShot && !overdue && n.remindDate <= addDays(today,1);
          return (
            <div key={n.id} onClick={()=>setEditing(n)} style={{...S.panel,marginBottom:0,cursor:'pointer',borderLeft:`3px solid ${col}`,...(n.pinned?{borderTop:`1px solid ${C.amber}`,borderRight:`1px solid ${C.amber}`,borderBottom:`1px solid ${C.amber}`}:{}),display:'flex',flexDirection:'column',gap:6,minHeight:110}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:6}}>
                <span style={{fontSize:10,color:col,letterSpacing:'.05em'}}>{n.pinned?'📌 ':''}{n.type==='Напоминание'?'⏰ НАПОМИНАНИЕ':'ЗАМЕТКА'}</span>
                <div style={{display:'flex',alignItems:'center',gap:2}}>
                  <button className="icon-btn" title={n.pinned?'открепить':'закрепить'} style={n.pinned?{color:C.amber}:undefined} onClick={e=>{ e.stopPropagation(); updateNote(n.id,{pinned:!n.pinned}); }}>📌</button>
                  <button className="icon-btn" onClick={e=>{ e.stopPropagation(); deleteNote(n.id); }}>✕</button>
                </div>
              </div>
              <div style={{fontSize:14,fontWeight:600,color:C.text}}>{noteTitleOf(n)}</div>
              {notePreviewOf(n) && <div style={{fontSize:12,color:C.dim,flex:1,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical'}}>{notePreviewOf(n)}</div>}
              {Array.isArray(n.checklist) && n.checklist.length>0 && (
                <div style={{fontSize:11,color:n.checklist.every(i=>i.done)?C.green:C.dim}}>☑ {n.checklist.filter(i=>i.done).length}/{n.checklist.length}</div>
              )}
              {hasReminderWhen(n) ? (
                <div style={{fontSize:11,color:overdue?C.red:soon?C.amber:C.dim,fontWeight:overdue?700:400}}>
                  ⏰ {reminderWhenLabel(n)}{overdue?' · прошло':''}
                </div>
              ) : <div style={{fontSize:10.5,color:C.dim}}>{n.updatedAt||n.createdAt}</div>}
            </div>
          );
        })}
      </div>
      {editing && <NoteEditor note={editing} onSave={handleSave} onDelete={deleteNote} onClose={()=>setEditing(null)} />}
    </div>
  );
}

// ============================================================ Finance
function FinanceTab(props){
  const {finance, categories, budgets, bills, finMask={}, setSettingFlag} = props;
  const mo = n => maskMoney(finMask.ops, n);   // операции/доходы-расходы
  const [sub,setSub] = useState('ops');
  const netWorth = useMemo(()=> finance.accounts.reduce((sum,a)=> sum + accountBalanceNow(a, finance.transactions), 0) + unassignedNetOn(finance.transactions, todayStr()), [finance.accounts, finance.transactions]);
  const today = todayStr();
  const monthTx = useMemo(()=> finance.transactions.filter(t=>t.date.slice(0,7)===today.slice(0,7)), [finance.transactions]);
  const monthIncome = monthTx.filter(t=>t.type==='income'&&!t.exclude).reduce((s,t)=>s+t.amount,0);
  const monthExpense = monthTx.filter(t=>t.type==='expense'&&!t.exclude).reduce((s,t)=>s+t.amount,0);

  return (
    <div>
      <div className="grid3" style={S.grid3}>
        <div style={S.statCard}><div style={S.statVal}>{mo(monthIncome)}</div><div style={S.dimSpan}>доход · месяц</div></div>
        <div style={S.statCard}><div style={S.statVal}>{mo(monthExpense)}</div><div style={S.dimSpan}>расход · месяц</div></div>
        <div style={S.statCard}><div style={S.statVal}>{maskMoney(finMask.net, netWorth)}</div><div style={S.dimSpan}>чистые активы</div></div>
      </div>
      <div style={{display:'flex',gap:6,marginTop:20,marginBottom:14,flexWrap:'wrap'}}>
        {[{id:'ops',label:'Операции'},{id:'assets',label:'Активы'},{id:'debtors',label:'Должники'}].map(({id,label})=>(
          <div key={id} className="chip" onClick={()=>setSub(id)} style={{background:sub===id?C.amber:C.panelAlt,color:sub===id?'#1A1200':C.dim,borderColor:sub===id?C.amber:C.border}}>{label}</div>
        ))}
      </div>
      {sub==='ops' && <OpsSection {...props} monthTx={monthTx} />}
      {sub==='assets' && <AssetsSection accounts={finance.accounts} transactions={finance.transactions} finMask={finMask} addAccount={props.addAccount} deleteAccount={props.deleteAccount} addSnapshot={props.addSnapshot} deleteSnapshot={props.deleteSnapshot} />}
      {sub==='debtors' && <DebtorsSection debtors={finance.debtors} mask={finMask.debts} addDebtor={props.addDebtor} updateDebtor={props.updateDebtor} deleteDebtor={props.deleteDebtor} />}
    </div>
  );
}

// Панель планов (расходы/доходы): все категории редактируются сразу, одна кнопка «Сохранить планы»,
// прогресс-бары по установленным планам + итоговая сумма. Черновик сбрасывается при смене месяца (resetKey).
function PlanPanel({title, open, setOpen, planSwitcher, kindToggle, categories, actualByCat, plans, onSaveBatch, onRemove, barColor, spentWord, resetKey}){
  const [draft,setDraft] = useState({});
  useEffect(()=>{ setDraft({}); }, [resetKey]);
  const valOf = (c) => draft[c]!==undefined ? draft[c] : (plans[c]!=null ? String(plans[c]) : '');
  const planNum = (c) => { const raw = draft[c]!==undefined ? parseFloat(draft[c]) : plans[c]; return isNaN(raw)||raw==null ? 0 : raw; };
  const totalPlan = categories.reduce((s,c)=>s+planNum(c),0);
  const totalSpent = categories.reduce((s,c)=>s+(actualByCat[c]||0),0);
  const dirty = Object.keys(draft).length>0;
  const save = () => { const patch={}; Object.entries(draft).forEach(([c,v])=>{ const n=parseFloat(v); if(!isNaN(n)&&n>0) patch[c]=n; }); if(Object.keys(patch).length) onSaveBatch(patch); setDraft({}); };
  return (
    <div style={S.panel}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:open?12:0,gap:8,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}} onClick={()=>setOpen(o=>!o)}>
          <span style={{color:C.dim,fontSize:11,transform:open?'none':'rotate(-90deg)',transition:'transform .12s'}}>▾</span>
          <div style={{...S.panelTitle,marginBottom:0}}>{title}</div>
          {kindToggle}
        </div>
        {open && planSwitcher}
      </div>
      {open && (<>
        {categories.map(c=>{ const spent=actualByCat[c]||0; const plan=plans[c]; const pn=planNum(c);
          return (
            <div key={c} style={{marginBottom:10}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8,alignItems:'center'}}>
                <span style={{fontSize:12.5,overflowWrap:'anywhere',minWidth:0}}>{c}</span>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:11.5,color:C.dim,fontFamily:"'JetBrains Mono',monospace",minWidth:58,textAlign:'right'}}>{mo(spent)}</span>
                  <span style={{color:C.dim}}>/</span>
                  <input style={{...S.input,fontSize:12.5,padding:'7px 9px',width:120,minWidth:0,flex:'none'}} type="number" placeholder="план ₽"
                    value={valOf(c)} onChange={e=>setDraft({...draft,[c]:e.target.value})} onKeyDown={e=>e.key==='Enter'&&save()} />
                  {plan!=null ? <button className="icon-btn" title="сбросить план" onClick={()=>onRemove(c)}>✕</button> : <span style={{width:20}}/>}
                </div>
              </div>
              {pn>0 && (
                <div style={{height:4,background:C.panelAlt,borderRadius:2,overflow:'hidden',marginTop:5}}>
                  <div style={{height:'100%',width:`${Math.min(100,spent/pn*100)}%`,background: spent>pn?C.red : spent/pn>0.7?C.amber:barColor}}/>
                </div>
              )}
            </div>
          );
        })}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginTop:14,flexWrap:'wrap',borderTop:`1px solid ${C.border}`,paddingTop:12}}>
          <div style={{fontSize:12,color:C.dim}}>Итого план: <b style={{color:C.text}}>{mo(totalPlan)}</b> · {spentWord} {mo(totalSpent)}</div>
          <button style={{...S.iconBtnAmber,width:'auto',padding:'0 18px',height:36,fontWeight:700,opacity:dirty?1:0.55}} onClick={save}>Сохранить планы</button>
        </div>
      </>)}
    </div>
  );
}

function OpsSection({finance, categories, budgets, incomePlans, bills, monthTx, defaults={}, finMask={}, addTransaction, deleteTransaction, addCategory, removeCategory, setBudget, removeBudget, setIncomePlan, removeIncomePlan, setBudgetsBatch, setIncomePlansBatch, addBill, deleteBill}){
  const mo = n => maskMoney(finMask.ops, n);   // приватность: скрытие сумм операций
  const [planOpen,setPlanOpen] = useState(false);
  const [planKind,setPlanKind] = useState('expense'); // переключатель внутри плашки планов (session 020)
  // категория по умолчанию: из настроек, если валидна, иначе первая в списке
  const defExpenseCat = categories.expense.includes(defaults.expenseCat) ? defaults.expenseCat : categories.expense[0];
  const defIncomeCat = categories.income.includes(defaults.incomeCat) ? defaults.incomeCat : categories.income[0];
  const defAccount = finance.accounts.some(a=>a.id===defaults.account) ? defaults.account : '';
  const [txAmount,setTxAmount] = useState(''); const [txType,setTxType] = useState('expense');
  const [txCat,setTxCat] = useState(defExpenseCat); const [txNote,setTxNote] = useState('');
  const [txDate,setTxDate] = useState(todayStr()); const [txExclude,setTxExclude] = useState(false);
  const [txAccountId,setTxAccountId] = useState(defAccount);
  const [newCat,setNewCat] = useState(''); const [showCatManager,setShowCatManager] = useState(false);
  const [catKind,setCatKind] = useState('expense');
  const [billName,setBillName] = useState(''); const [billAmount,setBillAmount] = useState(''); const [billDay,setBillDay] = useState('');
  const cats = txType==='expense' ? categories.expense : categories.income;
  const managedCats = catKind==='expense' ? categories.expense : categories.income;
  const accountName = (id) => finance.accounts.find(a=>a.id===id)?.name;

  const submit = () => { const amount=parseFloat(txAmount); if(isNaN(amount)||amount<=0) return;
    addTransaction({type:txType, amount, category:txCat, note:txNote.trim(), exclude:txExclude, date:txDate, accountId:txAccountId||null});
    setTxAmount(''); setTxNote(''); setTxExclude(false); };

  const expenseByCat = useMemo(()=>{ const map={}; monthTx.filter(t=>t.type==='expense'&&!t.exclude).forEach(t=>{ map[t.category]=(map[t.category]||0)+t.amount; }); return map; }, [monthTx]);
  const expenseCountByCat = useMemo(()=>{ const m={}; monthTx.filter(t=>t.type==='expense'&&!t.exclude).forEach(t=>{ m[t.category]=(m[t.category]||0)+1; }); return m; }, [monthTx]);
  const pieData = { labels:Object.keys(expenseByCat), datasets:[{data:Object.values(expenseByCat), backgroundColor:PIE_COLORS}] };
  const incomeByCat = useMemo(()=>{ const map={}; monthTx.filter(t=>t.type==='income'&&!t.exclude).forEach(t=>{ map[t.category]=(map[t.category]||0)+t.amount; }); return map; }, [monthTx]);
  const incomePieData = { labels:Object.keys(incomeByCat), datasets:[{data:Object.values(incomeByCat), backgroundColor:PIE_COLORS}] };

  // помесячные планы: выбранный месяц + факт по нему (можно листать историю)
  const [planMonth,setPlanMonth] = useState(todayStr().slice(0,7));
  const planTx = useMemo(()=> finance.transactions.filter(t=>t.date.slice(0,7)===planMonth && !t.exclude), [finance.transactions, planMonth]);
  const planExpenseByCat = useMemo(()=>{ const m={}; planTx.filter(t=>t.type==='expense').forEach(t=>{ m[t.category]=(m[t.category]||0)+t.amount; }); return m; }, [planTx]);
  const planIncomeByCat  = useMemo(()=>{ const m={}; planTx.filter(t=>t.type==='income').forEach(t=>{ m[t.category]=(m[t.category]||0)+t.amount; }); return m; }, [planTx]);
  const monthBudgets = budgets[planMonth]||{};
  const monthIncomePlans = incomePlans[planMonth]||{};
  const planSwitcher = (
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <button style={S.navArrow} onClick={()=>setPlanMonth(shiftMonth(planMonth,-1))}>◀</button>
      <span style={{fontSize:12,color:C.dim,minWidth:120,textAlign:'center',textTransform:'capitalize'}}>{monthLabelRu(planMonth)}</span>
      <button style={S.navArrow} onClick={()=>setPlanMonth(shiftMonth(planMonth,1))} disabled={planMonth>=todayStr().slice(0,7)} title="следующий месяц">▶</button>
    </div>
  );

  // бюджет-алерты + прогноз к концу месяца (текущий месяц). session 015; уточнено 016/017.
  // Прогноз = run-rate: факт/деньМесяца*днейВМесяце — честен ТОЛЬКО для частых трат.
  //   Для категорий с ≤5 операциями (разовые: транспорт-абонемент, аренда) НЕ экстраполируем (sparse). [user, 017]
  // Алерт показываем ТОЛЬКО если ФАКТ по категории ≥25% всех планируемых расходов месяца —
  //   т.е. категория реально «весит» в бюджете. Мелкая трата (транспорт 2к из 30к плана) на 100%
  //   своего плана — бесполезный шум, не показываем. Фильтр по ФАКТУ, не по плану. [user, 017]
  const MIN_TX_FOR_FORECAST = 6;      // >5 операций → строим прогноз
  const MIN_SHARE_FOR_ALERT = 0.25;   // факт категории ≥25% от общих планируемых расходов
  const budgetAlerts = useMemo(()=>{
    const cur = todayStr().slice(0,7);
    const b = budgets[cur]||{};
    const totalPlan = Object.values(b).reduce((s,v)=>s+(v>0?v:0),0);
    if(totalPlan<=0) return [];
    const [Y,M,D] = todayStr().split('-').map(Number);
    const daysInMonth = new Date(Y, M, 0).getDate();  // M 1-based → последний день месяца M
    const rows=[];
    Object.keys(b).forEach(c=>{ const plan=b[c]; if(!plan||plan<=0) return;
      const spent=expenseByCat[c]||0;
      if(spent/totalPlan < MIN_SHARE_FOR_ALERT) return;   // факт мелкий на фоне бюджета — не шумим
      const ratio=spent/plan; const cnt=expenseCountByCat[c]||0;
      const sparse = cnt < MIN_TX_FOR_FORECAST;
      const projected = (sparse || D<=0) ? spent : Math.round(spent/D*daysInMonth);
      if(ratio>=0.8) rows.push({cat:c, spent, plan, ratio, projected, over:spent>plan, sparse, cnt});
    });
    return rows.sort((a,b)=>b.ratio-a.ratio);
  }, [budgets, expenseByCat, expenseCountByCat]);

  // расходы по каждому дню (гистограмма, НЕ накопительно) за 30 дней. session 015.
  const dailyExpense = useMemo(()=>{
    const byDate={};
    finance.transactions.forEach(t=>{ if(!t.exclude && t.type==='expense') byDate[t.date]=(byDate[t.date]||0)+t.amount; });
    const labels=[], data=[];
    for(let i=29;i>=0;i--){ const ds=daysAgoStr(i); labels.push(ds.slice(5)); data.push(byDate[ds]||0); }
    return {labels, data};
  }, [finance.transactions]);

  return (
    <div>
      <div style={S.panel}>
        <div style={S.panelTitle}>Новая операция</div>
        <div style={S.inputRow}>
          <Select style={{minWidth:110}} value={txType} onChange={v=>{ setTxType(v); setTxCat(v==='expense'?defExpenseCat:defIncomeCat); }}
            options={[{value:'expense',label:'Расход'},{value:'income',label:'Доход'}]} />
          <input style={{...S.input,maxWidth:100}} type="number" placeholder="сумма" value={txAmount} onChange={e=>setTxAmount(e.target.value)} />
          <Select style={{minWidth:130,flex:1}} value={txCat} onChange={setTxCat} options={cats} />
          <Select style={{minWidth:130,flex:1}} value={txAccountId} onChange={setTxAccountId}
            options={[{value:'',label:'— без счёта —'}, ...finance.accounts.map(a=>({value:a.id,label:a.name}))]} />
          <input style={{...S.input,maxWidth:130}} type="date" value={txDate} onChange={e=>setTxDate(e.target.value)} onClick={openDatePicker} />
          <input style={S.input} placeholder="комментарий" value={txNote} onChange={e=>setTxNote(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />
          <label style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:C.dim,whiteSpace:'nowrap'}}><input type="checkbox" checked={txExclude} onChange={e=>setTxExclude(e.target.checked)} />не считать</label>
          <button style={S.iconBtnAmber} onClick={submit}>+</button>
        </div>
        <div style={{marginTop:8}}>
          <span style={{fontSize:11.5,color:C.cyan,cursor:'pointer'}} onClick={()=>setShowCatManager(!showCatManager)}>{showCatManager?'скрыть категории':'управление категориями'}</span>
        </div>
        {showCatManager && (
          <div style={{marginTop:10}}>
            <div style={{display:'flex',gap:6,marginBottom:8}}>
              {[{id:'expense',label:'Расходы'},{id:'income',label:'Доходы'}].map(({id,label})=>(
                <div key={id} className="chip" onClick={()=>setCatKind(id)} style={{background:catKind===id?C.amber:C.panelAlt,color:catKind===id?'#1A1200':C.dim,borderColor:catKind===id?C.amber:C.border}}>{label}</div>
              ))}
            </div>
            <div style={S.inputRow}>
              <input style={S.input} placeholder="новая категория" value={newCat} onChange={e=>setNewCat(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'&&newCat.trim()){ addCategory(catKind,newCat.trim()); setNewCat(''); } }} />
              <button style={S.iconBtnAmber} onClick={()=>{ if(newCat.trim()){ addCategory(catKind,newCat.trim()); setNewCat(''); } }}>+</button>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:8}}>
              {managedCats.map(c=>(
                <div key={c} className="chip" style={{background:C.panelAlt,color:C.dim,borderColor:C.border,display:'flex',gap:6,alignItems:'center'}}>
                  {c}
                  <span style={{cursor:'pointer'}} onClick={()=>removeCategory(catKind,c)}>✕</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {vis('ops.budgetAlerts') && budgetAlerts.length>0 && (
        <div style={{...S.panel, borderColor:C.amber}}>
          <div style={{...S.panelTitle, color:C.amber}}>⚠ Бюджет-алерты · {todayStr().slice(0,7)}</div>
          {budgetAlerts.map(a=>(
            <div key={a.cat} style={{marginBottom:9}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12.5,marginBottom:3,gap:8}}>
                <span style={{minWidth:0,overflowWrap:'anywhere'}}>{a.over?'🔴':'🟡'} {a.cat}</span>
                <span style={{color:C.dim,fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>{mo(a.spent)} / {mo(a.plan)} · {Math.round(a.ratio*100)}%</span>
              </div>
              <div style={{height:4,background:C.panelAlt,borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,a.ratio*100)}%`,background:a.over?C.red:C.amber}}/></div>
              <div style={{fontSize:10.5,color:(!a.sparse && a.projected>a.plan)?C.red:C.dim,marginTop:3}}>
                {a.sparse
                  ? `прогноз: ${mo(a.projected)} — разовые траты (${a.cnt} оп.), без экстраполяции`
                  : `прогноз к концу месяца: ${mo(a.projected)}${a.projected>a.plan?` · превышение на ${mo(a.projected-a.plan)}`:''}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {(() => {
        // Единая плашка планов с переключателем Расходы/Доходы прямо в заголовке (session 020).
        // Больше НЕ зависит от типа новой операции — своё независимое переключение.
        const showExp = vis('ops.planExpense'), showInc = vis('ops.planIncome');
        if(!showExp && !showInc) return null;
        const effKind = (planKind==='income' && showInc) ? 'income' : (showExp ? 'expense' : 'income');
        const isExp = effKind==='expense';
        const kindToggle = (
          <div style={{display:'flex',gap:6}}>
            {showExp && <div className="chip" onClick={(e)=>{e.stopPropagation(); setPlanKind('expense');}} style={{background:isExp?C.amber:C.panelAlt,color:isExp?'#1A1200':C.dim,borderColor:isExp?C.amber:C.border,padding:'3px 10px',fontSize:11}}>Расходы</div>}
            {showInc && <div className="chip" onClick={(e)=>{e.stopPropagation(); setPlanKind('income');}} style={{background:!isExp?C.amber:C.panelAlt,color:!isExp?'#1A1200':C.dim,borderColor:!isExp?C.amber:C.border,padding:'3px 10px',fontSize:11}}>Доходы</div>}
          </div>
        );
        return (
          <PlanPanel title="Планируемые" kindToggle={kindToggle} open={planOpen} setOpen={setPlanOpen} planSwitcher={planSwitcher} resetKey={planMonth+'_'+effKind}
            categories={isExp?categories.expense:categories.income}
            actualByCat={isExp?planExpenseByCat:planIncomeByCat}
            plans={isExp?monthBudgets:monthIncomePlans}
            onSaveBatch={patch=> isExp?setBudgetsBatch(planMonth,patch):setIncomePlansBatch(planMonth,patch)}
            onRemove={c=> isExp?removeBudget(planMonth,c):removeIncomePlan(planMonth,c)}
            barColor={isExp?C.green:C.cyan} spentWord={isExp?'потрачено':'получено'} />
        );
      })()}

      {vis('ops.bills') && (
      <div style={S.panel}>
        <div style={S.panelTitle}>Регулярные платежи</div>
        <div style={S.inputRow}>
          <input style={S.input} placeholder="Название" value={billName} onChange={e=>setBillName(e.target.value)} />
          <input style={{...S.input,maxWidth:100}} type="number" placeholder="сумма" value={billAmount} onChange={e=>setBillAmount(e.target.value)} />
          <input style={{...S.input,maxWidth:80}} type="number" min="1" max="31" placeholder="день" value={billDay} onChange={e=>setBillDay(e.target.value)} />
          <button style={S.iconBtnAmber} onClick={()=>{ const a=parseFloat(billAmount), d=parseInt(billDay,10); if(billName.trim()&&!isNaN(a)&&!isNaN(d)){ addBill(billName.trim(),a,d); setBillName(''); setBillAmount(''); setBillDay(''); } }}>+</button>
        </div>
        {bills.map(b=>(
          <div key={b.id} className="row-hover" style={S.taskRow}>
            <div style={{flex:1,fontSize:13}}>{b.name} · {b.dayOfMonth} числа</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12.5}}>{mo(b.amount)}</div>
            <button className="icon-btn" onClick={()=>deleteBill(b.id)}>✕</button>
          </div>
        ))}
      </div>
      )}

      <div className="grid2" style={S.grid2}>
        {vis('ops.expensePie') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Расходы по категориям · месяц</div>
          {Object.keys(expenseByCat).length===0 ? <div style={S.emptyState}>Пока нет расходов</div> :
            <ChartCanvas type="pie" data={pieData} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:C.dim,font:{size:11}}}}}} height={220} />}
        </div>
        )}
        {vis('ops.incomePie') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Доходы по категориям · месяц</div>
          {Object.keys(incomeByCat).length===0 ? <div style={S.emptyState}>Пока нет доходов</div> :
            <ChartCanvas type="pie" data={incomePieData} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:C.dim,font:{size:11}}}}}} height={220} />}
        </div>
        )}
      </div>
      {vis('ops.expenseDaily') && (
      <div style={S.panel}>
        <div style={S.panelTitle}>Расходы по дням · 30 дней</div>
        <ChartCanvas type="bar" data={{labels:dailyExpense.labels, datasets:[{label:'Расход', data:dailyExpense.data, backgroundColor:C.red, borderRadius:3, maxBarThickness:14}]}} options={baseChartOpts()} height={220} />
      </div>
      )}

      <div style={S.panel}>
        <div style={S.panelTitle}>Последние операции</div>
        {finance.transactions.length===0 && <div style={S.emptyState}>Операций пока нет</div>}
        {finance.transactions.slice(0,25).map(t=>(
          <div key={t.id} className="row-hover" style={S.taskRow}>
            <div style={{width:8,height:8,borderRadius:4,background:t.type==='income'?C.green:C.red}} />
            <div style={{width:60,fontSize:12,color:C.dim,fontFamily:"'JetBrains Mono',monospace"}}>{t.date.slice(5)}</div>
            <div style={{flex:1,fontSize:13.5}}>{t.category}{t.accountId?` · ${accountName(t.accountId)||'?'}`:''}{t.note?` · ${t.note}`:''}{t.exclude?<span style={{...S.dimSpan,marginLeft:4}}>(не считается)</span>:null}</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:t.type==='income'?C.green:C.red}}>{t.type==='income'?'+':'−'}{mo(t.amount)}</div>
            <button className="icon-btn" onClick={()=>deleteTransaction(t.id)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssetsSection({accounts, transactions, finMask={}, addAccount, deleteAccount, addSnapshot, deleteSnapshot}){
  const [newAccName,setNewAccName] = useState('');
  const [snapForms,setSnapForms] = useState({});
  const setField = (id,f,v) => setSnapForms(prev=>({...prev,[id]:{...prev[id],[f]:v}}));

  const allocation = useMemo(()=> accounts.map(a=>
    ({name:a.name, value: accountBalanceNow(a, transactions)})).filter(a=>a.value>0), [accounts, transactions]);

  const netWorthTrend = useMemo(()=>{
    const today = todayStr();
    // старт графика = самая ранняя дата среди замеров И операций (не только замеров),
    // чтобы линия двигалась от операций без необходимости делать повторный замер.
    let start = null;
    accounts.forEach(a=>a.snapshots.forEach(s=>{ if(!start||s.date<start) start=s.date; }));
    transactions.forEach(t=>{ if(!t.exclude && (!start||t.date<start)) start=t.date; });
    if(!start) return [];
    const dateSet=new Set([today]);
    accounts.forEach(a=>a.snapshots.forEach(s=>dateSet.add(s.date)));
    transactions.forEach(t=>{ if(!t.exclude && t.date>=start && t.date<=today) dateSet.add(t.date); });
    const dates=[...dateSet].filter(d=>d>=start && d<=today).sort();
    return dates.map(ds=>{
      const total = accounts.reduce((sum,a)=>sum+accountBalanceOn(a, transactions, ds),0) + unassignedNetOn(transactions, ds);
      return {date:ds.slice(5), total};
    });
  }, [accounts, transactions]);

  const accountTrends = useMemo(()=>{
    const minSnapshotDate = accounts.reduce((min,a)=>a.snapshots.reduce((m,s)=>!m||s.date<m?s.date:m, min), null);
    if(!minSnapshotDate) return {labels:[], datasets:[]};
    const dateSet=new Set([todayStr()]);
    accounts.forEach(a=>a.snapshots.forEach(s=>dateSet.add(s.date)));
    transactions.forEach(t=>{ if(t.accountId && t.date>=minSnapshotDate && t.date<=todayStr()) dateSet.add(t.date); });
    const dates=[...dateSet].filter(d=>d>=minSnapshotDate).sort();
    const datasets = accounts.map((a,i)=>({ label:a.name, data:dates.map(ds=>accountBalanceOn(a, transactions, ds)), borderColor:PIE_COLORS[i%PIE_COLORS.length], backgroundColor:'transparent', tension:.3 }));
    return { labels:dates.map(d=>d.slice(5)), datasets };
  }, [accounts, transactions]);

  return (
    <div>
      <div style={S.panel}>
        <div style={S.panelTitle}>Добавить счёт</div>
        <div style={S.inputRow}>
          <input style={S.input} placeholder="Название" value={newAccName} onChange={e=>setNewAccName(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter'&&newAccName.trim()){ addAccount(newAccName.trim()); setNewAccName(''); } }} />
          <button style={S.iconBtnAmber} onClick={()=>{ if(newAccName.trim()){ addAccount(newAccName.trim()); setNewAccName(''); } }}>+</button>
        </div>
        <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
          {DEFAULT_ACCOUNTS.filter(d=>!accounts.some(a=>a.name===d)).map(d=><div key={d} className="chip" style={{background:C.panelAlt,color:C.dim,borderColor:C.border}} onClick={()=>addAccount(d)}>+ {d}</div>)}
        </div>
      </div>

      {(allocation.length>0 || netWorthTrend.length>1) && (
        <div className="grid2" style={S.grid2}>
          {vis('assets.allocation') && (
          <div style={S.panel}>
            <div style={S.panelTitle}>Распределение</div>
            {allocation.length===0 ? <div style={S.emptyState}>Нет данных</div> :
              <ChartCanvas type="pie" data={{labels:allocation.map(a=>a.name), datasets:[{data:allocation.map(a=>a.value), backgroundColor:PIE_COLORS}]}} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:C.dim,font:{size:11}}}}}} height={200}/>}
          </div>
          )}
          {vis('assets.netWorth') && (
          <div style={S.panel}>
            <div style={S.panelTitle}>Чистые активы во времени</div>
            {netWorthTrend.length<2 ? <div style={S.emptyState}>Мало данных — добавь замер или операцию</div> :
              <ChartCanvas type="line" data={{labels:netWorthTrend.map(d=>d.date), datasets:[{data:netWorthTrend.map(d=>d.total), borderColor:C.cyan, backgroundColor:'transparent', tension:.3}]}} options={baseChartOpts()} height={200}/>}
          </div>
          )}
        </div>
      )}

      {vis('assets.accountTrends') && accountTrends.datasets.length>0 && accountTrends.labels.length>1 && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Баланс по счетам во времени</div>
          <ChartCanvas type="line" data={accountTrends} options={baseChartOpts({plugins:{legend:{display:true, labels:{color:C.dim,font:{size:10}}}}})} height={240} />
        </div>
      )}

      {accounts.map(a=>{
        const f = snapForms[a.id] || {amount:'',currency:'RUB',rate:'',date:todayStr()};
        return (
          <div key={a.id} style={S.panel}>
            <div style={{display:'flex',alignItems:'center'}}>
              <div style={{...S.panelTitle,flex:1,marginBottom:0}}>{a.name}</div>
              <button className="icon-btn" onClick={()=>deleteAccount(a.id)}>✕</button>
            </div>
            <div style={{...S.inputRow,marginTop:10}}>
              <input style={{...S.input,maxWidth:100}} type="number" placeholder="сумма" value={f.amount} onChange={e=>setField(a.id,'amount',e.target.value)} />
              <Select small style={{minWidth:70}} value={f.currency} onChange={v=>setField(a.id,'currency',v)} options={[{value:'RUB',label:'₽'},{value:'USD',label:'$'}]} />
              {f.currency==='USD' && <input style={{...S.input,maxWidth:80}} type="number" placeholder="курс" value={f.rate} onChange={e=>setField(a.id,'rate',e.target.value)} />}
              <input style={{...S.input,maxWidth:130}} type="date" value={f.date} onChange={e=>setField(a.id,'date',e.target.value)} onClick={openDatePicker} />
              <button style={S.iconBtnAmber} onClick={()=>{ const amount=parseFloat(f.amount); if(isNaN(amount)) return;
                addSnapshot(a.id,{date:f.date||todayStr(), amount, currency:f.currency, rate:f.rate?parseFloat(f.rate):undefined}); setField(a.id,'amount',''); }}>+</button>
            </div>
            {a.snapshots.slice(0,5).map(s=>(
              <div key={s.id} className="row-hover" style={S.taskRow}>
                <div style={{width:70,fontSize:12,color:C.dim,fontFamily:"'JetBrains Mono',monospace"}}>{s.date.slice(5)}</div>
                <div style={{flex:1,fontSize:13}}>{finMask.net ? '••••••' : (s.currency==='USD'?`$${s.amount} (курс ${s.rate})`:fmtMoney(s.amount))}</div>
                <button className="icon-btn" onClick={()=>deleteSnapshot(a.id,s.id)}>✕</button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function DebtorsSection({debtors, mask=false, addDebtor, updateDebtor, deleteDebtor}){
  const [name,setName] = useState(''); const [amount,setAmount] = useState('');
  return (
    <div style={S.panel}>
      <div style={S.panelTitle}>Кто должен</div>
      <div style={S.inputRow}>
        <input style={S.input} placeholder="Имя" value={name} onChange={e=>setName(e.target.value)} />
        <input style={{...S.input,maxWidth:120}} type="number" placeholder="сумма" value={amount} onChange={e=>setAmount(e.target.value)} />
        <button style={S.iconBtnAmber} onClick={()=>{ const a=parseFloat(amount); if(name.trim()&&!isNaN(a)){ addDebtor(name.trim(),a); setName(''); setAmount(''); } }}>+</button>
      </div>
      {debtors.length===0 && <div style={S.emptyState}>Долгов не зафиксировано</div>}
      {debtors.map(d=>(
        <div key={d.id} className="row-hover" style={S.taskRow}>
          <div style={{flex:1,fontSize:13.5}}>{d.name}</div>
          {mask
            ? <div style={{maxWidth:100,textAlign:'right',flex:'0 0 100px',color:C.dim,fontFamily:"'JetBrains Mono',monospace"}}>••••••</div>
            : <input style={{...S.input,maxWidth:100,textAlign:'right'}} type="number" defaultValue={d.amount} onBlur={e=>updateDebtor(d.id,parseFloat(e.target.value)||0)} />}
          <button className="icon-btn" onClick={()=>deleteDebtor(d.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ============================================================ Stats
function StatsTab({days, finance, budgets, incomePlans, habits=[], finMask={}}){
  const mo = n => maskMoney(finMask.ops, n);   // приватность: скрытие сумм в статистике
  const [range,setRange] = useState('30');
  const rangeDays = range==='7'?7 : range==='30'?30 : range==='90'?90 : range==='year'?365 : 1000;
  const rangeLabel = range==='7'?'7 дней' : range==='30'?'30 дней' : range==='90'?'90 дней' : range==='year'?'год' : 'всё время';

  // 📈 Обзор за выбранный период (реагирует на селектор диапазона вверху). session 019; диапазон — 020.
  const periodOverview = useMemo(()=>{
    let tasksDone=0, habitDone=0; const ratings=[], sleeps=[];
    for(let i=0;i<rangeDays;i++){ const ds=daysAgoStr(i); const e=days[ds]; if(!e) continue;
      tasksDone += (e.tasks||[]).filter(t=>t.done).length;
      habitDone += habits.reduce((n,h)=> n + (h.log && h.log[ds] ? 1 : 0), 0);
      if(e.rating!=null) ratings.push(e.rating);
      if(e.sleepHours!=null) sleeps.push(e.sleepHours);
    }
    const start = daysAgoStr(rangeDays-1); let exp=0, inc=0;
    finance.transactions.forEach(t=>{ if(t.exclude || t.date<start) return; if(t.type==='expense') exp+=t.amount; else inc+=t.amount; });
    const avg = a => a.length ? Math.round(a.reduce((s,x)=>s+x,0)/a.length*10)/10 : null;
    return { tasksDone, habitDone, avgRating:avg(ratings), avgSleep:avg(sleeps), exp, inc };
  }, [days, habits, finance.transactions, rangeDays]);

  // 🔬 Детальный анализ: что коррелирует с оценкой дня (сон, задачи, привычки, теги) за период. session 020.
  const factorCorrelations = useMemo(()=>{
    const rows=[];
    for(let i=0;i<rangeDays;i++){ const ds=daysAgoStr(i); const e=days[ds]; if(!e || e.rating==null) continue;
      rows.push({ rating:e.rating, sleep:e.sleepHours,
        tasksDone:(e.tasks||[]).filter(t=>t.done).length, tasksPlanned:(e.tasks||[]).length,
        habitsDone: habits.reduce((n,h)=> n + (h.log && h.log[ds]?1:0), 0), tags:(e.tags||[]).length });
    }
    const pearson = (key) => {
      const xs=[], ys=[]; rows.forEach(r=>{ if(r[key]!=null){ xs.push(r[key]); ys.push(r.rating); } });
      const n=xs.length; if(n<4) return {n, r:null};
      const mean=a=>a.reduce((s,x)=>s+x,0)/a.length; const mx=mean(xs), my=mean(ys);
      let num=0,dx=0,dy=0; for(let i=0;i<n;i++){ const a=xs[i]-mx,b=ys[i]-my; num+=a*b; dx+=a*a; dy+=b*b; }
      return {n, r:(dx&&dy)?Math.round(num/Math.sqrt(dx*dy)*100)/100:0};
    };
    const factors = [
      {key:'sleep', label:'😴 Сон'}, {key:'tasksDone', label:'✅ Задач выполнено'},
      {key:'tasksPlanned', label:'📋 Задач запланировано'}, {key:'habitsDone', label:'🔁 Привычек отмечено'},
      {key:'tags', label:'🏷 Тегов за день'},
    ];
    return factors.map(f=>({...f, ...pearson(f.key)})).sort((a,b)=> Math.abs(b.r||0)-Math.abs(a.r||0));
  }, [days, habits, rangeDays]);
  const corrStrength = (r) => { const a=Math.abs(r); return a<0.2?'почти нет':a<0.4?'слабая':a<0.6?'заметная':a<0.8?'сильная':'очень сильная'; };

  const [pfMonth,setPfMonth] = useState(todayStr().slice(0,7));

  const heatWeeks = Math.min(52, Math.ceil(rangeDays/7));

  const heatmapDays = useMemo(()=>{ const arr=[]; for(let i=heatWeeks*7-1;i>=0;i--){ const ds=daysAgoStr(i); const e=days[ds];
    const c=(e?.tasks||[]).filter(t=>t.done).length + Object.values(e?.dailyCompletions||{}).filter(Boolean).length; arr.push({date:ds,doneCount:c}); } return arr; }, [days, heatWeeks]);
  const weeks = []; for(let i=0;i<heatmapDays.length;i+=7) weeks.push(heatmapDays.slice(i,i+7));
  const cellColor = n => n===0?C.panelAlt : n===1?'#5A4A26' : n===2?'#8A6B2C' : n===3?'#C68F2E' : C.amber;

  const grouping = (range==='year'||range==='all') ? 'month' : (range==='90'?'week':'day');
  const weeklyStats = useMemo(()=>{
    const map={};
    Object.entries(days).forEach(([ds,e])=>{
      const key = grouping==='month' ? ds.slice(0,7) : grouping==='week' ? isoWeek(ds) : ds;
      if(!map[key]) map[key]={key, planned:0, done:0};
      map[key].planned += (e.tasks||[]).length; map[key].done += (e.tasks||[]).filter(t=>t.done).length;
    });
    return Object.values(map).sort((a,b)=>a.key>b.key?1:-1).slice(-16);
  }, [days, grouping]);

  const trend = (field, n=14) => { const arr=[]; for(let i=n-1;i>=0;i--){ const ds=daysAgoStr(i); const e=days[ds]; arr.push({date:ds.slice(5), v: e && e[field]!=null ? e[field] : null}); } return arr; };
  const sleepTrend = trend('sleepHours'); const ratingTrend = trend('rating');

  const monthlyFinance = useMemo(()=>{
    const map={};
    finance.transactions.forEach(t=>{ if(t.exclude) return; const key=t.date.slice(0,7); if(!map[key]) map[key]={key,income:0,expense:0};
      if(t.type==='income') map[key].income+=t.amount; else map[key].expense+=t.amount; });
    return Object.values(map).sort((a,b)=>a.key>b.key?1:-1).slice(-12);
  }, [finance.transactions]);

  // накопительный баланс операций за выбранный период (перенесён из Финансы→Операции, session 015)
  const balanceTrend = useMemo(()=>{
    const sorted=[...finance.transactions].sort((a,b)=>a.date>b.date?1:-1); let running=0; const byDate={};
    sorted.forEach(t=>{ if(!t.exclude){ running += t.type==='income'?t.amount:-t.amount; byDate[t.date]=running; } });
    const n = Math.min(rangeDays, 365); const labels=[], data=[]; let last=0;
    for(let i=n-1;i>=0;i--){ const ds=daysAgoStr(i); if(byDate[ds]!==undefined) last=byDate[ds]; labels.push(ds.slice(5)); data.push(last); }
    return {labels, data};
  }, [finance.transactions, rangeDays]);

  const rangeStart = daysAgoStr(rangeDays-1);
  const catBreakdown = useMemo(()=>{
    const inc={}, exp={};
    finance.transactions.forEach(t=>{ if(t.exclude || t.date<rangeStart) return;
      if(t.type==='income') inc[t.category]=(inc[t.category]||0)+t.amount; else exp[t.category]=(exp[t.category]||0)+t.amount; });
    return {inc, exp};
  }, [finance.transactions, rangeStart]);
  const tagFreq = useMemo(()=>{ const map={}; Object.entries(days).forEach(([ds,e])=>{ if(ds<rangeStart) return; (e.tags||[]).forEach(tg=>{ map[tg]=(map[tg]||0)+1; }); });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]); }, [days, rangeStart]);

  // план/факт по выбранному месяцу (история планов помесячная)
  const pfTx = finance.transactions.filter(t=>t.date.slice(0,7)===pfMonth && !t.exclude);
  const pfExp={}, pfInc={}; pfTx.forEach(t=>{ const m=t.type==='expense'?pfExp:pfInc; m[t.category]=(m[t.category]||0)+t.amount; });
  const pfBud=(budgets||{})[pfMonth]||{}; const pfIncPlan=(incomePlans||{})[pfMonth]||{};
  const planFactRows = (actual, plan, kind) => {
    const cats=[...new Set([...Object.keys(plan), ...Object.keys(actual)])];
    if(cats.length===0) return <div style={S.emptyState}>Нет данных за месяц</div>;
    return cats.map(c=>{ const a=actual[c]||0; const p=plan[c]; const ratio=p?Math.min(100,(a/p)*100):0;
      const barColor = kind==='expense' ? (p&&a>p?C.red:(p&&a/p>0.7?C.amber:C.green)) : (p?(a>=p?C.green:a/p>0.5?C.amber:C.dim):C.dim);
      return (
        <div key={c} style={{marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}><span>{c}</span><span style={{color:C.dim}}>{mo(a)}{p?` / ${mo(p)}`:''}</span></div>
          {p ? <div style={{height:5,background:C.panelAlt,borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${ratio}%`,background:barColor}}/></div>
             : <div style={{fontSize:10.5,color:C.dim}}>план не задан</div>}
        </div>
      ); });
  };

  return (
    <div>
      <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
        {[{id:'7',label:'7д'},{id:'30',label:'30д'},{id:'90',label:'90д'},{id:'year',label:'Год'},{id:'all',label:'Всё время'}].map(r=>(
          <div key={r.id} className="chip" onClick={()=>setRange(r.id)} style={{background:range===r.id?C.amber:C.panelAlt,color:range===r.id?'#1A1200':C.dim,borderColor:range===r.id?C.amber:C.border}}>{r.label}</div>
        ))}
      </div>

      {vis('stats.weekly') && (
      <div style={S.panel}>
        <div style={S.panelTitle}>📈 Обзор · {rangeLabel}</div>
        <div className="grid3" style={{...S.grid3,gap:10}}>
          <div style={S.statCard}><div style={S.statVal}>{periodOverview.tasksDone}</div><div style={S.dimSpan}>задач выполнено</div></div>
          <div style={S.statCard}><div style={S.statVal}>{periodOverview.habitDone}</div><div style={S.dimSpan}>привычек отмечено</div></div>
          <div style={S.statCard}><div style={S.statVal}>{periodOverview.avgRating!=null?periodOverview.avgRating:'–'}</div><div style={S.dimSpan}>средняя оценка</div></div>
          <div style={S.statCard}><div style={S.statVal}>{periodOverview.avgSleep!=null?`${periodOverview.avgSleep} ч`:'–'}</div><div style={S.dimSpan}>средний сон</div></div>
          <div style={S.statCard}><div style={{...S.statVal,color:C.red}}>{mo(periodOverview.exp)}</div><div style={S.dimSpan}>расход за период</div></div>
          <div style={S.statCard}><div style={{...S.statVal,color:C.green}}>{mo(periodOverview.inc)}</div><div style={S.dimSpan}>доход за период</div></div>
        </div>
      </div>
      )}

      {vis('stats.analysis') && (
      <div style={S.panel}>
        <div style={S.panelTitle}>🔬 Анализ: что влияет на оценку дня · {rangeLabel}</div>
        <div style={{...S.dimSpan,marginLeft:0,marginBottom:10,display:'block'}}>Корреляция (Пирсон) между оценкой дня и факторами. Ближе к ±1 — сильнее связь; знак = направление. Нужно ≥4 дня с оценкой.</div>
        {factorCorrelations.every(f=>f.r==null) && <div style={S.emptyState}>Мало данных за период — ставь оценку дня почаще.</div>}
        {factorCorrelations.filter(f=>f.r!=null).map(f=>(
          <div key={f.key} style={{marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12.5,marginBottom:3,gap:8}}>
              <span>{f.label}</span>
              <span style={{color:C.dim,fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>r={f.r} · {corrStrength(f.r)} · {f.n} дн.</span>
            </div>
            {/* полоса от центра: вправо (зелёная) при r>0, влево (красная) при r<0 */}
            <div style={{position:'relative',height:6,background:C.panelAlt,borderRadius:3,overflow:'hidden'}}>
              <div style={{position:'absolute',left:'50%',top:0,bottom:0,width:1,background:C.border}}/>
              <div style={{position:'absolute',top:0,bottom:0,background:f.r>=0?C.green:C.red,
                left: f.r>=0?'50%':`${50-Math.abs(f.r)*50}%`, width:`${Math.abs(f.r)*50}%`}}/>
            </div>
          </div>
        ))}
      </div>
      )}

      {vis('stats.heatmap') && (
      <div style={S.panel}>
        <div style={S.panelTitle}>Дисциплин-грид</div>
        <div style={{display:'flex',gap:3,marginTop:8,overflowX:'auto'}}>
          {weeks.map((week,wi)=><div key={wi} style={{display:'flex',flexDirection:'column',gap:3}}>{week.map(d=><div key={d.date} title={`${d.date}: ${d.doneCount}`} style={{width:11,height:11,borderRadius:2,background:cellColor(d.doneCount)}}/>)}</div>)}
        </div>
      </div>
      )}

      <div className="grid2" style={S.grid2}>
        {vis('stats.tasks') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Выполнение задач</div>
          <ChartCanvas type="bar" data={{labels:weeklyStats.map(w=>w.key.slice(5)), datasets:[
            {label:'Запланировано', data:weeklyStats.map(w=>w.planned), backgroundColor:C.border},
            {label:'Выполнено', data:weeklyStats.map(w=>w.done), backgroundColor:C.amber},
          ]}} options={baseChartOpts({plugins:{legend:{display:true, labels:{color:C.dim,font:{size:10}}}}})} />
        </div>
        )}
        {vis('stats.rating') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Оценка дня</div>
          <ChartCanvas type="line" data={{labels:ratingTrend.map(r=>r.date), datasets:[{data:ratingTrend.map(r=>r.v), borderColor:C.purple, backgroundColor:'transparent', spanGaps:true, tension:.3}]}} options={baseChartOpts({scales:{x:{ticks:{color:axisColor,font:{size:10}},grid:{color:gridColor}},y:{min:0,max:10,ticks:{color:axisColor,font:{size:10}},grid:{color:gridColor}}}})} />
        </div>
        )}
      </div>

      <div className="grid2" style={S.grid2}>
        {vis('stats.sleep') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Сон</div>
          <ChartCanvas type="line" data={{labels:sleepTrend.map(r=>r.date), datasets:[{data:sleepTrend.map(r=>r.v), borderColor:C.cyan, backgroundColor:'transparent', spanGaps:true, tension:.3}]}} options={baseChartOpts()} />
        </div>
        )}
        {vis('stats.monthly') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Доход/расход по месяцам</div>
          <ChartCanvas type="bar" data={{labels:monthlyFinance.map(m=>m.key), datasets:[
            {label:'Доход', data:monthlyFinance.map(m=>m.income), backgroundColor:C.green},
            {label:'Расход', data:monthlyFinance.map(m=>m.expense), backgroundColor:C.red},
          ]}} options={baseChartOpts({plugins:{legend:{display:true, labels:{color:C.dim,font:{size:10}}}}})} />
        </div>
        )}
      </div>

      <div className="grid2" style={S.grid2}>
        {vis('stats.net') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Чистый доход по месяцам</div>
          <ChartCanvas type="bar" data={{labels:monthlyFinance.map(m=>m.key), datasets:[
            {label:'Чистыми', data:monthlyFinance.map(m=>m.income-m.expense), backgroundColor:monthlyFinance.map(m=>m.income-m.expense>=0?C.green:C.red)},
          ]}} options={baseChartOpts()} />
        </div>
        )}
        {vis('stats.savings') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Норма сбережений · %</div>
          <ChartCanvas type="line" data={{labels:monthlyFinance.map(m=>m.key), datasets:[{data:monthlyFinance.map(m=>m.income>0?Math.round((m.income-m.expense)/m.income*100):0), borderColor:C.amber, backgroundColor:'transparent', tension:.3}]}} options={baseChartOpts()} />
        </div>
        )}
      </div>

      {vis('stats.balanceLine') && (
      <div style={S.panel}>
        <div style={S.panelTitle}>Баланс операций во времени · период</div>
        <ChartCanvas type="line" data={{labels:balanceTrend.labels, datasets:[{data:balanceTrend.data, borderColor:C.amber, backgroundColor:'transparent', tension:.3}]}} options={baseChartOpts()} height={220} />
      </div>
      )}

      <div className="grid2" style={S.grid2}>
        {vis('stats.incomeCat') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Доходы по категориям · период</div>
          {Object.keys(catBreakdown.inc).length===0 ? <div style={S.emptyState}>Нет доходов за период</div> :
            <ChartCanvas type="pie" data={{labels:Object.keys(catBreakdown.inc), datasets:[{data:Object.values(catBreakdown.inc), backgroundColor:PIE_COLORS}]}} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:C.dim,font:{size:11}}}}}} height={220}/>}
        </div>
        )}
        {vis('stats.expenseCat') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Расходы по категориям · период</div>
          {Object.keys(catBreakdown.exp).length===0 ? <div style={S.emptyState}>Нет расходов за период</div> :
            <ChartCanvas type="pie" data={{labels:Object.keys(catBreakdown.exp), datasets:[{data:Object.values(catBreakdown.exp), backgroundColor:PIE_COLORS}]}} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:C.dim,font:{size:11}}}}}} height={220}/>}
        </div>
        )}
      </div>

      {vis('stats.tagFreq') && tagFreq.length>0 && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Частота тегов · период</div>
          <ChartCanvas type="bar" data={{labels:tagFreq.map(t=>t[0]), datasets:[{label:'дней', data:tagFreq.map(t=>t[1]), backgroundColor:C.cyan}]}} options={baseChartOpts()} />
        </div>
      )}

      {vis('stats.planfact') && (
        <div style={S.panel}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:8}}>
            <div style={{...S.panelTitle,marginBottom:0}}>План / факт по месяцу</div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <button style={S.navArrow} onClick={()=>setPfMonth(shiftMonth(pfMonth,-1))}>◀</button>
              <span style={{fontSize:12,color:C.dim,minWidth:120,textAlign:'center',textTransform:'capitalize'}}>{monthLabelRu(pfMonth)}</span>
              <button style={S.navArrow} onClick={()=>setPfMonth(shiftMonth(pfMonth,1))} disabled={pfMonth>=todayStr().slice(0,7)}>▶</button>
            </div>
          </div>
          <div className="grid2" style={S.grid2}>
            <div>
              <div style={{fontSize:12.5,fontWeight:700,color:C.dim,marginBottom:8}}>Расходы</div>
              {planFactRows(pfExp, pfBud, 'expense')}
            </div>
            <div>
              <div style={{fontSize:12.5,fontWeight:700,color:C.dim,marginBottom:8}}>Доходы</div>
              {planFactRows(pfInc, pfIncPlan, 'income')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================ Achievements
function AchievementsTab({stats, unlocked}){
  const [filter,setFilter] = useState('all'); // all | done | todo
  const total = ACHIEVEMENTS.length;
  const doneCount = ACHIEVEMENTS.filter(a=>unlocked[a.id]).length;
  const points = ACHIEVEMENTS.reduce((p,a)=> p + (unlocked[a.id]?ACH_TIERS[a.tier].pts:0), 0);
  const maxPoints = ACHIEVEMENTS.reduce((p,a)=> p+ACH_TIERS[a.tier].pts, 0);
  const pct = total? Math.round(doneCount/total*100) : 0;

  return (
    <div>
      <div style={S.panel}>
        <div style={S.panelTitle}>Достижения <span style={S.dimSpan}>{doneCount} / {total}</span></div>
        <div style={{height:8, background:C.panelAlt, borderRadius:4, overflow:'hidden', margin:'8px 0'}}>
          <div style={{height:'100%', width:`${pct}%`, background:C.amber}}/>
        </div>
        <div style={S.dimSpan}>Очки славы: {points} / {maxPoints} · открыто {pct}%</div>
        <div style={{display:'flex', gap:6, marginTop:12, flexWrap:'wrap'}}>
          {[{id:'all',label:'Все'},{id:'done',label:'Полученные'},{id:'todo',label:'В процессе'}].map(f=>(
            <div key={f.id} className="chip" onClick={()=>setFilter(f.id)} style={{background:filter===f.id?C.amber:C.panelAlt, color:filter===f.id?'#1A1200':C.dim, borderColor:filter===f.id?C.amber:C.border}}>{f.label}</div>
          ))}
        </div>
      </div>

      {ACH_GROUPS.map(group=>{
        const list = ACHIEVEMENTS.filter(a=>a.g===group).filter(a=>{
          const done=!!unlocked[a.id];
          return filter==='all' || (filter==='done'&&done) || (filter==='todo'&&!done);
        });
        if(list.length===0) return null;
        return (
          <div key={group} style={S.panel}>
            <div style={S.panelTitle}>{group} <span style={S.dimSpan}>{list.filter(a=>unlocked[a.id]).length}/{list.length}</span></div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))', gap:10}}>
              {list.map(a=>{
                const done=!!unlocked[a.id];
                const tier=ACH_TIERS[a.tier];
                const v=a.val(stats);
                const prog=Math.min(100, a.target? v/a.target*100 : 0);
                const hidden=a.secret && !done;
                return (
                  <div key={a.id} style={{border:`1px solid ${done?tier.c:C.border}`, background:done?C.panelAlt:'transparent', borderRadius:8, padding:12, position:'relative'}}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <div style={{fontSize:26, filter:done?'none':'grayscale(1)', opacity:done?1:0.45}}>{hidden?'🔒':a.icon}</div>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontSize:13.5, fontWeight:700, color:done?C.text:C.dim}}>{hidden?'Секрет':a.title}</div>
                        <div style={{fontSize:10, color:tier.c, textTransform:'uppercase', letterSpacing:'.05em'}}>{tier.label}{done?` · ${unlocked[a.id]}`:''}</div>
                      </div>
                      {done && <div style={{fontSize:15, color:tier.c}}>✓</div>}
                    </div>
                    <div style={{fontSize:11.5, color:C.dim, marginTop:8, minHeight:30}}>{hidden?'Секретное достижение — открой его сам':a.desc}</div>
                    {!done && !hidden && (
                      <div style={{marginTop:6}}>
                        <div style={{height:4, background:C.panelAlt, borderRadius:2, overflow:'hidden'}}><div style={{height:'100%', width:`${prog}%`, background:tier.c}}/></div>
                        <div style={{fontSize:10, color:C.dim, marginTop:3, textAlign:'right'}}>{achValDisplay(a, Math.min(v,a.target))} / {achValDisplay(a, a.target)}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================ Settings
// Сворачиваемый раздел настроек
function SettingsSection({title, icon, defaultOpen=false, children}){
  const [open,setOpen] = useState(defaultOpen);
  return (
    <div style={S.panel}>
      <div onClick={()=>setOpen(o=>!o)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',userSelect:'none'}}>
        <div style={{...S.panelTitle,marginBottom:0}}>{icon} {title}</div>
        <span style={{color:C.dim,fontSize:12,transition:'transform .2s ease',transform:open?'rotate(180deg)':'none'}}>▾</span>
      </div>
      {open && <div className="anim-collapse" style={{marginTop:14}}>{children}</div>}
    </div>
  );
}
// заголовок под-блока внутри раздела
const SubHead = ({children}) => <div style={{fontSize:12.5,fontWeight:700,color:C.cyan,margin:'2px 0 8px',letterSpacing:'.02em'}}>{children}</div>;
const SettingsDivider = () => <div style={{height:1,background:C.border,margin:'18px 0'}}/>;

function SettingsTab({hidden, toggleModule, defaults, setDefault, categories, accounts, mobileTabs, toggleMobileTab, soundOff, notifOff, maskNetWorth, maskDebts, maskOps, maskAllFinance, morningCfg, setSettingFlag, requestNotifs, testNotif, showNotifDiag, notifMsg, deadlineCfg}){
  const dlOn = !!(deadlineCfg && !deadlineCfg.off);
  const dlDays = (deadlineCfg && deadlineCfg.days && deadlineCfg.days.length) ? deadlineCfg.days : [3,1];
  const dlTime = (deadlineCfg && deadlineCfg.time) || '09:00';
  const msOn = !!(morningCfg && !morningCfg.off);
  const msTime = (morningCfg && morningCfg.time) || '08:00';
  const setDl = (patch) => setSettingFlag('deadlineNotif', {off:false, days:dlDays, time:dlTime, ...(deadlineCfg||{}), ...patch});
  const toggleDlDay = (d) => { const has=dlDays.includes(d); const next=has?dlDays.filter(x=>x!==d):[...dlDays,d].sort((a,b)=>a-b); setDl({days:next}); };
  return (
    <div>
      <SettingsSection title="Уведомления и звук" icon="🔔">
        <label className="row-hover" style={{...S.taskRow, cursor:'pointer'}}>
          <input type="checkbox" checked={!soundOff} onChange={()=>setSettingFlag('soundOff', !soundOff?true:false)} />
          <div style={{flex:1}}>Звук при получении достижения</div>
          <span style={{fontSize:11,color:C.dim}}>{soundOff?'выкл':'вкл'}</span>
        </label>
        <label className="row-hover" style={{...S.taskRow, cursor:'pointer'}}>
          <input type="checkbox" checked={!notifOff} onChange={()=>setSettingFlag('notifOff', !notifOff?true:false)} />
          <div style={{flex:1}}>Уведомления на телефоне (привычки · напоминания)</div>
          <span style={{fontSize:11,color:C.dim}}>{notifOff?'выкл':'вкл'}</span>
        </label>
        <div style={{...S.dimSpan,marginLeft:0,marginTop:8,display:'block'}}>
          Время напоминания у привычек задаётся во вкладке «Привычки», у заметок-напоминаний — в редакторе. Работает в приложении на телефоне (не в браузере).
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
          <button style={S.exportBtn} onClick={requestNotifs}>Разрешить уведомления</button>
          <button style={{...S.exportBtn,borderColor:C.amber,color:C.amber}} onClick={testNotif}>🔔 Тест (через 5 сек)</button>
          <button style={S.exportBtn} onClick={showNotifDiag}>Диагностика</button>
        </div>
        <div style={{marginTop:10,padding:'9px 11px',background:C.panelAlt,border:`1px solid ${C.border}`,borderRadius:8,fontSize:12.5,minHeight:20,wordBreak:'break-word',whiteSpace:'pre-wrap'}}>
          {notifMsg || 'Нажми кнопку выше — результат появится здесь (а не во всплывающем окне).'}
        </div>
        <div style={{...S.dimSpan,marginLeft:0,marginTop:8,display:'block',fontSize:11}}>
          Если тест не приходит: (1) убедись, что стоит СВЕЖИЙ APK (см. номер сборки ниже); (2) в системных настройках приложения → «Уведомления» и «Будильники и напоминания» разрешены; (3) отключи экономию батареи для Life OS (частая причина на Xiaomi/Huawei/Samsung).
        </div>
        <div style={{...S.dimSpan,marginLeft:0,marginTop:6,display:'block',fontSize:11}}>
          Сборка: <b style={{color:C.text}}>{BUILD_ID}</b> — прочитай этот номер на телефоне и сверь, что стоит свежая версия.
        </div>

        <SettingsDivider/>
        <SubHead>Дедлайны дел</SubHead>
        <label className="row-hover" style={{...S.taskRow, cursor:'pointer'}}>
          <input type="checkbox" checked={dlOn} onChange={()=> dlOn ? setSettingFlag('deadlineNotif', {...(deadlineCfg||{}), off:true}) : setDl({off:false})} />
          <div style={{flex:1}}>Напоминать о делах с дедлайном</div>
          <span style={{fontSize:11,color:C.dim}}>{dlOn?'вкл':'выкл'}</span>
        </label>
        <div style={{...S.dimSpan,marginLeft:0,marginTop:6,display:'block'}}>Для невыполненных дел (вкладка «Дела»), у которых задан дедлайн. Уведомление приходит в день дедлайна и заранее.</div>
        {dlOn && (
          <div style={{marginTop:10}}>
            <div style={{fontSize:12,color:C.dim,marginBottom:6}}>Напоминать заранее (дней до дедлайна) + в сам день:</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
              {[7,3,1].map(d=>{ const on=dlDays.includes(d); return (
                <div key={d} className="chip" onClick={()=>toggleDlDay(d)}
                  style={{background:on?C.amber:C.panelAlt,color:on?'#1A1200':C.dim,borderColor:on?C.amber:C.border}}>за {d} дн.</div>
              ); })}
              <span style={{fontSize:12,color:C.dim,marginLeft:8}}>время:</span>
              <input style={{...S.input,maxWidth:120}} type="time" value={dlTime} onChange={e=>setDl({time:e.target.value})} />
            </div>
          </div>
        )}

        <SettingsDivider/>
        <SubHead>Утренняя сводка</SubHead>
        <label className="row-hover" style={{...S.taskRow, cursor:'pointer'}}>
          <input type="checkbox" checked={msOn} onChange={()=> msOn ? setSettingFlag('morningSummary', {...(morningCfg||{}), off:true}) : setSettingFlag('morningSummary', {off:false, time:msTime})} />
          <div style={{flex:1}}>Уведомление утром со сводкой дня</div>
          <span style={{fontSize:11,color:C.dim}}>{msOn?'вкл':'выкл'}</span>
        </label>
        <div style={{...S.dimSpan,marginLeft:0,marginTop:6,display:'block'}}>Раз в день: сколько привычек, дедлайнов и напоминаний на сегодня.</div>
        {msOn && (
          <div style={{display:'flex',gap:8,alignItems:'center',marginTop:10}}>
            <span style={{fontSize:12,color:C.dim}}>время:</span>
            <input style={{...S.input,maxWidth:120}} type="time" value={msTime} onChange={e=>setSettingFlag('morningSummary', {off:false, time:e.target.value})} />
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Экран и персонализация" icon="🎨">
        <SubHead>Нижняя навигация (телефон)</SubHead>
        <div style={{...S.dimSpan,marginLeft:0,marginBottom:10,display:'block'}}>Выбери до 4 вкладок для нижней панели. Остальные — в кнопке «Ещё». Выбрано: {mobileTabs.length}/4.</div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {ALL_MOBILE_TAB_IDS.map(id=>{ const on=mobileTabs.includes(id); const full=mobileTabs.length>=4; const m=TAB_META[id];
            return <div key={id} className="chip" onClick={()=>toggleMobileTab(id)}
              style={{background:on?C.amber:C.panelAlt,color:on?'#1A1200':(full?C.border:C.dim),borderColor:on?C.amber:C.border,opacity:(!on&&full)?0.5:1}}>
              {m.icon} {m.label}</div>;
          })}
        </div>

        <SettingsDivider/>
        <SubHead>Финансы · по умолчанию</SubHead>
        <div style={{...S.dimSpan,marginLeft:0,marginBottom:12,display:'block'}}>Эти значения подставляются автоматически при вводе новой операции.</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12}}>
          <div>
            <div style={{fontSize:12,color:C.dim,marginBottom:5}}>Счёт по умолчанию</div>
            <Select value={defaults.account||''} onChange={v=>setDefault('account',v)}
              options={[{value:'',label:'— без счёта —'}, ...accounts.map(a=>({value:a.id,label:a.name}))]} />
          </div>
          <div>
            <div style={{fontSize:12,color:C.dim,marginBottom:5}}>Категория расхода</div>
            <Select value={defaults.expenseCat||''} onChange={v=>setDefault('expenseCat',v)}
              options={[{value:'',label:'— первая в списке —'}, ...categories.expense.map(c=>({value:c,label:c}))]} />
          </div>
          <div>
            <div style={{fontSize:12,color:C.dim,marginBottom:5}}>Категория дохода</div>
            <Select value={defaults.incomeCat||''} onChange={v=>setDefault('incomeCat',v)}
              options={[{value:'',label:'— первая в списке —'}, ...categories.income.map(c=>({value:c,label:c}))]} />
          </div>
        </div>

        <SettingsDivider/>
        <SubHead>Приватность · скрытие сумм</SubHead>
        <div style={{...S.dimSpan,marginLeft:0,marginBottom:8,display:'block',fontSize:11}}>Скрытые суммы заменяются на ••••••. Каждый тип — отдельно; синкуется между устройствами.</div>
        <label className="row-hover" style={{...S.taskRow, cursor:'pointer'}}>
          <input type="checkbox" checked={!!maskAllFinance} onChange={()=>setSettingFlag('maskAllFinance', !maskAllFinance)} />
          <div style={{flex:1,fontWeight:600}}>Скрыть ВСЕ финансовые числа</div>
          <span style={{fontSize:11,color:C.dim}}>{maskAllFinance?'скрыто':'показано'}</span>
        </label>
        <label className="row-hover" style={{...S.taskRow, cursor:'pointer', opacity:maskAllFinance?0.5:1}}>
          <input type="checkbox" checked={!!maskNetWorth} disabled={maskAllFinance} onChange={()=>setSettingFlag('maskNetWorth', !maskNetWorth)} />
          <div style={{flex:1}}>Чистые активы и балансы счетов</div>
          <span style={{fontSize:11,color:C.dim}}>{(maskAllFinance||maskNetWorth)?'скрыто':'показано'}</span>
        </label>
        <label className="row-hover" style={{...S.taskRow, cursor:'pointer', opacity:maskAllFinance?0.5:1}}>
          <input type="checkbox" checked={!!maskDebts} disabled={maskAllFinance} onChange={()=>setSettingFlag('maskDebts', !maskDebts)} />
          <div style={{flex:1}}>Долги (суммы должников)</div>
          <span style={{fontSize:11,color:C.dim}}>{(maskAllFinance||maskDebts)?'скрыто':'показано'}</span>
        </label>
        <label className="row-hover" style={{...S.taskRow, cursor:'pointer', opacity:maskAllFinance?0.5:1}}>
          <input type="checkbox" checked={!!maskOps} disabled={maskAllFinance} onChange={()=>setSettingFlag('maskOps', !maskOps)} />
          <div style={{flex:1}}>Операции: доходы, расходы, планы, платежи</div>
          <span style={{fontSize:11,color:C.dim}}>{(maskAllFinance||maskOps)?'скрыто':'показано'}</span>
        </label>
      </SettingsSection>

      <SettingsSection title="Что показывать (модули и графики)" icon="📊">
        <div style={{...S.dimSpan,marginLeft:0,marginBottom:8,display:'block'}}>Выключенные модули и графики скрываются из приложения. Настройка синхронизируется между устройствами.</div>
        {MODULE_GROUPS.map((g,gi)=>(
          <div key={g.group}>
            {gi>0 && <SettingsDivider/>}
            <SubHead>{g.group}</SubHead>
            {g.items.map(it=>(
              <label key={it.id} className="row-hover" style={{...S.taskRow, cursor:'pointer'}}>
                <input type="checkbox" checked={!hidden[it.id]} onChange={()=>toggleModule(it.id)} />
                <div style={{flex:1, color: hidden[it.id]?C.dim:C.text}}>{it.label}</div>
                <span style={{fontSize:11, color:C.dim}}>{hidden[it.id]?'скрыто':'показано'}</span>
              </label>
            ))}
          </div>
        ))}
      </SettingsSection>

      <SettingsSection title="О приложении" icon="ℹ️">
        <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>Life OS</div>
        <div style={{...S.dimSpan,marginLeft:0,marginBottom:12,display:'block'}}>Персональный трекер жизни: планирование, привычки, цели, финансы и рефлексия в одном месте — с геймификацией, чтобы держать ритм.</div>

        <SubHead>Что умеет</SubHead>
        <div style={{fontSize:12.5,lineHeight:1.7,color:C.text}}>
          <div>📅 <b>Сегодня</b> — задачи дня (сложность→XP), ежедневные и многодневные дела, теги, оценка дня, сон, заметка. Перенос незакрытых задач и шаблоны наборов.</div>
          <div>🔁 <b>Привычки</b> — расписание, сгорающий стрик, заморозки, челленджи, напоминания, архив.</div>
          <div>🎯 <b>Цели</b> — год/месяц/неделя/день; ползунок/чек-лист/счётчик; периодизация с архивом; привязка задач к нескольким целям.</div>
          <div>🗂 <b>Дела</b> — эпики, статусы, важность/срочность, дедлайны, архив.</div>
          <div>📝 <b>Заметки</b> — заметки и напоминания (с повтором), закрепление, чек-листы.</div>
          <div>💰 <b>Финансы</b> — операции, счета, должники, планы по месяцам, бюджет-алерты с прогнозом, графики.</div>
          <div>📊 <b>Статистика</b> — дисциплин-грид, обзор за период, тренды, план/факт, анализ факторов оценки дня.</div>
          <div>🏅 <b>Геймификация</b> — XP и уровень, стрик, здоровье, ⚡импульс, ~286 достижений.</div>
          <div>🔔 <b>Уведомления</b> — привычки, напоминания, дедлайны, утренняя сводка (на телефоне).</div>
          <div>☁ <b>Синхронизация и бэкап</b> — Firebase (вход Google), экспорт/импорт JSON и Excel, «Поделиться» на телефоне.</div>
        </div>

        <SettingsDivider/>
        <SubHead>Как считается уровень</SubHead>
        <div style={{fontSize:12.5,lineHeight:1.7,color:C.text}}>
          Уровень растёт от <b>XP</b> (100 XP = уровень). XP даётся за: выполнение задач (по сложности), ежедневные (±10), многодневные дела (+15), дела со статусом «Выполнено» (+15), привычки (±10), закрытие целей (+20) и <b>за новые достижения</b> (обычная +5 … легендарная +50). XP снимается при откате действия.
        </div>

        <SettingsDivider/>
        <div style={{fontSize:12,color:C.dim}}>Версия сборки: <b style={{color:C.text}}>{BUILD_ID}</b></div>
        <div style={{fontSize:11,color:C.dim,marginTop:4}}>Данные хранятся на устройстве (localStorage) и в облаке при входе. Полный бэкап — экспорт JSON.</div>
      </SettingsSection>
    </div>
  );
}

// ---------- styles ----------
const S = {
  root:{background:C.bg,color:C.text,minHeight:'100vh',fontFamily:"'Inter',sans-serif",padding:'20px 20px 40px',maxWidth:1040,margin:'0 auto'},
  header:{display:'flex',justifyContent:'space-between',alignItems:'flex-end',flexWrap:'wrap',gap:16,marginBottom:18,paddingBottom:16,borderBottom:`1px solid ${C.border}`},
  eyebrow:{fontFamily:"'JetBrains Mono',monospace",fontSize:11,letterSpacing:'.12em',color:C.dim,marginBottom:4},
  h1:{fontFamily:"'Space Grotesk',sans-serif",fontSize:24,fontWeight:700,textTransform:'capitalize'},
  h1compact:{fontFamily:"'Space Grotesk',sans-serif",fontSize:18,fontWeight:700,textTransform:'capitalize'},
  gauges:{display:'flex',gap:18,alignItems:'center',flexWrap:'wrap'},
  gauge:{display:'flex',alignItems:'center',gap:8},
  miniGauge:{display:'flex',alignItems:'center',gap:5},
  profileBtn:{background:C.panelAlt,border:`1px solid ${C.border}`,borderRadius:'50%',width:38,height:38,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'},
  profTile:{display:'flex',alignItems:'center',gap:10,background:C.panelAlt,border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 14px'},
  gaugeVal:{fontFamily:"'JetBrains Mono',monospace",fontSize:15,fontWeight:700},
  gaugeLabel:{fontSize:10.5,color:C.dim},
  gaugeBarWrap:{width:64,height:4,background:C.panelAlt,borderRadius:2,marginTop:4,overflow:'hidden'},
  gaugeBarFill:{height:'100%',background:C.cyan},
  exportBtn:{background:C.panelAlt,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 12px',color:C.text,fontSize:12.5,cursor:'pointer'},
  nav:{display:'flex',gap:4,marginBottom:20,flexWrap:'wrap'},
  tabBtn:{background:'transparent',border:'none',cursor:'pointer',padding:'9px 14px',fontSize:13.5,fontWeight:500,borderRadius:'6px 6px 0 0'},
  panel:{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:16,marginBottom:16},
  panelTitle:{fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:700,marginBottom:10},
  dimSpan:{color:C.dim,fontSize:12,fontWeight:400,marginLeft:6},
  inputRow:{display:'flex',gap:8,flexWrap:'wrap'},
  input:{flex:1,minWidth:100,background:C.panelAlt,border:`1px solid ${C.border}`,borderRadius:6,padding:'9px 10px',color:C.text,fontSize:13.5,outline:'none'},
  select:{background:C.panelAlt,border:`1px solid ${C.border}`,borderRadius:6,padding:'9px 10px',color:C.text,fontSize:13.5,outline:'none'},
  textarea:{width:'100%',background:C.panelAlt,border:`1px solid ${C.border}`,borderRadius:6,padding:10,color:C.text,fontSize:13.5,outline:'none',resize:'vertical'},
  iconBtnAmber:{background:C.amber,border:'none',borderRadius:6,width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#1A1200',flexShrink:0,fontSize:16},
  counterBtn:{background:'transparent',border:'none',color:C.amber,width:36,height:36,fontSize:19,fontWeight:600,lineHeight:1,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'},
  navArrow:{background:C.panelAlt,border:`1px solid ${C.border}`,borderRadius:6,width:28,height:28,color:C.text,cursor:'pointer'},
  taskRow:{display:'flex',alignItems:'center',gap:10,padding:'8px 6px',borderRadius:6},
  emptyState:{color:C.dim,fontSize:13,fontStyle:'italic',padding:'8px 2px'},
  grid2:{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:16},
  grid3:{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)',gap:16},
  statCard:{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:14},
  statVal:{fontFamily:"'JetBrains Mono',monospace",fontSize:17,fontWeight:700},
  toastWrap:{position:'fixed',right:16,bottom:16,display:'flex',flexDirection:'column',gap:8,zIndex:60,maxWidth:'calc(100vw - 32px)'},
  toast:{display:'flex',alignItems:'center',gap:12,background:C.panelAlt,border:`1px solid ${C.amber}`,borderRadius:10,padding:'10px 14px',boxShadow:'0 8px 28px rgba(0,0,0,.45)',minWidth:230},
  // --- мобильная навигация ---
  bottomNav:{position:'fixed',left:0,right:0,bottom:0,display:'flex',background:C.panel,borderTop:`1px solid ${C.border}`,zIndex:40,padding:'6px 4px',paddingBottom:'max(6px, env(safe-area-inset-bottom))'},
  bottomItem:{flex:1,background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'4px 2px'},
  sheetOverlay:{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:50,display:'flex',alignItems:'flex-end'},
  sheet:{width:'100%',background:C.panel,borderTop:`1px solid ${C.border}`,borderRadius:'16px 16px 0 0',padding:'10px 16px calc(20px + env(safe-area-inset-bottom))',maxHeight:'82vh',overflowY:'auto'},
  sheetGrab:{width:40,height:4,background:C.border,borderRadius:2,margin:'4px auto 8px'},
  sheetSection:{fontSize:11,letterSpacing:'.1em',color:C.dim,textTransform:'uppercase',margin:'16px 0 8px'},
  sheetGrid:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(72px,1fr))',gap:8},
  sheetTile:{background:C.panelAlt,border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 6px',display:'flex',flexDirection:'column',alignItems:'center',gap:6,cursor:'pointer',color:C.text},
  sheetRow:{display:'block',width:'100%',textAlign:'left',background:C.panelAlt,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 14px',color:C.text,fontSize:13.5,cursor:'pointer'},
  sheetBtn:{background:C.panelAlt,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',color:C.text,fontSize:13,cursor:'pointer',flex:1,minWidth:90},
  // --- модальное окно (редактор заметки и т.п.) ---
  modalOverlay:{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:16},
  modalCard:{width:'100%',maxWidth:560,maxHeight:'88vh',overflowY:'auto',background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:'18px 18px 22px',boxShadow:'0 20px 60px rgba(0,0,0,.55)'},
  // --- сегмент-переключатель (статус «Дел» и т.п.) ---
  seg:{display:'inline-flex',gap:4,background:C.panelAlt,border:`1px solid ${C.border}`,borderRadius:8,padding:3},
  segBtn:{border:'none',background:'transparent',cursor:'pointer',padding:'5px 10px',borderRadius:6,fontSize:12,fontWeight:600},
};

export default App;
