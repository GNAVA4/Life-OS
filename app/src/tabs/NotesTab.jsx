// Вкладка «Заметки» (Э5 референса «Тихий», переделано session 046).
// Каждая заметка — отдельная плашка: закреплённые сверху, чек-лист отмечается прямо на карточке,
// у напоминания чип с датой и кнопка «Выполнено». Правка и удаление — в редакторе (нажатие на карточку).
// Модель данных прежняя: {title, body, type, pinned, checklist[], remind*} — меняется только вид.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NOTE_REPEATS, NOTE_TYPES, NOTE_TYPE_COLOR, WEEKDAY_OPTS } from '../lib/constants.js';
import { addDays, openDatePicker, todayStr } from '../lib/dates.js';
import { uid } from '../lib/format.js';
import { hasReminderWhen, isOneShotReminder, notePreviewOf, noteTitleOf, reminderDone, reminderWhenLabel } from '../lib/notes.js';
import { S } from '../lib/styles.js';
import { C, tint } from '../lib/theme.js';
import { Check } from '../ui/Check.jsx';
import { Icon } from '../ui/Icon.jsx';
import { haptic } from '../lib/haptics.js';
import { Select } from '../ui/primitives.jsx';

const shortDate = (ds) => ds ? new Date(ds+'T00:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'}) : '';
const CHECK_PREVIEW = 5; // сколько пунктов чек-листа видно на карточке; остальные — «ещё N» (открывает редактор)

const FILTERS = [{id:'Все',l:'Все'},{id:'Заметка',l:'Заметки'},{id:'Напоминание',l:'Напоминания'}];

export function NotesTab({notes, addNote, updateNote, deleteNote, registerAdd}){
  const [filter,setFilter] = useState('Все');
  const [editing,setEditing] = useState(null); // объект заметки или null; {} = новая
  // «+» в шапке приложения открывает новую заметку
  useEffect(()=>{ if(!registerAdd) return; registerAdd(()=>setEditing({})); return ()=>registerAdd(null); }, [registerAdd]);
  const hasReminders = notes.some(n=>n.type==='Напоминание');
  const filtered = notes.filter(n=>filter==='Все'||n.type===filter)
    .sort((a,b)=> (b.pinned?1:0)-(a.pinned?1:0) || (((b.updatedAt||b.createdAt||'')>(a.updatedAt||a.createdAt||''))?1:-1)); // закреплённые вверх
  const today = todayStr();
  const handleSave = (patch) => { if(editing && editing.id) updateNote(editing.id, patch); else addNote(patch); };
  const stop = (e) => e.stopPropagation();

  return (
    <div>
      {hasReminders && (
        <div style={{...S.seg,marginBottom:14}}>
          {FILTERS.map(f=><button key={f.id} style={{...S.segBtn,background:filter===f.id?C.panelAlt:'transparent',color:filter===f.id?C.text:C.dim}} onClick={()=>setFilter(f.id)}>{f.l}</button>)}
        </div>
      )}
      {filtered.length===0 && (
        <div style={{...S.emptyState,display:'flex',flexDirection:'column',alignItems:'center',gap:10,padding:'40px 16px'}}>
          <span style={{color:C.faint,display:'flex'}}><Icon name="notes" size={28}/></span>
          <span>Здесь будут заметки, списки и напоминания.</span>
          <button style={S.btnPrimary} onClick={()=>setEditing({})}><Icon name="plus" size={15}/>Новая заметка</button>
        </div>
      )}
      <div className="notes-cols">
        {filtered.map(n=>{
          const oneShot = isOneShotReminder(n);
          const remDone = reminderDone(n);
          const overdue = oneShot && !remDone && n.remindDate < today;
          const soon = oneShot && !remDone && !overdue && n.remindDate <= addDays(today,1);
          const remCol = remDone ? C.green : overdue ? C.red : C.amber;
          const list = Array.isArray(n.checklist) ? n.checklist : [];
          const doneCnt = list.filter(i=>i.done).length;
          const toggleItem = (id) => updateNote(n.id, {checklist: list.map(i=>i.id===id?{...i,done:!i.done}:i)});
          const preview = notePreviewOf(n);
          const rem = hasReminderWhen(n);
          return (
            <div key={n.id} className="note-card" role="button" tabIndex={0} onClick={()=>setEditing(n)}
              onKeyDown={e=>{ if(e.key==='Enter') setEditing(n); }}
              style={{background:C.panel,borderRadius:14,padding:'14px 16px',cursor:'pointer',display:'flex',flexDirection:'column',gap:10,marginBottom:12,breakInside:'avoid'}}>
              <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                <div style={{flex:1,minWidth:0,fontSize:15,fontWeight:600,lineHeight:1.35,overflowWrap:'anywhere',paddingTop:2}}>{noteTitleOf(n)}</div>
                {rem && (n.repeat==='none' || !n.repeat) && n.remindDate && (
                  <span style={{flex:'none',display:'inline-flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:999,background:tint(remCol,.14),color:remCol,fontSize:12.5,fontWeight:500}}>
                    <Icon name="bell" size={13}/>{shortDate(n.remindDate)}
                  </span>)}
                <button className="icon-btn" title={n.pinned?'открепить':'закрепить'} aria-label={n.pinned?'Открепить':'Закрепить'} aria-pressed={!!n.pinned}
                  style={{flex:'none',color:n.pinned?C.amber:C.faint,marginTop:-2}} onClick={e=>{ stop(e); updateNote(n.id,{pinned:!n.pinned}); }}>
                  <Icon name="pin" size={16}/>
                </button>
              </div>

              {list.length>0 && (
                <div style={{display:'flex',flexDirection:'column',gap:8}} onClick={stop}>
                  {list.slice(0,CHECK_PREVIEW).map(i=>(
                    <label key={i.id} style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontSize:14}}>
                      <Check checked={i.done} onChange={()=>toggleItem(i.id)} label={i.text} size={20}/>
                      <span style={{flex:1,minWidth:0,overflowWrap:'anywhere',color:i.done?C.dim:C.text,textDecoration:i.done?'line-through':'none'}}>{i.text}</span>
                    </label>
                  ))}
                  {list.length>CHECK_PREVIEW && <button style={{background:'none',border:'none',padding:0,textAlign:'left',color:C.dim,fontSize:13,cursor:'pointer',fontFamily:'inherit'}} onClick={()=>setEditing(n)}>ещё {list.length-CHECK_PREVIEW}</button>}
                </div>
              )}

              {preview && <div style={{fontSize:13.5,color:C.dim,lineHeight:1.5,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflowWrap:'anywhere'}}>{preview}</div>}

              {rem && (
                <div style={{fontSize:13.5,color:overdue?C.red:soon?C.amber:C.dim,lineHeight:1.45}}>
                  {remDone ? 'Выполнено' : `Напомню ${oneShot ? `${shortDate(n.remindDate)}${n.remindTime?` в ${n.remindTime}`:''}` : reminderWhenLabel(n)}`}{overdue?' · просрочено':''}
                </div>
              )}
              {oneShot && (
                <div onClick={stop}>
                  <button style={{...S.btnGhost,padding:'7px 12px',...(remDone?{color:C.green,borderColor:tint(C.green,.4)}:null)}}
                    title={remDone?'вернуть в активные':'отметить выполненным — повторы прекратятся'}
                    onClick={()=>updateNote(n.id,{remindDone:!remDone})}>
                    <Icon name="check" size={14}/>{remDone?'Выполнено · вернуть':'Выполнено'}
                  </button>
                </div>
              )}

              {(list.length>0 || !rem) && (
                <div style={{fontSize:12.5,color:C.faint}}>
                  {list.length>0 ? `${doneCnt} из ${list.length}` : shortDate(n.updatedAt||n.createdAt)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {editing && <NoteEditor note={editing} onSave={handleSave} onDelete={deleteNote} onClose={()=>setEditing(null)} />}
    </div>
  );
}

const Field = ({label, children}) => (
  <div style={{display:'flex',flexDirection:'column',gap:6}}>
    <span style={{fontSize:12.5,color:C.dim}}>{label}</span>
    {children}
  </div>
);

export function NoteEditor({note, onSave, onDelete, onClose}){
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
  const [confirmDel,setConfirmDel] = useState(false); // двухшаговое подтверждение удаления (WebView-safe, без confirm())
  const isRem = type==='Напоминание';
  const addItem = () => { if(!newItem.trim()) return; setChecklist([...checklist,{id:uid(),text:newItem.trim(),done:false}]); setNewItem(''); };
  const toggleItem = (id) => setChecklist(checklist.map(i=>i.id===id?{...i,done:!i.done}:i));
  const delItem = (id) => setChecklist(checklist.filter(i=>i.id!==id));
  // Снимок исходных значений: выход «назад»/Esc сохраняет, только если что-то изменилось (длинный текст не теряется).
  const initial = useRef(JSON.stringify({title:note.title||'', body:note.body||'', type:note.type||'Заметка', pinned:!!note.pinned,
    checklist:Array.isArray(note.checklist)?note.checklist:[], remindDate:note.remindDate||'', remindTime:note.remindTime||'', repeat:note.repeat||'none',
    remindWeekday:note.remindWeekday!=null?String(note.remindWeekday):'', remindDay:note.remindDay!=null?String(note.remindDay):''}));
  const dirty = () => JSON.stringify({title, body, type, pinned, checklist, remindDate, remindTime, repeat, remindWeekday, remindDay}) !== initial.current;
  const isEmpty = !title.trim() && !body.trim() && checklist.length===0;
  const close = () => { if(dirty() && !(isEmpty && !note.id)) save(); else onClose(); };
  const closeRef = useRef(close); closeRef.current = close;
  useEffect(()=>{ const on=(e)=>{ if(e.key==='Escape') closeRef.current(); }; document.addEventListener('keydown',on);
    const prev=document.body.style.overflow; document.body.style.overflow='hidden';   // фон не прокручивается под редактором
    return ()=>{ document.removeEventListener('keydown',on); document.body.style.overflow=prev; }; }, []);
  // текст растёт вместе с содержимым — никаких маленьких окошек с прокруткой внутри
  const bodyRef = useRef(null);
  useEffect(()=>{ const el=bodyRef.current; if(!el) return; el.style.height='auto'; el.style.height=Math.max(el.scrollHeight, window.innerHeight*0.45)+'px'; }, [body]);
  const save = () => { const rep = isRem?repeat:undefined; onSave({title:title.trim(), body, type, pinned, checklist,
    remindTime: isRem?(remindTime||undefined):undefined,
    repeat: rep,
    remindDate: (isRem && rep==='none')?(remindDate||undefined):undefined,
    remindWeekday: (isRem && rep==='weekly' && remindWeekday!=='')?Number(remindWeekday):undefined,
    remindDay: (isRem && rep==='monthly' && remindDay!=='')?Number(remindDay):undefined,
    // Перенёс срок или сменил тип/повтор — отметка «выполнено» снимается, иначе напоминание с новой
    // датой молчало бы: снаружи оно выглядит как активное, а планировщик его пропускает.
    remindDone: (isRem && rep==='none' && remindDate===note.remindDate) ? note.remindDone : undefined,
  }); onClose(); };
  // Заметка — отдельное окно на весь экран (запрос пользователя s050): тексты обычно длинные.
  return createPortal(
    <div className="anim-fade" role="dialog" aria-label={note.id?'Заметка':'Новая заметка'}
      style={{position:'fixed',inset:0,zIndex:110,background:C.bg,overflowY:'auto',WebkitOverflowScrolling:'touch'}}>
      <div style={{position:'sticky',top:0,zIndex:1,background:C.bg,borderBottom:`1px solid ${C.border}`,paddingTop:'env(safe-area-inset-top, 0px)'}}>
        <div style={{maxWidth:860,margin:'0 auto',display:'flex',alignItems:'center',gap:6,padding:'10px 16px'}}>
          <button onClick={close} title="назад (изменения сохранятся)" style={{display:'inline-flex',alignItems:'center',gap:4,background:'none',border:'none',color:C.amber,fontFamily:'inherit',fontSize:14.5,cursor:'pointer',padding:'6px 0'}}>
            <Icon name="chevL" size={18}/>Заметки</button>
          <span style={{flex:1}}/>
          <button className="icon-btn" aria-pressed={pinned} title={pinned?'открепить':'закрепить'} aria-label={pinned?'Открепить':'Закрепить'} onClick={()=>setPinned(p=>!p)} style={{color:pinned?C.amber:C.dim}}><Icon name="pin" size={18}/></button>
          {note.id && (confirmDel
            ? <button style={{...S.btnGhost,color:C.red,borderColor:tint(C.red,.5)}} onClick={()=>{ haptic('warn'); onDelete(note.id); onClose(); }}>Удалить?</button>
            : <button className="icon-btn" title="удалить заметку" aria-label="Удалить заметку" onClick={()=>setConfirmDel(true)} style={{color:C.dim}}><Icon name="trash" size={18}/></button>)}
          <button style={{...S.btnPrimary,padding:'8px 18px',marginLeft:6}} onClick={save}>Готово</button>
        </div>
      </div>

      <div style={{maxWidth:860,margin:'0 auto',padding:'18px 16px calc(40px + env(safe-area-inset-bottom, 0px))',display:'flex',flexDirection:'column',gap:16}}>
        <div style={{...S.seg,alignSelf:'flex-start'}}>
          {NOTE_TYPES.map(t=><button key={t} style={{...S.segBtn,background:type===t?C.panelAlt:'transparent',color:type===t?(NOTE_TYPE_COLOR[t]||C.text):C.dim}} onClick={()=>setType(t)}>{t}</button>)}
        </div>
        <input style={{background:'none',border:'none',outline:'none',color:C.text,fontFamily:'inherit',fontSize:24,fontWeight:700,letterSpacing:'-.01em',padding:0,width:'100%'}}
          placeholder="Заголовок" value={title} onChange={e=>setTitle(e.target.value)} autoFocus={!note.id} aria-label="Заголовок" />
        <textarea ref={bodyRef} style={{background:'none',border:'none',outline:'none',resize:'none',color:C.text,fontFamily:'inherit',fontSize:16,lineHeight:1.65,padding:0,width:'100%',overflow:'hidden'}}
          placeholder="Текст заметки" value={body} onChange={e=>setBody(e.target.value)} aria-label="Текст заметки" />

        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16,display:'flex',flexDirection:'column',gap:16}}>
        <Field label={`Чек-лист${checklist.length?` · ${checklist.filter(i=>i.done).length} из ${checklist.length}`:''}`}>
          {checklist.map(i=>(
            <div key={i.id} style={{display:'flex',alignItems:'center',gap:10,minHeight:30}}>
              <Check checked={i.done} onChange={()=>toggleItem(i.id)} label={i.text} size={20}/>
              <div style={{flex:1,minWidth:0,fontSize:14,overflowWrap:'anywhere',textDecoration:i.done?'line-through':'none',color:i.done?C.dim:C.text}}>{i.text}</div>
              <button className="icon-btn" title="убрать пункт" aria-label="Убрать пункт" onClick={()=>delItem(i.id)}><Icon name="x" size={14}/></button>
            </div>
          ))}
          <div style={{display:'flex',gap:8}}>
            <input style={{...S.input,flex:1}} placeholder="Новый пункт" aria-label="Новый пункт" value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') addItem(); }} />
            <button style={{...S.iconBtnAmber,width:40,height:40,flex:'none'}} title="добавить пункт" aria-label="Добавить пункт" onClick={addItem}><Icon name="plus" size={16}/></button>
          </div>
        </Field>

        {isRem && (
          <Field label="Когда напомнить">
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:8}}>
              <Select value={repeat} onChange={setRepeat} options={NOTE_REPEATS.map(r=>({value:r.id,label:r.label}))} />
              {repeat==='none' && <input style={S.input} type="date" value={remindDate} onChange={e=>setRemindDate(e.target.value)} onClick={openDatePicker} aria-label="Дата" />}
              {repeat==='weekly' && <Select value={remindWeekday} onChange={setRemindWeekday} placeholder="день недели" options={WEEKDAY_OPTS} />}
              {repeat==='monthly' && <Select value={remindDay} onChange={setRemindDay} placeholder="число" options={Array.from({length:31},(_,i)=>({value:String(i+1),label:String(i+1)}))} />}
              <input style={S.input} type="time" value={remindTime} onChange={e=>setRemindTime(e.target.value)} aria-label="Время" />
            </div>
            <div style={{fontSize:12.5,color:C.dim}}>Придёт уведомлением на телефоне. {repeat==='daily'?'Каждый день в это время.':repeat==='weekly'?'Каждую неделю в выбранный день.':repeat==='monthly'?'Каждый месяц в выбранное число.':'Один раз в указанную дату.'}</div>
          </Field>
        )}

        </div>
      </div>
    </div>, document.body
  );
}
