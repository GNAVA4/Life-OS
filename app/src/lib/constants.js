// Доменные константы (пресеты, справочники, цвета-маппинги). Цвета берутся из токенов C.
import { C } from './theme.js';

// Видимый штамп сборки — показывается в Настройках. Меняй при каждой пересборке APK,
// чтобы точно знать, свежую версию установили или старую.
export const BUILD_ID = '2026-07-22e-goals-settings';

export const EXPENSE_DEFAULT = ['Еда','Кафе','Алкоголь','Табак','Транспорт','Учёба','Спорт','Развлечения','Подписки','Непредвиденные','Постоянные','Щедрость','Долг','Прочее'];
export const INCOME_DEFAULT = ['Зарплата','Стипендия','Помощь','Доп. доход','Возврат долга','Прочее'];
export const TAGS_DEFAULT = ['Учёба','Спорт','Англ','Работа','Прогулка','Чтение','Встреча','Диплом'];
// «Анти-теги» — отдельный список плохих привычек дня; отметка на дне отнимает XP и здоровье. session 024
export const ANTITAGS_DEFAULT = ['Прокрастинация','Фастфуд','Пересып','Скроллинг','Сигарета','Срыв'];
export const STUDY_PRIORITIES = ['Сегодня','В течение 3 дней','В течение недели','В течение месяца','Когда захочу'];
export const STUDY_STATUSES = ['Не начато','В процессе','Выполнено'];
export const STUDY_IMPORTANCE = ['Не важно','Средне','Важно','Очень важно'];
export const NOTE_TYPES = ['Заметка','Напоминание']; // Дело переехало во вкладку «Дела», Идея = обычная заметка
export const NOTE_REPEATS = [{id:'none',label:'Не повторять'},{id:'daily',label:'Каждый день'},{id:'weekly',label:'Каждую неделю'},{id:'monthly',label:'Каждый месяц'}];
// value = JS getDay() (0=Вс), порядок показа с понедельника
export const WEEKDAY_OPTS = [{value:'1',label:'Пн'},{value:'2',label:'Вт'},{value:'3',label:'Ср'},{value:'4',label:'Чт'},{value:'5',label:'Пт'},{value:'6',label:'Сб'},{value:'0',label:'Вс'}];
export const weekdayLabel = (wd) => (WEEKDAY_OPTS.find(w=>w.value===String(wd))||{}).label || '';
export const DEFAULT_ACCOUNTS = ['Наличные','На картах','Накопительный','Крипта'];
export const IMPORTANCE_COLOR = {'Не важно':C.dim,'Средне':C.cyan,'Важно':C.amber,'Очень важно':C.red};
// срочность — отдельная ось (дедлайновость); чем срочнее, тем краснее
export const STUDY_URGENCY = ['Не срочно','На неделе','Скоро','Срочно'];
export const URGENCY_COLOR = {'Не срочно':C.dim,'На неделе':C.cyan,'Скоро':C.amber,'Срочно':C.red};
export const STATUS_COLOR = {'Не начато':C.dim,'В процессе':C.amber,'Выполнено':C.green};
export const NOTE_TYPE_COLOR = {'Напоминание':C.amber,'Заметка':C.cyan};
// базовые эпики-категории для вкладки «Дела» (пресеты; свои эпики тоже можно заводить)
export const BASE_EPICS = ['Учёба','Саморазвитие','Личное','Работа','Рутина'];
// у этих скоупов закрытие цели просят подтвердить (день — без подтверждения)
export const PERIOD_SCOPES = ['year','month','week'];
export const PERIOD_LABEL = {week:'неделя', month:'месяц', year:'год'};
export const DIFF_XP = {easy:5, medium:10, hard:20};
// привязка «выполнил → вклад в цель»: подпись скоупа
export const GL_SCOPE = {year:'Год',month:'Месяц',week:'Неделя',day:'День'};

// метаданные вкладок для мобильной навигации (иконка+подпись)
export const TAB_META = {
  today:{label:'Сегодня',icon:'🗓'}, habits:{label:'Привычки',icon:'🔁'}, goals:{label:'Цели',icon:'🎯'},
  study:{label:'Дела',icon:'🗂'}, notes:{label:'Заметки',icon:'🗒'}, finance:{label:'Финансы',icon:'💰'},
  stats:{label:'Статистика',icon:'📊'}, achievements:{label:'Награды',icon:'🏅'},
};
export const ALL_MOBILE_TAB_IDS = ['today','habits','goals','study','notes','finance','stats','achievements'];
export const DEFAULT_MOBILE_TABS = ['today','habits','goals','finance']; // нижняя навбар по умолчанию; настраивается в Настройках
