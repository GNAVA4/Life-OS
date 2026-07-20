// localStorage + зеркалирование в Firestore + видимость модулей.
export function loadKey(key, fallback){ try{ const raw=localStorage.getItem(key); if(raw) return JSON.parse(raw); }catch(e){} return fallback; }
// _pushHook is wired to Firestore when the user is signed in; every local write mirrors up.
// Мутируемый модульный стейт: App регистрирует хук через setPushHook (импортированную переменную переприсвоить нельзя).
let _pushHook = null;
export function setPushHook(fn){ _pushHook = fn; }
export function saveKey(key, value){
  const s = JSON.stringify(value);
  try{ localStorage.setItem(key, s); }catch(e){}
  try{ if(_pushHook) _pushHook(key, s); }catch(e){}
}

// ---------- module visibility (Settings tab) ----------
// _hidden is refreshed by App on every render (setHiddenModules); vis(id) is a plain lookup usable inline in any component.
let _hidden = {};
export function setHiddenModules(h){ _hidden = h || {}; }
export const vis = (id) => !_hidden[id];
export const MODULE_GROUPS = [
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
    {id:'today.coach', label:'🧠 Тренер (подсказки/инсайты)'},
    {id:'today.quests', label:'🎯 Задания дня (квесты)'},
    {id:'today.weekly', label:'🏆 Испытание недели'},
    {id:'today.tags', label:'Теги дня'},
    {id:'today.antitags', label:'Анти-теги дня (−XP, −здоровье)'},
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
    {id:'ops.safeToSpend', label:'💸 Свободно на сегодня'},
    {id:'ops.budgetAlerts', label:'Бюджет-алерты + прогноз'},
  ]},
  {group:'Финансы — активы', items:[
    {id:'assets.allocation', label:'Распределение (пирог)'},
    {id:'assets.netWorth', label:'Чистые активы во времени'},
    {id:'assets.accountTrends', label:'Баланс по счетам во времени'},
  ]},
  {group:'Статистика', items:[
    {id:'stats.recap', label:'📊 Итоги (сводка за период) — плитки ниже'},
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
    {id:'stats.antiTagFreq', label:'Частота анти-тегов'},
    {id:'stats.planfact', label:'План / факт по месяцу'},
  ]},
  {group:'Итоги — плитки', items:[
    {id:'recap.tasks', label:'Задач выполнено'},
    {id:'recap.perfect', label:'Идеальных дней'},
    {id:'recap.active', label:'Активных дней'},
    {id:'recap.habits', label:'Привычек отмечено'},
    {id:'recap.ach', label:'Достижений открыто'},
    {id:'recap.study', label:'Дел закрыто'},
    {id:'recap.rating', label:'Средняя оценка'},
    {id:'recap.sleep', label:'Средний сон'},
    {id:'recap.anti', label:'Анти-тегов'},
    {id:'recap.exp', label:'Расход'},
    {id:'recap.inc', label:'Доход'},
    {id:'recap.net', label:'Чистыми'},
    {id:'recap.highlights', label:'Лучший день · день недели · топ трат'},
  ]},
];
