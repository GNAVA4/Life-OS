import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Chart, registerables } from 'chart.js';
// xlsx грузится лениво (динамический import в exportExcel) — иначе ~400КБ в стартовом бандле. session 022.
import { onAuth, login, logout, getCloudState, pushKey, subscribe, LIFEOS_KEYS } from './sync.js';
import { saveOrShare } from './backup.js';
import { updateTodayWidget } from './widget.js';
import { syncNotifications, requestNotif, testNotification, notifDiagnostics } from './notifications.js';

// ---------- декомпозиция: чистые константы/хелперы/стили вынесены в ./lib (session: decompose) ----------
import { C, PIE_COLORS } from './lib/theme.js';
import { S } from './lib/styles.js';
import { BUILD_ID, EXPENSE_DEFAULT, INCOME_DEFAULT, TAGS_DEFAULT, ANTITAGS_DEFAULT, DEFAULT_ACCOUNTS, STUDY_PRIORITIES, STUDY_STATUSES, STUDY_IMPORTANCE, STUDY_URGENCY, IMPORTANCE_COLOR, URGENCY_COLOR, STATUS_COLOR, NOTE_TYPES, NOTE_REPEATS, NOTE_TYPE_COLOR, WEEKDAY_OPTS, weekdayLabel, BASE_EPICS, PERIOD_SCOPES, PERIOD_LABEL, DIFF_XP, GL_SCOPE } from './lib/constants.js';
import { toLocalISODate, todayStr, addDays, daysAgoStr, isoWeek, daysBetween, formatDateRu, formatDateShort, openDatePicker, shiftMonth, monthLabelRu, periodOf } from './lib/dates.js';
import { fmtMoney, maskMoney, uid, compactNum } from './lib/format.js';
import { loadKey, saveKey, setPushHook, setHiddenModules, vis, MODULE_GROUPS } from './lib/storage.js';
import { GAMIFY_DEFAULT, IMPULSE_DECAY_DAYS, HEALTH_MISSED_HABIT_CAP, COMBO_CAP_DAYS, WEEKLY_XP, LEVEL_CAP, LEVEL_CUM, QUEST_POOL, WEEKLY_POOL, RANKS, gamifyCfg, pickSeeded, questsForDate, weeklyForPeriod, levelForXp, rankForLevel, nextRank, playLevelUpSound, playAchSound, impulsePenaltyRemaining } from './lib/gamify.js';
import { HABIT_WD, isHabitScheduled, habitDoneOn, habitCompletedCount, habitScheduleLabel, habitCurrentStreak, habitBestStreak, habitChallengeDone } from './lib/habits.js';
import { snapshotValueRub, accountBalanceOn, accountBalanceNow, unassignedNetOn, migratePlans } from './lib/finance.js';
import { isLegacyNote, migrateNotes, mergeStudyById, noteTitleOf, notePreviewOf, repeatLabel, reminderWhenLabel, hasReminderWhen } from './lib/notes.js';
import { goalLinkOptions, goalByKey, goalLinksOf } from './lib/goals.js';
import { ACH_TIERS, ACHIEVEMENTS, ACH_GROUPS, computeAchStats, achValDisplay, longestRun } from './lib/achievements.js';
import { axisColor, gridColor, baseChartOpts } from './lib/charts.js';
import { Select, Modal, ConfirmIconBtn, SettingsSection, SubHead, SettingsDivider, StatusSeg } from './ui/primitives.jsx';
import { GoalLinkPicker } from './ui/GoalLinkPicker.jsx';
import { RolloverModal } from './ui/RolloverModal.jsx';
import { ChartCanvas } from './ui/ChartCanvas.jsx';
import { useIsMobile } from './ui/useIsMobile.js';
import { TodayTab } from './tabs/TodayTab.jsx';
import { HabitsTab } from './tabs/HabitsTab.jsx';
import { GoalsTab } from './tabs/GoalsTab.jsx';
import { StudyTab } from './tabs/StudyTab.jsx';
import { NotesTab } from './tabs/NotesTab.jsx';
import { FinanceTab } from './tabs/FinanceTab.jsx';
import { StatsTab } from './tabs/StatsTab.jsx';
import { AchievementsTab } from './tabs/AchievementsTab.jsx';
import { SettingsTab } from './tabs/SettingsTab.jsx';
import { TAB_META, ALL_MOBILE_TAB_IDS, DEFAULT_MOBILE_TABS } from './lib/constants.js';

Chart.register(...registerables);



// ============================================================
function App(){
  const [tab,setTab] = useState('today');
  const isMobile = useIsMobile();
  const [sheetOpen,setSheetOpen] = useState(false);
  const [days,setDays] = useState({});
  const [dailyTasks,setDailyTasks] = useState([]);
  const [ongoing,setOngoing] = useState([]);
  const [tags,setTags] = useState(TAGS_DEFAULT);
  const [antiTags,setAntiTags] = useState(ANTITAGS_DEFAULT);
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
  const [levelUp,setLevelUp] = useState(null); // {level, rank} — грандиозный баннер при новом уровне
  const [selectedDate,setSelectedDate] = useState(todayStr());
  const [profileOpen,setProfileOpen] = useState(false);
  const [goalsArchive,setGoalsArchive] = useState([]);
  const [habitsArchive,setHabitsArchive] = useState([]);
  const [studyArchive,setStudyArchive] = useState([]);
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
    setAntiTags(loadKey('lifeos:antiTags', ANTITAGS_DEFAULT));
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

    // health recompute (session 024): день отдыха (не было задач/привычек) — НЕ штрафуем.
    // −10 только если задачи были и ничего не сделано. Плюс штрафы: анти-теги, пропущенные
    // запланированные привычки, просроченные дедлайны дел. +5 за активный день (cap 100).
    const loadedDays = loadKey('lifeos:days', {});
    const loadedHabits = loadKey('lifeos:habits', []);
    const loadedStudy = loadKey('lifeos:study', []);
    const gcfg = gamifyCfg(loadKey('lifeos:settings', {}));
    let m = loadKey('lifeos:meta', {xp:0, health:100, lastHealthCheck: todayStr()});
    let cursor = m.lastHealthCheck || todayStr();
    const t = todayStr();
    let steps = 0;
    let health = m.health ?? 100;
    while (cursor < t && steps < 60){
      const dayE = loadedDays[cursor] || {};
      const hasActivity = (dayE.tasks||[]).some(x=>x.done) ||
        Object.values(dayE.dailyCompletions||{}).some(Boolean) ||
        loadedHabits.some(h => h.log && h.log[cursor]);
      const hadTasks = (dayE.tasks||[]).length>0; // были одноразовые задачи на этот день
      const missedHabits = loadedHabits.filter(h => isHabitScheduled(h,cursor) && !(h.log && h.log[cursor])).length;
      let delta = 0;
      if(hasActivity) delta += 5;
      else if(hadTasks) delta -= 10;            // задачи были, а день пуст → штраф
      // else: день отдыха (нет задач и активности) → 0
      delta -= gcfg.hpAnti * (dayE.antiTags||[]).length;                       // анти-теги
      delta -= Math.min(HEALTH_MISSED_HABIT_CAP, gcfg.hpHabit * missedHabits);  // провал привычки
      // просроченный дедлайн дела: разово, на следующий день после дедлайна
      loadedStudy.forEach(x=>{ if(!x.deadline) return;
        const overdue = (x.status!=='Выполнено') || (x.completedAt && x.completedAt> x.deadline);
        if(overdue && cursor === addDays(x.deadline,1)) delta -= gcfg.hpDeadline;
      });
      health = Math.max(0, Math.min(100, health + delta));
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
        case 'lifeos:antiTags': setAntiTags(v); break;
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
    setPushHook(u ? (key, valStr) => pushKey(u.uid, key, valStr) : null);
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
    antiTags: (n)=>{setAntiTags(n); saveKey('lifeos:antiTags',n);},
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
  const gamify = gamifyCfg(settings); // настраиваемые значения геймификации (session 024)
  // Состояние сворачивания секций (цели/дела/алерты) — хранится в settings.collapse, переживает перезаход. session 024
  const collapseState = settings.collapse || {};
  const toggleCollapse = (kind, key) => {
    const c = {...(settings.collapse||{})}; const sub = {...(c[kind]||{})};
    sub[key] = !sub[key]; c[kind] = sub;
    persist.settings({...settings, collapse:c});
  };
  // Скрыть конкретный бюджет-алерт (по месяцу+категории — на следующий месяц вернётся). session 024
  const dismissAlert = (key) => { const d={...(settings.dismissedAlerts||{})}; d[key]=true; persist.settings({...settings, dismissedAlerts:d}); };

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
  // Анти-тег на дне: отметка снимает XP, снятие возвращает (обратимо, как задача). Здоровье — на replay. session 024
  const toggleAntiTagOnDay = (name) => {
    const cur = entry.antiTags||[]; const on = cur.includes(name);
    updateEntry({antiTags: on ? cur.filter(x=>x!==name) : [...cur,name]});
    addXp(on ? gamify.antiXp : -gamify.antiXp);
  };
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
  const addAntiTagGlobal = (name) => { if(!antiTags.includes(name)) persist.antiTags([...antiTags,name]); };
  const removeAntiTagGlobal = (name) => persist.antiTags(antiTags.filter(t=>t!==name));

  // новая цель — БЕЗ трекера (mode:'none'); привязана к текущему периоду (нед/мес/год)
  const addGoal = (scope,text) => persist.goals({...goals,[scope]:[...(goals[scope]||[]),{id:uid(),title:text,progress:0,mode:'none',period:periodOf(scope)}]});
  const persistArchive = (n) => { setGoalsArchive(n); saveKey('lifeos:goalsArchive', n); };
  const restoreGoal = (id, archivedAt) => {
    const g = goalsArchive.find(x=>x.id===id && x.archivedAt===archivedAt); if(!g) return;
    const {archivedAt:_a, scope, ...rest} = g; const sc = scope || 'week';
    persist.goals({...goals, [sc]:[...(goals[sc]||[]), {...rest, period:periodOf(sc)}]});
    persistArchive(goalsArchive.filter(x=>!(x.id===id && x.archivedAt===archivedAt)));
  };
  const deleteArchivedGoal = (id, archivedAt) => persistArchive(goalsArchive.filter(x=>!(x.id===id && x.archivedAt===archivedAt)));
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
  // Смена типа трекера НЕ стирает данные: counter и subtasks сохраняются (можно случайно переключить
  // и вернуться без потери прогресса). Меняем только mode + пересчитываем показываемый progress из
  // активного источника. session: goal-mode-preserve.
  const setGoalMode = (scope,id,mode) => {
    const list = goals[scope].map(g=>{ if(g.id!==id) return g;
      if(mode==='subtasks'){ const sub=g.subtasks||[]; return {...g, mode:'subtasks', subtasks:sub, progress: sub.length?Math.round(sub.filter(s=>s.done).length/sub.length*100):(g.progress||0)}; }
      if(mode==='counter'){ const counter=g.counter||{current:0,target:10}; return {...g, mode:'counter', counter, progress:Math.min(100,Math.round((counter.current||0)/counter.target*100))}; }
      // 'none' и 'slider' — сохраняем текущий progress и уже накопленные counter/subtasks
      return {...g, mode};
    });
    persist.goals({...goals,[scope]:list});
  };
  const setGoalDeadline = (scope,id,deadline) => {
    persist.goals({...goals,[scope]:(goals[scope]||[]).map(g=> g.id===id ? {...g, deadline: deadline||undefined} : g)});
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
        const n = await syncNotifications({habits: habitsForNotif(), notes, study, bills, deadlineCfg: settings.deadlineNotif, morningCfg: settings.morningSummary, billsCfg: settings.billsNotif, morningBody: computeMorningBody(), enabled:true});
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
  const updateBill = (id,patch) => persist.bills(bills.map(b=>b.id===id?{...b,...patch}:b));

  const addHabit = (habit) => persist.habits([...habits, {id:uid(), createdAt:todayStr(), log:{}, ...habit}]);
  const updateHabit = (id, patch) => persist.habits(habits.map(h=>h.id===id?{...h,...patch}:h));
  const deleteHabit = (id) => persist.habits(habits.filter(h=>h.id!==id));
  const persistHabitsArchive = (n) => { setHabitsArchive(n); saveKey('lifeos:habitsArchive', n); };
  // в архив: убираем из активных, сохраняем привычку целиком + снимок статистики (стрик/выполнено) на момент архивации
  const archiveHabit = (id, outcome='completed') => {
    const h = habits.find(x=>x.id===id); if(!h) return;
    const t = todayStr();
    const snap = {...h, archivedAt:t, outcome, bestStreak:habitBestStreak(h,t), completedCount:habitCompletedCount(h), challengeDone:habitChallengeDone(h)};
    persistHabitsArchive([...habitsArchive, snap]);
    persist.habits(habits.filter(x=>x.id!==id));
  };
  // «сдаться»: провал → в архив + разовый штраф здоровья и импульса (импульс затухает за 7 дней). session: habit-surrender-penalty
  const abandonHabit = (id) => {
    if(!habits.some(x=>x.id===id)) return;
    archiveHabit(id, 'failed');
    const t = todayStr();
    const remaining = impulsePenaltyRemaining(meta.impulsePenalty, t);
    const nm = { ...meta,
      health: Math.max(0, Math.min(100, (meta.health ?? 100) - gamify.hpSurrender)),
      impulsePenalty: { amt: remaining + gamify.impSurrender, date: t } };
    setMeta(nm); saveKey('lifeos:meta', nm);
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

  const {level,into,needed,max:levelMax} = levelForXp(meta.xp||0);
  const rank = rankForLevel(level);
  const mountAtRef = useRef(Date.now()); // общее mount-окно для гейта тостов/баннеров

  // 🎉 Level-up: грандиозный баннер + салют + звук при РОСТЕ уровня. session 024.
  // Гейтим mount-окном (как достижения): скачок уровня в первые секунды (загрузка meta/синк) — молча,
  // только настоящий рост в сессии (закрыл задачу → уровень вырос) даёт баннер.
  const prevLevelRef = useRef(null);
  useEffect(() => {
    const prev = prevLevelRef.current;
    prevLevelRef.current = level;
    if(prev === null) return;
    const silent = (Date.now() - mountAtRef.current) < 4000;
    if(!silent && level > prev){
      setLevelUp({ level, rank: rankForLevel(level) });
      if(!settings.soundOff) playLevelUpSound();
    }
  }, [level]); // eslint-disable-line
  useEffect(() => { if(!levelUp) return; const t=setTimeout(()=>setLevelUp(null), 5200); return ()=>clearTimeout(t); }, [levelUp]);

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
    const base = Math.min(100, Math.round(c/21*100));
    return Math.max(0, Math.round(base - impulsePenaltyRemaining(meta.impulsePenalty))); // −штраф за «сдаться» (затухает)
  }, [days, habits, meta.impulsePenalty]);

  // 🔗 Комбо: сколько дней ПОДРЯД была активность (задача/ежедневная/привычка), считая от сегодня
  // (или со вчера, если сегодня ещё пусто). Множитель для показа: ×1.0…×2.0 (cap на COMBO_CAP_DAYS).
  // Бонус за комбо начисляется раз в день при первой активности (см. эффект ниже). session 024.
  const combo = useMemo(() => {
    const activeOn = (ds) => (days[ds]?.tasks||[]).some(t=>t.done)
      || Object.values(days[ds]?.dailyCompletions||{}).some(Boolean)
      || habits.some(h => h.log && h.log[ds]);
    let streak = 0, cur = todayStr();
    if(!activeOn(cur)) cur = addDays(cur,-1); // сегодня ещё не начато — не рвём вчерашнее комбо
    while(activeOn(cur)){ streak++; cur = addDays(cur,-1); }
    const mult = 1 + 0.1 * Math.min(streak, COMBO_CAP_DAYS);
    return { streak, mult };
  }, [days, habits]);

  // 🎯 Задания дня (для СЕГОДНЯ): детерминированный набор из 3, со статусом выполнения/начисления. session 024
  const todayQuests = useMemo(() => {
    const t = todayStr(); const e = days[t] || {};
    const ctx = {
      tasksDone:(e.tasks||[]).filter(x=>x.done).length,
      taskTotal:(e.tasks||[]).length,
      dailyDone:Object.values(e.dailyCompletions||{}).filter(Boolean).length,
      hasDailies:(dailyTasks||[]).length>0,
      habitDone:habits.filter(h=>h.log&&h.log[t]).length,
      hasHabits:habits.length>0,
      rated:e.rating!=null, noted:!!(e.note&&e.note.trim()),
      antiCount:(e.antiTags||[]).length, sleep:e.sleepHours??0,
    };
    const claimed = e.questsClaimed||[];
    return questsForDate(t, ctx).map(q=>({ id:q.id, icon:q.icon, label:q.label, xp:q.xp, done:q.done(ctx), claimed:claimed.includes(q.id) }));
  }, [days, habits, dailyTasks]);

  // 🏆 Испытание недели (текущая ISO-неделя): прогресс + статус начисления. session 024
  const weekly = useMemo(() => {
    const period = periodOf('week'); const chal = weeklyForPeriod(period);
    let tasksDone=0, perfectDays=0, activeDays=0, ratedDays=0;
    Object.entries(days).forEach(([ds,e])=>{ if(periodOf('week',ds)!==period) return;
      const dn=(e.tasks||[]).filter(x=>x.done).length + Object.values(e.dailyCompletions||{}).filter(Boolean).length;
      tasksDone+=dn;
      const tot=(e.tasks||[]).length; if(tot>=3 && (e.tasks||[]).every(x=>x.done)) perfectDays++;
      if(dn>0 || (e.tags||[]).length>0 || e.rating!=null || (e.note&&e.note.trim()) || e.sleepHours!=null) activeDays++;
      if(e.rating!=null) ratedDays++;
    });
    const studyDone = study.filter(x=>x.status==='Выполнено' && x.completedAt && periodOf('week',x.completedAt)===period).length;
    const cur = chal.val({tasksDone,perfectDays,activeDays,ratedDays,studyDone});
    return { period, chal, cur, target:chal.target, done:cur>=chal.target, claimed:!!((meta.weeklyClaimed||{})[period]) };
  }, [days, study, meta]);

  // Начисление: комбо-бонус (раз в день при первой активности) + бонусы за выполненные задания дня.
  // Один общий patch дня, чтобы эффекты не затирали друг друга. Гейт mount-окном — на загрузке молча. session 024
  useEffect(() => {
    const t = todayStr(); const e = days[t]; if(!e) return;
    let patch = null;
    const activeToday = (e.tasks||[]).some(x=>x.done) || Object.values(e.dailyCompletions||{}).some(Boolean) || habits.some(h=>h.log&&h.log[t]);
    let comboBonus = 0;
    if(activeToday && !e.comboClaimed){ comboBonus = gamify.comboBonus*Math.min(combo.streak, COMBO_CAP_DAYS); patch = {...(patch||e), comboClaimed:true}; }
    const claimed = (patch||e).questsClaimed || [];
    const newly = todayQuests.filter(q=>q.done && !claimed.includes(q.id));
    let questBonus = 0;
    if(newly.length){ questBonus = newly.reduce((s,q)=>s+q.xp,0); patch = {...(patch||e), questsClaimed:[...claimed, ...newly.map(q=>q.id)]}; }
    if(!patch) return;
    persist.days({...days, [t]:patch});
    const total = comboBonus + questBonus; if(total>0) addXp(total);
    const silent = (Date.now()-mountAtRef.current) < 4000;
    if(!silent){
      const add=[];
      if(comboBonus>0) add.push({tid:uid(), combo:comboBonus, streak:combo.streak});
      newly.forEach(q=>add.push({tid:uid(), quest:q.label, xp:q.xp}));
      if(add.length) setToasts(prev=>[...prev, ...add]);
    }
  }, [days, habits, combo.streak, todayQuests]); // eslint-disable-line

  // Начисление награды за испытание недели (разово за неделю).
  useEffect(() => {
    if(!weekly.done || weekly.claimed) return;
    const wc = {...(meta.weeklyClaimed||{}), [weekly.period]:true};
    const nm = {...meta, weeklyClaimed:wc}; setMeta(nm); saveKey('lifeos:meta', nm);
    addXp(WEEKLY_XP);
    const silent = (Date.now()-mountAtRef.current) < 4000;
    if(!silent) setToasts(prev=>[...prev, {tid:uid(), weekly:weekly.chal.label}]);
  }, [weekly.done, weekly.claimed]); // eslint-disable-line

  // приватность финансов — флаги маскировки (объявлено ДО coachInsights: он читает finMask.ops). session 025 (был баг TDZ)
  const finMask = {
    net:   !!(settings.maskAllFinance || settings.maskNetWorth),
    debts: !!(settings.maskAllFinance || settings.maskDebts),
    ops:   !!(settings.maskAllFinance || settings.maskOps),
  };

  // 🧠 «Тренер»: проактивные инсайты на «Сегодня» (session 025). Правила-подсказки + риски из данных.
  const coachInsights = useMemo(() => {
    const out=[]; const t=todayStr(); const mm=(n)=>maskMoney(finMask.ops, n);
    // прогресс уровня/ранга
    if(!levelMax){ const nr=nextRank(level);
      out.push({icon:'🏆', text: nr ? `До ранга «${nr.name}» — ${nr.min-level} ур. · до след. уровня ${needed-into} XP` : `До следующего уровня — ${needed-into} XP`}); }
    // привычки под угрозой (запланирована сегодня, ещё не отмечена, стрик до вчера ≥3)
    habits.forEach(h=>{ if(isHabitScheduled(h,t) && !(h.log&&h.log[t])){ const st=habitCurrentStreak(h, addDays(t,-1));
      if(st>=3) out.push({icon:'⚠️', tone:'warn', text:`Стрик привычки «${h.name}» под угрозой (${st} дн.) — сегодня ещё не отмечено`}); } });
    // серия/комбо
    if(combo.streak>=3) out.push({icon:'🔥', text:`${combo.streak} дней активности подряд — комбо ×${combo.mult.toFixed(1)}. Не прерывай!`});
    // задания дня
    const qLeft=todayQuests.filter(q=>!q.done).length;
    if(qLeft>0 && qLeft<todayQuests.length) out.push({icon:'🎯', text:`Осталось заданий дня: ${qLeft}`});
    // сон ↔ оценка (последние 30 дней)
    { const hi=[],lo=[]; for(let i=0;i<30;i++){ const e=days[daysAgoStr(i)]; if(e&&e.rating!=null&&e.sleepHours!=null) (e.sleepHours>=7?hi:lo).push(e.rating); }
      if(hi.length>=4 && lo.length>=4){ const avg=a=>a.reduce((s,x)=>s+x,0)/a.length; const d=avg(hi)-avg(lo);
        if(Math.abs(d)>=0.8) out.push({icon:'😴', text:`В дни со сном 7ч+ оценка ${d>0?'выше':'ниже'} на ${Math.abs(Math.round(d*10)/10)} балла — ${d>0?'высыпайся':'обрати внимание'}`}); } }
    // расходы месяца против плана
    { const ym=t.slice(0,7); const plan=Object.values(budgets[ym]||{}).reduce((s,v)=>s+(v||0),0);
      if(plan>0){ const spent=finance.transactions.filter(x=>!x.exclude&&x.type==='expense'&&x.date.slice(0,7)===ym).reduce((s,x)=>s+x.amount,0);
        if(spent>plan) out.push({icon:'💸', tone:'warn', text:`Расходы месяца превысили план на ${mm(spent-plan)}`});
        else if(spent>plan*0.85) out.push({icon:'💸', text:`Потрачено ${Math.round(spent/plan*100)}% месячного плана`}); } }
    // приоритет: сначала предупреждения
    return out.sort((a,b)=>(b.tone==='warn'?1:0)-(a.tone==='warn'?1:0)).slice(0,4);
  }, [days, habits, finance.transactions, budgets, combo, todayQuests, level, into, needed, levelMax, finMask.ops]);

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
  const achStats = useMemo(()=>computeAchStats({days,goals,study,notes,finance,meta,ongoing,budgets,habits,goalsArchive,studyArchive,habitsArchive}),
    [days,goals,study,notes,finance,meta,ongoing,budgets,habits,goalsArchive,studyArchive,habitsArchive]);
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
  useEffect(() => { syncNotifications({ habits: habitsForNotif(), notes, study, bills, deadlineCfg: settings.deadlineNotif, morningCfg: settings.morningSummary, billsCfg: settings.billsNotif, morningBody: computeMorningBody(), enabled: !settings.notifOff }); }, [habits, notes, study, bills, settings.notifOff, settings.deadlineNotif, settings.morningSummary, settings.billsNotif]);
  // Android-виджет «Задачи на сегодня»: пишем прогресс по одноразовым задачам СЕГОДНЯ (session 023).
  useEffect(() => { const t = todayStr(); const e = days[t] || {}; const tasks = e.tasks || [];
    updateTodayWidget(tasks.filter(x=>x.done).length, tasks.length, t); }, [days]);
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

  setHiddenModules(settings.hidden);
  // приблизительная занятость localStorage (ключи lifeos:*). Квота WebView/браузера обычно ~5 МБ;
  // предупреждаем на 80% (≈4 МБ), т.к. при переполнении setItem бросает и данные не сохранятся.
  // UTF-16 → 2 байта/символ (порог не обсуждался — разумный дефолт, см. OPEN.md). session 022.
  const LS_QUOTA = 5*1024*1024;
  let lsBytes = 0; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith('lifeos:')) lsBytes += (k.length + (localStorage.getItem(k)||'').length)*2; }
  const lsPct = Math.round(lsBytes/LS_QUOTA*100);
  // маски приватности финансов: master maskAllFinance перекрывает все типы. session 022.
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
          <div style={{display:'flex',alignItems:'center',gap:12,background:C.panelAlt,border:`1px solid ${rank.color}`,borderRadius:12,padding:'14px 16px',marginBottom:12}}>
            <span style={{fontSize:34,lineHeight:1}}>{rank.icon}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:17,fontWeight:800,color:rank.color}}>{rank.name}</div>
              <div style={{fontSize:11.5,color:C.dim}}>Ур. {level}{levelMax?' · МАКС':''}{nextRank(level)?` · до «${nextRank(level).name}» ${nextRank(level).min-level} ур.`:''}</div>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div style={S.profTile}><span style={{fontSize:20}}>🔥</span><div><div style={S.gaugeVal}>{streak}</div><div style={S.gaugeLabel}>дней подряд</div></div></div>
            <div style={S.profTile}><span style={{fontSize:20}}>❤</span><div style={{flex:1}}><div style={S.gaugeVal}>{meta.health ?? 100}</div><div style={S.gaugeBarWrap}><div style={{...S.gaugeBarFill, background:C.red, width:`${meta.health ?? 100}%`}}/></div></div></div>
            <div style={S.profTile}><span style={{fontSize:20}}>⚡</span><div style={{flex:1}}><div style={S.gaugeVal}>{impulse}</div><div style={S.gaugeBarWrap}><div style={{...S.gaugeBarFill, background:C.purple, width:`${impulse}%`}}/></div><div style={S.gaugeLabel}>импульс · 7 дней</div></div></div>
            <div style={S.profTile}><span style={{fontSize:20}}>🔗</span><div style={{flex:1}}><div style={S.gaugeVal}>×{combo.mult.toFixed(1)}</div><div style={S.gaugeBarWrap}><div style={{...S.gaugeBarFill, background:C.cyan, width:`${Math.min(100,combo.streak/COMBO_CAP_DAYS*100)}%`}}/></div><div style={S.gaugeLabel}>комбо · {combo.streak} дн.</div></div></div>
            <div style={{...S.profTile, gridColumn:'1 / -1'}}><span style={{fontSize:20}}>🏆</span><div style={{flex:1}}><div style={S.gaugeVal}>Ур. {level}{levelMax?' · МАКС':''}</div><div style={S.gaugeBarWrap}><div style={{...S.gaugeBarFill, width:`${levelMax?100:(into/needed)*100}%`}}/></div><div style={S.gaugeLabel}>{levelMax?'максимальный уровень':`${into}/${needed} XP`}</div></div></div>
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
        antiTags={antiTags} toggleAntiTagOnDay={toggleAntiTagOnDay} addAntiTagGlobal={addAntiTagGlobal} removeAntiTagGlobal={removeAntiTagGlobal} antiXp={gamify.antiXp} hpAnti={gamify.hpAnti}
        dailyTasks={dailyTasks} toggleDaily={toggleDaily} addDailyTask={addDailyTask} deleteDailyTask={deleteDailyTask}
        ongoing={ongoing} addOngoing={addOngoing} finishOngoing={finishOngoing} deleteOngoing={deleteOngoing}
        bills={bills} taskTemplates={taskTemplates} saveTaskTemplate={saveTaskTemplate} applyTaskTemplate={applyTaskTemplate} deleteTaskTemplate={deleteTaskTemplate}
        carryOverTasks={carryOverTasks} prevUndoneCount={prevUndoneTasks.length}
        isToday={selectedDate===todayStr()} quests={todayQuests} weekly={weekly} combo={combo} coachInsights={coachInsights}
        collapsedUI={collapseState.ui||{}} onToggleUI={(key)=>toggleCollapse('ui',key)} />}
      {tab==='habits' && <HabitsTab habits={habits} addHabit={addHabit} toggleHabitDay={toggleHabitDay} deleteHabit={deleteHabit} updateHabit={updateHabit} archiveHabit={archiveHabit} abandonHabit={abandonHabit} archive={habitsArchive} deleteArchivedHabit={deleteArchivedHabit} restoreHabit={restoreHabit} goals={goals} notifsOn={!settings.notifOff} />}
      {tab==='goals' && <GoalsTab goals={goals} addGoal={addGoal} setGoalProgress={setGoalProgress}
        addGoalSubtask={addGoalSubtask} toggleGoalSubtask={toggleGoalSubtask}
        deleteGoalSubtask={deleteGoalSubtask} deleteGoal={deleteGoal}
        setGoalMode={setGoalMode} setGoalCounter={setGoalCounter} setGoalDeadline={setGoalDeadline} archiveGoal={archiveGoal}
        showGoalDeadline={!!settings.showGoalDeadline}
        collapsed={collapseState.goals||{}} onToggleCollapse={(sc)=>toggleCollapse('goals',sc)}
        archive={goalsArchive} restoreGoal={restoreGoal} deleteArchivedGoal={deleteArchivedGoal} />}
      {tab==='study' && <StudyTab study={study} addStudyTask={addStudyTask} updateStudyTask={updateStudyTask} deleteStudyTask={deleteStudyTask} archiveStudyTask={archiveStudyTask} archive={studyArchive} deleteArchivedStudy={deleteArchivedStudy} restoreStudy={restoreStudy}
        collapsed={collapseState.study||{}} onToggleCollapse={(epic)=>toggleCollapse('study',epic)} />}
      {tab==='notes' && <NotesTab notes={notes} addNote={addNote} updateNote={updateNote} deleteNote={deleteNote} />}
      {tab==='finance' && <FinanceTab finance={finance} categories={categories} budgets={budgets} incomePlans={incomePlans} bills={bills} defaults={settings.defaults||{}}
        finMask={finMask} setSettingFlag={setSettingFlag}
        collapse={collapseState} toggleCollapse={toggleCollapse} dismissedAlerts={settings.dismissedAlerts||{}} dismissAlert={dismissAlert}
        addTransaction={addTransaction} deleteTransaction={deleteTransaction}
        addCategory={addCategory} removeCategory={removeCategory} setBudget={setBudget} removeBudget={removeBudget}
        setIncomePlan={setIncomePlan} removeIncomePlan={removeIncomePlan} setBudgetsBatch={setBudgetsBatch} setIncomePlansBatch={setIncomePlansBatch}
        addBill={addBill} deleteBill={deleteBill} updateBill={updateBill}
        addAccount={addAccount} deleteAccount={deleteAccount} addSnapshot={addSnapshot} deleteSnapshot={deleteSnapshot}
        addDebtor={addDebtor} updateDebtor={updateDebtor} deleteDebtor={deleteDebtor} />}
      {tab==='stats' && <StatsTab days={days} finance={finance} budgets={budgets} incomePlans={incomePlans} habits={habits} finMask={finMask} study={study} unlocked={achievements.unlocked||{}} />}
      {tab==='achievements' && <AchievementsTab stats={achStats} unlocked={achievements.unlocked||{}} />}
      {tab==='settings' && <SettingsTab hidden={settings.hidden||{}} toggleModule={toggleModule}
        defaults={settings.defaults||{}} setDefault={setDefault} categories={categories} accounts={finance.accounts}
        mobileTabs={mobileTabIds} toggleMobileTab={toggleMobileTab}
        soundOff={!!settings.soundOff} notifOff={!!settings.notifOff}
        maskNetWorth={!!settings.maskNetWorth} maskDebts={!!settings.maskDebts} maskOps={!!settings.maskOps} maskAllFinance={!!settings.maskAllFinance}
        morningCfg={settings.morningSummary||null} setSettingFlag={setSettingFlag}
        gamify={gamify} setGamify={(patch)=>persist.settings({...settings, gamify:{...gamify, ...patch}})}
        requestNotifs={requestNotifs} testNotif={testNotif} showNotifDiag={showNotifDiag} notifMsg={notifMsg} deadlineCfg={settings.deadlineNotif||null}
        showGoalDeadline={!!settings.showGoalDeadline} billsNotif={settings.billsNotif||null} />}
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
            if(t.combo){
              return (
                <div key={t.tid} className="anim-toast" style={{...S.toast, borderColor:C.cyan}}>
                  <span style={{fontSize:26}}>🔗</span>
                  <div>
                    <div style={{fontSize:10.5, color:C.cyan, letterSpacing:'.08em'}}>КОМБО · {t.streak} ДН.</div>
                    <div style={{fontSize:14, fontWeight:700}}>+{t.combo} XP</div>
                    <div style={{fontSize:11, color:C.dim}}>серия активных дней</div>
                  </div>
                </div>
              );
            }
            if(t.quest){
              return (
                <div key={t.tid} className="anim-toast" style={{...S.toast, borderColor:C.green}}>
                  <span style={{fontSize:26}}>🎯</span>
                  <div>
                    <div style={{fontSize:10.5, color:C.green, letterSpacing:'.08em'}}>ЗАДАНИЕ ДНЯ · +{t.xp} XP</div>
                    <div style={{fontSize:14, fontWeight:700}}>{t.quest}</div>
                  </div>
                </div>
              );
            }
            if(t.weekly){
              return (
                <div key={t.tid} className="anim-toast" style={{...S.toast, borderColor:C.amber}}>
                  <span style={{fontSize:26}}>🏆</span>
                  <div>
                    <div style={{fontSize:10.5, color:C.amber, letterSpacing:'.08em'}}>ИСПЫТАНИЕ НЕДЕЛИ · +{WEEKLY_XP} XP</div>
                    <div style={{fontSize:14, fontWeight:700}}>{t.weekly}</div>
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

      {levelUp && (
        <div style={S.levelUpOverlay} onClick={()=>setLevelUp(null)}>
          <div className="lo-confetti">
            {Array.from({length:36}).map((_,i)=>{
              const cols=[C.amber,C.cyan,C.green,C.purple,C.red,'#6FA8DC','#E0C36B'];
              return <span key={i} className="lo-confetti-piece" style={{ left:`${(i*2.8+3)%100}%`, background:cols[i%cols.length],
                animationDelay:`${(i%12)*0.12}s`, animationDuration:`${2.2+(i%5)*0.35}s`,
                transform:`rotate(${i*40}deg)`, width:i%3===0?9:6, height:i%3===0?14:9 }} />;
            })}
          </div>
          <div className="anim-levelup" style={S.levelUpCard}>
            <div style={{fontSize:12,letterSpacing:'.18em',color:C.amber,fontWeight:700}}>НОВЫЙ УРОВЕНЬ</div>
            <div style={{fontSize:72,fontWeight:900,lineHeight:1,margin:'6px 0',color:C.text,textShadow:`0 0 26px ${C.amber}`}}>{levelUp.level}</div>
            <div style={{fontSize:26}}>{levelUp.rank.icon}</div>
            <div style={{fontSize:16,fontWeight:800,color:levelUp.rank.color,marginTop:2}}>{levelUp.rank.name}</div>
            {levelMax && <div style={{fontSize:12,color:C.dim,marginTop:6}}>Максимальный уровень достигнут 👑</div>}
            <div style={{fontSize:11,color:C.dim,marginTop:10}}>нажми, чтобы закрыть</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================ Today

export default App;
