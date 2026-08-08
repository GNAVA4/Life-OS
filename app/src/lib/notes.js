// Заметки/дела: миграция старой модели, слияние, ярлыки напоминаний.
import { NOTE_TYPES, NOTE_REPEATS, weekdayLabel } from './constants.js';
import { todayStr } from './dates.js';

// Миграция заметок под новую модель {title,body,type} + перенос старых «Дело» во вкладку «Дела». Идемпотентна.
export const isLegacyNote = (n) => n && n.body===undefined && typeof n.text==='string';
export const migrateNotes = (raw) => {
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
export const mergeStudyById = (base, extra) => { if(!extra.length) return base; const have=new Set(base.map(s=>s.id));
  return [...extra.filter(s=>!have.has(s.id)), ...base]; };

export const noteTitleOf = (n) => (n.title && n.title.trim()) || (n.body||'').split('\n')[0].slice(0,60) || 'Без названия';
export const notePreviewOf = (n) => { const body=n.body||''; const firstLine=(n.title&&n.title.trim())?body:body.split('\n').slice(1).join(' '); return firstLine.trim().slice(0,120); };
export const repeatLabel = (id) => (NOTE_REPEATS.find(r=>r.id===id)||{}).label || '';
// человекочитаемое «когда» для карточки напоминания
export const reminderWhenLabel = (n) => {
  const t = n.remindTime ? ` ${n.remindTime}` : '';
  if(n.repeat==='daily')   return `каждый день${t}`;
  if(n.repeat==='weekly')  return `кажд. ${weekdayLabel(n.remindWeekday!=null?n.remindWeekday:(n.remindDate?new Date(n.remindDate+'T00:00:00').getDay():''))}${t}`;
  if(n.repeat==='monthly') return `${(n.remindDay!=null?n.remindDay:(n.remindDate?new Date(n.remindDate+'T00:00:00').getDate():''))} числа${t}`;
  return n.remindDate ? `${n.remindDate}${t}` : '';
};
export const hasReminderWhen = (n) => n.type==='Напоминание' && (n.remindDate || n.repeat==='daily' || (n.repeat==='weekly'&&n.remindWeekday!=null) || (n.repeat==='monthly'&&n.remindDay!=null));

// Одноразовое напоминание с датой — единственный вид, у которого есть СРОК, а значит «за N дней до»
// и просрочка. У повторяющихся (каждый день/неделю/месяц) срока нет: они просто приходят по расписанию.
export const isOneShotReminder = (n) => n && n.type==='Напоминание'
  && (!n.repeat || n.repeat==='none') && !!n.remindDate;
// Отметка «выполнено» есть только у одноразовых: без неё просроченное напоминание было бы нечем
// остановить, кроме удаления записи (у дел ту же роль играет статус «Выполнено»).
export const reminderDone = (n) => !!(n && n.remindDone);
// Приведение напоминаний к виду дедлайнов ({label, deadline}) — чтобы «за N дней» и текст просрочки
// считались тем же кодом, что у дел/целей/задач (lib/deadlines.js), и правила не разъезжались.
// time оставляем СВОЁ у каждого напоминания: у дел время общее (настройка), у напоминания — личное.
export const reminderItems = (notes) => (notes||[])
  .filter(n => isOneShotReminder(n) && !reminderDone(n))
  .map(n => ({ kind:'note', label: noteTitleOf(n), deadline: n.remindDate, time: n.remindTime || '09:00' }));
