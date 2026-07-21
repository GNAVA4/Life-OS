// Вкладка/раздел: NotesTab, NoteEditor (вынесено из App.jsx, session: decompose phase 3)
import { useState } from 'react';
import { NOTE_REPEATS, NOTE_TYPES, NOTE_TYPE_COLOR, WEEKDAY_OPTS } from '../lib/constants.js';
import { addDays, openDatePicker, todayStr } from '../lib/dates.js';
import { uid } from '../lib/format.js';
import { hasReminderWhen, notePreviewOf, noteTitleOf, reminderWhenLabel } from '../lib/notes.js';
import { S } from '../lib/styles.js';
import { C } from '../lib/theme.js';
import { Modal, Select } from '../ui/primitives.jsx';

export function NotesTab({notes, addNote, updateNote, deleteNote}){
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
