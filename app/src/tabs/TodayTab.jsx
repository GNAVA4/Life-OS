// Вкладка «Сегодня» (вынесено из App.jsx, session: decompose phase 3). Редизайн «Тихий» — session 043 (Э1/Э1б).
// Все прежние функции на месте: правка любого дня (полоса недели + календарь), задачи со сложностью и
// привязками к целям, правка/удаление, шаблоны, перенос со вчера, ежедневные, теги и анти-теги, оценка 1–10
// с шагом 0,1, сон, заметка, тренер/задания/испытание, «На несколько дней» (отключается в Настройках →
// «Что показывать», модуль today.ongoing — по просьбе пользователя).
import { useEffect, useRef, useState } from 'react';
import { addDays, daysBetween, openDatePicker, todayStr } from '../lib/dates.js';
import { maskMoney } from '../lib/format.js';
import { WEEKLY_XP } from '../lib/gamify.js';
import { goalLinksOf, goalMode } from '../lib/goals.js';
import { vis } from '../lib/storage.js';
import { S } from '../lib/styles.js';
import { C, tint } from '../lib/theme.js';
import { GoalLinkPicker } from '../ui/GoalLinkPicker.jsx';
import { Icon } from '../ui/Icon.jsx';
import { ConfirmIconBtn } from '../ui/primitives.jsx';

const DIFFS = [{v:'easy',l:'Лёгкая',s:'Л'},{v:'medium',l:'Средняя',s:'С'},{v:'hard',l:'Тяжёлая',s:'Т'}];
const diffShort = (d) => (DIFFS.find(x=>x.v===(d||'medium'))||DIFFS[1]).s;
const WD = ['пн','вт','ср','чт','пт','сб','вс'];
// Сон: шаг кнопок и стартовое значение, если за день ещё ничего не записано (8 ч — частая рекомендация;
// дальше пользователь двигает ±0,5). Поле можно и просто ввести вручную, как раньше.
const SLEEP_STEP = 0.5, SLEEP_START = 8;
const fmt1 = (n) => n.toLocaleString('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1});

// Круглая отметка выполнения (замена нативному чекбоксу).
export function Check({checked, onChange, label, color=C.amber}){
  return (
    <button type="button" role="checkbox" aria-checked={!!checked} aria-label={label} onClick={onChange}
      style={{width:22,height:22,borderRadius:'50%',flex:'none',cursor:'pointer',padding:0,display:'grid',placeItems:'center',
        border:`1.6px solid ${checked?color:'#4A4E55'}`,background:checked?color:'transparent',color:C.bg}}>
      {checked && <Icon name="check" size={13} stroke={3}/>}
    </button>
  );
}

// Название цели по привязке {scope, goalId, amount}.
function linkLabel(goals, l){
  const g = (goals[l.scope]||[]).find(x=>x.id===l.goalId);
  if(!g) return null;
  const unit = goalMode(g)==='counter' ? '' : '%';
  return `${g.title} · +${l.amount}${unit}`;
}

function SectionHead({title, right, color}){
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:4}}>
      <div style={{...S.panelTitle,marginBottom:0,color:color||C.dim}}>{title}</div>
      {right}
    </div>
  );
}
const linkBtn = {background:'none',border:'none',color:C.dim,fontSize:12.5,cursor:'pointer',padding:'2px 0',display:'inline-flex',alignItems:'center',gap:4};

export function TodayTab({entry, selectedDate, setSelectedDate, addTask, toggleTask, deleteTask, editTask, updateEntry, goals,
  tags, toggleTagOnDay, addTagGlobal, removeTagGlobal,
  antiTags=[], toggleAntiTagOnDay, addAntiTagGlobal, removeAntiTagGlobal, antiXp=15, hpAnti=5,
  dailyTasks, toggleDaily, addDailyTask, deleteDailyTask,
  ongoing=[], addOngoing, finishOngoing, deleteOngoing, bills, maskOps=false,
  taskTemplates=[], saveTaskTemplate, applyTaskTemplate, deleteTaskTemplate, carryOverTasks, prevUndoneCount=0,
  isToday=true, quests=[], weekly=null, combo={streak:0,mult:1}, coachInsights=[], collapsedUI={}, onToggleUI,
  days={}, streak=0, health=100, level=1, into=0, needed=100, levelMax=false}){
  const today = todayStr();
  // --- новая задача ---
  const [newTaskText,setNewTaskText] = useState('');
  const [difficulty,setDifficulty] = useState('medium');
  const [linkOpen,setLinkOpen] = useState(false);
  const [taskLinks,setTaskLinks] = useState([]);
  const [tplOpen,setTplOpen] = useState(false);
  const [tplName,setTplName] = useState('');
  const taskInputRef = useRef(null);
  const composing = newTaskText.length>0 || linkOpen;
  const submitTask = () => { if(!newTaskText.trim()) return; addTask(newTaskText.trim(), difficulty, taskLinks);
    setNewTaskText(''); setTaskLinks([]); setLinkOpen(false); };
  // --- правка задачи (название/сложность/привязки; у выполненной — перенос последствий в App.editTask) ---
  const [editId,setEditId] = useState(null);
  const [editText,setEditText] = useState('');
  const [editDiff,setEditDiff] = useState('medium');
  const [editLinks,setEditLinks] = useState([]);
  const startEdit = (t) => { setEditId(t.id); setEditText(t.text); setEditDiff(t.difficulty||'medium'); setEditLinks(goalLinksOf(t)); };
  const cancelEdit = () => setEditId(null);
  const saveEdit = (id) => { if(!editText.trim()) return;
    editTask(id, {text:editText, difficulty:editDiff, goalLinks:editLinks}); setEditId(null); };
  // --- ежедневные ---
  const [dailyOpen,setDailyOpen] = useState(false);
  const [newDailyText,setNewDailyText] = useState('');
  const [dailyLinkOpen,setDailyLinkOpen] = useState(false);
  const [dailyLinks,setDailyLinks] = useState([]);
  const submitDaily = () => { if(!newDailyText.trim()) return; addDailyTask(newDailyText.trim(), dailyLinks);
    setNewDailyText(''); setDailyLinks([]); setDailyLinkOpen(false); };
  // --- день: оценка, сон, заметка, теги ---
  const [ratingDraft,setRatingDraft] = useState(entry.rating ?? null);
  const [sleepInput,setSleepInput] = useState(entry.sleepHours ?? '');
  const [noteInput,setNoteInput] = useState(entry.note || '');
  const [tagEdit,setTagEdit] = useState(false);
  const [antiEdit,setAntiEdit] = useState(false);
  const [newTagInput,setNewTagInput] = useState('');
  const [showTagInput,setShowTagInput] = useState(false);
  const [newAntiInput,setNewAntiInput] = useState('');
  const [showAntiInput,setShowAntiInput] = useState(false);
  const dateInputRef = useRef(null);
  const [ongoingOpen,setOngoingOpen] = useState(false);
  const [ongoingText,setOngoingText] = useState('');
  const [ongoingEnd,setOngoingEnd] = useState('');
  const submitOngoing = () => { if(!ongoingText.trim()) return;
    addOngoing({text:ongoingText.trim(), startDate:selectedDate, endDate:ongoingEnd||undefined}); setOngoingText(''); setOngoingEnd(''); setOngoingOpen(false); };

  // Ре-синк полей дня с загруженным entry (данные грузятся асинхронно; при вводе entry не меняется до сохранения).
  useEffect(()=>{ setRatingDraft(entry.rating ?? null); }, [selectedDate, entry.rating]);
  useEffect(()=>{ setNoteInput(entry.note || ''); }, [selectedDate, entry.note]);
  useEffect(()=>{ setSleepInput(entry.sleepHours ?? ''); }, [selectedDate, entry.sleepHours]);
  useEffect(()=>{ setEditId(null); }, [selectedDate]);

  // Оценка пишется по отпусканию ползунка, а не на каждый пиксель — иначе десятки записей в облако.
  const commitRating = () => { if(ratingDraft!=null && ratingDraft!==entry.rating) updateEntry({rating:ratingDraft}); };
  const setSleep = (v) => { const n = Math.max(0, Math.min(24, Math.round(v*2)/2)); setSleepInput(n); updateEntry({sleepHours:n}); };
  const commitSleepInput = () => { const v=parseFloat(String(sleepInput).replace(',','.')); if(!isNaN(v) && v!==entry.sleepHours) setSleep(v); };

  const doneCount = entry.tasks.filter(t=>t.done).length;
  const doneXpHint = entry.tasks.length ? `${doneCount} из ${entry.tasks.length}` : '';
  const dayNum = parseInt(selectedDate.slice(8,10),10);
  const todaysBill = bills.find(b=>b.dayOfMonth===dayNum);
  const activeDaily = dailyTasks.filter(d=>d.active);
  const activeOngoing = ongoing.filter(o => !o.done && o.startDate<=selectedDate && (!o.endDate || o.endDate>=selectedDate));
  const dailyDone = activeDaily.filter(d=>(entry.dailyCompletions||{})[d.id]).length;

  // полоса недели (пн–вс) вокруг выбранного дня; точка = в дне что-то записано
  const sel = new Date(selectedDate+'T00:00:00');
  const monday = addDays(selectedDate, -((sel.getDay()+6)%7));
  const week = Array.from({length:7},(_,i)=>addDays(monday,i));
  const hasData = (ds) => { const e=days[ds]; return !!(e && ((e.tasks&&e.tasks.length) || e.rating!=null || e.note || (e.tags&&e.tags.length) || e.sleepHours!=null)); };

  const questsDone = quests.filter(q=>q.deferred?q.claimed:q.done).length;
  const questsXp = quests.reduce((s,q)=>s+(q.xp||0),0);

  const left = (
    <div>
      {/* ---- выбор дня ---- */}
      <div style={{marginBottom:18}}>
        <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:6}}>
          <button style={S.navArrow} aria-label="Предыдущая неделя" onClick={()=>setSelectedDate(addDays(selectedDate,-7))}><Icon name="chevL"/></button>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',gap:2,flex:1}}>
            {week.map((ds,i)=>{ const on=ds===selectedDate, isT=ds===today, fut=ds>today;
              return (
                <button key={ds} onClick={()=>setSelectedDate(ds)} aria-label={ds} aria-pressed={on}
                  style={{background:on?C.panel:'transparent',border:'none',outline:on?`1px solid ${C.amber}`:'none',borderRadius:10,padding:'5px 0 6px',cursor:'pointer',
                    display:'flex',flexDirection:'column',alignItems:'center',gap:3,color:C.dim,fontFamily:'inherit'}}>
                  <span style={{fontSize:10.5,color:isT?C.amber:C.dim}}>{WD[i]}</span>
                  <span style={{fontSize:15,fontWeight:600,color:fut?C.faint:C.text,fontVariantNumeric:'tabular-nums'}}>{parseInt(ds.slice(8),10)}</span>
                  <span style={{width:5,height:5,borderRadius:'50%',background:hasData(ds)?C.amber:'transparent'}}/>
                </button>
              ); })}
          </div>
          <button style={S.navArrow} aria-label="Следующая неделя" onClick={()=>setSelectedDate(addDays(selectedDate,7))}><Icon name="chevR"/></button>
          <div style={{position:'relative'}}>
            <button style={S.navArrow} aria-label="Выбрать дату" onClick={()=>{ const el=dateInputRef.current; if(el){ try{ el.showPicker ? el.showPicker() : el.click(); }catch(e){ el.click(); } } }}><Icon name="calendar"/></button>
            <input ref={dateInputRef} type="date" value={selectedDate} onChange={e=>e.target.value && setSelectedDate(e.target.value)} onClick={openDatePicker}
              style={{position:'absolute',inset:0,opacity:0,pointerEvents:'none',width:'100%'}} tabIndex={-1} aria-hidden="true"/>
          </div>
        </div>
        {selectedDate!==today && (
          <div style={{...S.plate,display:'flex',alignItems:'center',gap:10,padding:'9px 12px',background:tint(C.cyan,.1)}}>
            <span style={{fontSize:13,color:C.cyan,flex:1}}>{selectedDate<today?'Правишь прошедший день':'Планируешь будущий день'}</span>
            <button style={{...S.btnGhost,borderColor:tint(C.cyan,.4),color:C.cyan}} onClick={()=>setSelectedDate(today)}>К сегодня</button>
          </div>
        )}
      </div>

      {/* ---- строка состояния ---- */}
      <div style={{marginBottom:20}}>
        <div style={{display:'flex',gap:14,alignItems:'center',fontSize:12.5,color:C.dim,fontVariantNumeric:'tabular-nums',flexWrap:'wrap'}}>
          <span style={{display:'flex',gap:5,alignItems:'center'}} title="Здоровье"><Icon name="heart" size={14}/>{health}</span>
          <span style={{display:'flex',gap:5,alignItems:'center'}} title="Серия активных дней"><Icon name="flame" size={14}/>{streak} {streak%10===1&&streak%100!==11?'день':(streak%10>=2&&streak%10<=4&&(streak%100<12||streak%100>14))?'дня':'дней'}</span>
          {combo.mult>1 && <span title={`Комбо ${combo.streak} дн.`}>×{fmt1(combo.mult)}</span>}
          <span style={{marginLeft:'auto'}}>ур. {level}{levelMax?' · макс':` · ${into} / ${needed}`}</span>
        </div>
        <div style={{height:2,background:C.border,borderRadius:2,marginTop:8}}><div style={{height:'100%',width:`${levelMax?100:Math.min(100,into/needed*100)}%`,background:C.amber,borderRadius:2}}/></div>
      </div>

      {todaysBill && (
        <div style={{...S.plate,display:'flex',alignItems:'center',gap:10,marginBottom:14,padding:'10px 12px'}}>
          <span style={{color:C.amber,display:'flex'}}><Icon name="finance"/></span>
          <span style={{fontSize:13,flex:1}}>Платёж в этот день: {todaysBill.name} — {maskMoney(maskOps, todaysBill.amount)}</span>
        </div>
      )}

      {prevUndoneCount>0 && vis('today.carryover') && (
        <div style={{...S.plate,display:'flex',alignItems:'center',gap:10,marginBottom:18,padding:'10px 12px'}}>
          <span style={{color:C.cyan,display:'flex'}}><Icon name="carry"/></span>
          <span style={{fontSize:13,flex:1}}>Со вчера не закрыто: {prevUndoneCount}</span>
          <button style={S.btnGhost} onClick={carryOverTasks}>Перенести</button>
        </div>
      )}

      {/* ---- задачи ---- */}
      <div style={S.panel}>
        <SectionHead title={<>Задачи{entry.tasks.length?<span style={S.dimSpan}>{doneXpHint}</span>:null}</>}
          right={<button style={{...linkBtn,color:tplOpen?C.amber:C.dim}} onClick={()=>setTplOpen(o=>!o)}><Icon name="template" size={14}/>Шаблоны</button>} />

        {tplOpen && (
          <div style={{...S.plate,margin:'6px 0 10px',display:'flex',flexDirection:'column',gap:10}}>
            {taskTemplates.length>0 ? (
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {taskTemplates.map(tpl=>(
                  <div key={tpl.id} className="chip" style={{background:C.panelAlt,color:C.text,maxWidth:'100%',paddingRight:4}}>
                    <span style={{cursor:'pointer',minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={`Добавить ${tpl.tasks.length} задач`} onClick={()=>applyTaskTemplate(tpl.id)}>{tpl.name} · {tpl.tasks.length}</span>
                    <ConfirmIconBtn onConfirm={()=>deleteTaskTemplate(tpl.id)} title="удалить шаблон" confirmLabel="удалить?" />
                  </div>
                ))}
              </div>
            ) : <div style={{fontSize:13,color:C.dim}}>Шаблонов пока нет. Сохрани задачи этого дня как шаблон — потом они добавятся одним нажатием.</div>}
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <input style={{...S.input,fontSize:13}} placeholder="Сохранить задачи дня как шаблон…" value={tplName} onChange={e=>setTplName(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter' && tplName.trim() && entry.tasks.length){ saveTaskTemplate(tplName.trim(), entry.tasks); setTplName(''); } }} />
              <button style={{...S.btnPrimary,opacity:(!tplName.trim()||!entry.tasks.length)?.45:1}} disabled={!tplName.trim()||!entry.tasks.length}
                onClick={()=>{ if(tplName.trim() && entry.tasks.length){ saveTaskTemplate(tplName.trim(), entry.tasks); setTplName(''); } }}>Сохранить</button>
            </div>
            {!entry.tasks.length && <div style={{fontSize:12,color:C.dim}}>В этом дне нет задач — сохранять нечего.</div>}
          </div>
        )}

        <div>
          {entry.tasks.map(t=> editId===t.id ? (
            <div key={t.id} style={{...S.plate,margin:'6px 0',display:'flex',flexDirection:'column',gap:10}}>
              <input style={{...S.input,background:C.bg}} autoFocus value={editText} onChange={e=>setEditText(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter') saveEdit(t.id); if(e.key==='Escape') cancelEdit(); }} aria-label="Название задачи" />
              <div style={{...S.seg,background:C.bg,display:'flex'}}>
                {DIFFS.map(d=><button key={d.v} onClick={()=>setEditDiff(d.v)} style={{...S.segBtn,flex:1,background:editDiff===d.v?C.panelAlt:'transparent',color:editDiff===d.v?C.text:C.dim}}>{d.l}</button>)}
              </div>
              <div style={{fontSize:12,color:C.dim}}>Цели</div>
              <GoalLinkPicker goals={goals} links={editLinks} onLinks={setEditLinks} />
              {t.done && <div style={{fontSize:12,color:C.dim,lineHeight:1.45}}>Задача уже выполнена: смена целей перенесёт вклад, смена сложности поправит XP.</div>}
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <button style={S.btnPrimary} onClick={()=>saveEdit(t.id)}>Сохранить</button>
                <button style={S.exportBtn} onClick={cancelEdit}>Отмена</button>
                <span style={{marginLeft:'auto'}}><ConfirmIconBtn onConfirm={()=>{ setEditId(null); deleteTask(t.id); }} confirmLabel="удалить?" title="удалить задачу" icon="trash" /></span>
              </div>
            </div>
          ) : (
            <div key={t.id} style={S.taskRow}>
              <Check checked={t.done} onChange={()=>toggleTask(t.id)} label={t.text} />
              <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:2}}>
                <span style={{overflowWrap:'anywhere',textDecoration:t.done?'line-through':'none',textDecorationColor:C.faint,color:t.done?C.dim:C.text,fontSize:14.5}}>{t.text}</span>
                {goalLinksOf(t).map((l,i)=>{ const lab=linkLabel(goals,l); return lab && (
                  <span key={i} style={{fontSize:11.5,color:t.done?C.dim:C.amber,display:'flex',gap:4,alignItems:'center',minWidth:0}}>
                    <Icon name="goals" size={12}/><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lab}</span></span>); })}
              </div>
              <span title="сложность" style={{fontSize:10.5,fontWeight:600,color:C.faint,border:`1px solid ${C.border}`,borderRadius:6,padding:'1px 5px'}}>{diffShort(t.difficulty)}</span>
              {editTask && <button className="icon-btn" title="изменить задачу" aria-label="Изменить задачу" onClick={()=>startEdit(t)}><Icon name="edit" size={15}/></button>}
            </div>
          ))}
          {entry.tasks.length===0 && <div style={S.emptyState}>Задач на этот день нет.</div>}
        </div>

        {/* быстрое добавление: Enter — сразу добавить; при наборе появляются сложность и цели */}
        <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:10}}>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <input ref={taskInputRef} style={S.input} placeholder="Новая задача" value={newTaskText} aria-label="Новая задача"
              onChange={e=>setNewTaskText(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') submitTask(); }} />
            <button style={{...S.iconBtnAmber,opacity:newTaskText.trim()?1:.45}} aria-label="Добавить задачу" onClick={submitTask}><Icon name="plus" size={18}/></button>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <div style={{...S.seg}}>
              {DIFFS.map(d=><button key={d.v} onClick={()=>setDifficulty(d.v)} style={{...S.segBtn,background:difficulty===d.v?C.panelAlt:'transparent',color:difficulty===d.v?C.text:C.dim}}>{d.l}</button>)}
            </div>
            <button style={{...S.btnGhost,color:linkOpen||taskLinks.length?C.amber:C.text}} onClick={()=>{ setLinkOpen(o=>!o); taskInputRef.current && taskInputRef.current.focus(); }}>
              <Icon name="goals" size={14}/>{taskLinks.length?`Цели · ${taskLinks.length}`:'С целью'}</button>
          </div>
          {(linkOpen || composing && taskLinks.length>0) && <GoalLinkPicker goals={goals} links={taskLinks} onLinks={setTaskLinks} />}
        </div>
      </div>

      {/* ---- ежедневные ---- */}
      {vis('today.daily') && (
      <div style={S.panel}>
        <SectionHead title={<>Каждый день{activeDaily.length?<span style={S.dimSpan}>{dailyDone} из {activeDaily.length}</span>:null}</>}
          right={<button style={{...linkBtn,color:dailyOpen?C.amber:C.dim}} onClick={()=>setDailyOpen(o=>!o)}><Icon name="plus" size={14}/>Добавить</button>} />
        {activeDaily.map(d=>{ const done=!!(entry.dailyCompletions||{})[d.id]; return (
          <div key={d.id} style={S.taskRow}>
            <Check checked={done} onChange={()=>toggleDaily(d.id)} label={d.text} />
            <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:2}}>
              <span style={{overflowWrap:'anywhere',fontSize:14.5,color:done?C.dim:C.text,textDecoration:done?'line-through':'none',textDecorationColor:C.faint}}>{d.text}</span>
              {goalLinksOf(d).map((l,i)=>{ const lab=linkLabel(goals,l); return lab && (
                <span key={i} style={{fontSize:11.5,color:done?C.dim:C.amber,display:'flex',gap:4,alignItems:'center',minWidth:0}}>
                  <Icon name="goals" size={12}/><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lab}</span></span>); })}
            </div>
            <ConfirmIconBtn onConfirm={()=>deleteDailyTask(d.id)} title="удалить ежедневную" confirmLabel="удалить?" />
          </div>
        ); })}
        {activeDaily.length===0 && !dailyOpen && <div style={S.emptyState}>Ежедневных пока нет — то, что делаешь каждый день, отмечается здесь.</div>}
        {dailyOpen && (
          <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:10}}>
            <div style={{display:'flex',gap:8}}>
              <input autoFocus style={S.input} placeholder="Новая ежедневная" value={newDailyText}
                onChange={e=>setNewDailyText(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') submitDaily(); if(e.key==='Escape') setDailyOpen(false); }} />
              <button style={{...S.iconBtnAmber,opacity:newDailyText.trim()?1:.45}} aria-label="Добавить ежедневную" onClick={submitDaily}><Icon name="plus" size={18}/></button>
            </div>
            <div><button style={{...S.btnGhost,color:dailyLinkOpen||dailyLinks.length?C.amber:C.text}} onClick={()=>setDailyLinkOpen(o=>!o)}><Icon name="goals" size={14}/>{dailyLinks.length?`Цели · ${dailyLinks.length}`:'С целью'}</button></div>
            {dailyLinkOpen && <GoalLinkPicker goals={goals} links={dailyLinks} onLinks={setDailyLinks} />}
          </div>
        )}
      </div>
      )}

      {/* ---- на несколько дней (модуль today.ongoing, выключается в Настройках) ---- */}
      {vis('today.ongoing') && (
      <div style={S.panel}>
        <SectionHead title={<>На несколько дней{activeOngoing.length?<span style={S.dimSpan}>{activeOngoing.length}</span>:null}</>}
          right={<button style={{...linkBtn,color:ongoingOpen?C.amber:C.dim}} onClick={()=>setOngoingOpen(o=>!o)}><Icon name="plus" size={14}/>Добавить</button>} />
        {activeOngoing.map(o=>{ const left = o.endDate ? daysBetween(selectedDate, o.endDate) : null; const ran = daysBetween(o.startDate, selectedDate);
          return (
          <div key={o.id} style={S.taskRow}>
            <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:2}}>
              <span style={{overflowWrap:'anywhere',fontSize:14.5}}>{o.text}</span>
              <span style={{fontSize:12,color:left!=null&&left<=1?C.amber:C.dim}}>{o.endDate ? `до ${o.endDate.slice(8,10)}.${o.endDate.slice(5,7)} · ${left===0?'последний день':`осталось ${left} дн.`}` : `без срока · идёт ${ran+1} дн.`}</span>
            </div>
            <button style={S.btnGhost} onClick={()=>finishOngoing(o.id)}>Готово</button>
            <ConfirmIconBtn onConfirm={()=>deleteOngoing(o.id)} title="удалить" confirmLabel="удалить?" />
          </div>); })}
        {activeOngoing.length===0 && !ongoingOpen && <div style={S.emptyState}>Нет задач на несколько дней.</div>}
        {ongoingOpen && (
          <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
            <input autoFocus style={{...S.input,flex:'1 1 160px'}} placeholder="Задача" value={ongoingText} onChange={e=>setOngoingText(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') submitOngoing(); if(e.key==='Escape') setOngoingOpen(false); }} />
            <input style={{...S.input,flex:'0 1 150px'}} type="date" value={ongoingEnd} onChange={e=>setOngoingEnd(e.target.value)} onClick={openDatePicker} aria-label="До какого числа (необязательно)" title="До какого числа (необязательно)" />
            <button style={{...S.iconBtnAmber,opacity:ongoingText.trim()?1:.45}} aria-label="Добавить" onClick={submitOngoing}><Icon name="plus" size={18}/></button>
          </div>
        )}
      </div>
      )}
    </div>
  );

  const tagChips = (list, activeList, toggle, remove, editing, kind) => list.map(tg=>{ const active=activeList.includes(tg);
    const on = kind==='anti' ? {background:tint(C.red,.18),color:C.red} : {background:tint(C.amber,.16),color:C.amber};
    return (
      <div key={tg} className="chip" style={{...(active?on:{background:C.panelAlt,color:C.dim}),paddingRight:editing?4:11}} onClick={()=>!editing && toggle(tg)}>
        <span>{tg}</span>
        {editing && <ConfirmIconBtn onConfirm={()=>remove(tg)} title={kind==='anti'?'удалить анти-тег':'удалить тег'} confirmLabel="удалить?" />}
      </div>
    ); });
  const addChip = (show, setShow, val, setVal, add) => show ? (
    <div style={{display:'flex',gap:6,alignItems:'center'}}>
      <input autoFocus style={{...S.input,width:130,flex:'none',padding:'6px 10px',fontSize:13}} value={val} onChange={e=>setVal(e.target.value)} placeholder="Название"
        onKeyDown={e=>{ if(e.key==='Enter' && val.trim()){ add(val.trim()); setVal(''); setShow(false); } if(e.key==='Escape'){ setShow(false); setVal(''); } }} />
      <button style={{...S.iconBtnAmber,width:32,height:32}} aria-label="Добавить" onClick={()=>{ if(val.trim()){ add(val.trim()); setVal(''); } setShow(false); }}><Icon name="check" size={15}/></button>
    </div>
  ) : <button className="chip" style={{background:'transparent',border:`1px dashed ${C.faint}`,color:C.dim}} aria-label="Добавить" onClick={()=>setShow(true)}><Icon name="plus" size={13}/></button>;

  const gameRow = (key, icon, title, meta, content) => { const open = !collapsedUI[key]; return (
    <div style={{borderBottom:`1px solid ${C.border}`}}>
      <button onClick={()=>onToggleUI && onToggleUI(key)} aria-expanded={open}
        style={{display:'flex',alignItems:'center',gap:10,width:'100%',background:'none',border:'none',color:C.text,padding:'12px 0',cursor:'pointer',fontFamily:'inherit',fontSize:14.5,textAlign:'left'}}>
        <span style={{color:C.dim,display:'flex'}}><Icon name={icon}/></span>
        <span style={{flex:1}}>{title}</span>
        <span style={{fontSize:12,color:C.dim,fontVariantNumeric:'tabular-nums'}}>{meta}</span>
        <span style={{color:C.dim,display:'flex',transform:open?'rotate(90deg)':'none',transition:'transform .15s'}}><Icon name="chevR"/></span>
      </button>
      {open && <div className="anim-collapse" style={{padding:'0 0 12px 26px'}}>{content}</div>}
    </div>
  ); };

  const right = (
    <div>
      {vis('today.rating') && (
      <div style={S.panel}>
        <SectionHead title="Оценка дня" right={
          <span style={{fontSize:16,fontWeight:700,fontVariantNumeric:'tabular-nums',color:ratingDraft!=null?C.text:C.dim}}>
            {ratingDraft!=null ? <>{fmt1(ratingDraft)} <span style={{fontSize:12,color:C.dim,fontWeight:500}}>/ 10</span></> : <span style={{fontSize:13,fontWeight:500}}>не оценён</span>}
          </span>} />
        <input type="range" className="lo-range" min="1" max="10" step="0.1" aria-label="Оценка дня от 1 до 10"
          value={ratingDraft ?? 5} style={{width:'100%',opacity:ratingDraft==null?.45:1,'--p':`${((ratingDraft ?? 5)-1)/9*100}%`}}
          onChange={e=>setRatingDraft(Math.round(parseFloat(e.target.value)*10)/10)}
          onPointerUp={commitRating} onTouchEnd={commitRating} onKeyUp={commitRating} onBlur={commitRating} />
        <div style={{display:'flex',justifyContent:'space-between',fontSize:10.5,color:C.faint,fontVariantNumeric:'tabular-nums',padding:'0 2px'}}>
          {Array.from({length:10},(_,i)=><span key={i}>{i+1}</span>)}
        </div>
      </div>
      )}

      {vis('today.sleep') && (
      <div style={{...S.panel,display:'flex',alignItems:'center',gap:12}}>
        <div style={{...S.panelTitle,marginBottom:0,flex:1}}>Сон</div>
        <button style={S.counterBtn} aria-label="Меньше сна" onClick={()=>setSleep((entry.sleepHours ?? SLEEP_START) - (entry.sleepHours==null?0:SLEEP_STEP))}><Icon name="minus" size={16}/></button>
        <div style={{display:'flex',alignItems:'baseline',gap:4}}>
          <input style={{...S.input,width:58,flex:'none',textAlign:'center',padding:'6px 4px',fontWeight:600,fontVariantNumeric:'tabular-nums'}} inputMode="decimal" placeholder="—"
            aria-label="Часов сна" value={sleepInput===''?'':String(sleepInput).replace('.',',')} onChange={e=>setSleepInput(e.target.value)}
            onBlur={commitSleepInput} onKeyDown={e=>{ if(e.key==='Enter') e.currentTarget.blur(); }} />
          <span style={{fontSize:13,color:C.dim}}>ч</span>
        </div>
        <button style={S.counterBtn} aria-label="Больше сна" onClick={()=>setSleep((entry.sleepHours ?? SLEEP_START) + (entry.sleepHours==null?0:SLEEP_STEP))}><Icon name="plus" size={16}/></button>
      </div>
      )}

      {vis('today.tags') && (
      <div style={S.panel}>
        <SectionHead title="Теги" right={<button style={{...linkBtn,color:tagEdit?C.amber:C.dim}} onClick={()=>setTagEdit(v=>!v)}>{tagEdit?'Готово':'Правка'}</button>} />
        <div style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center',marginTop:6}}>
          {tagChips(tags, entry.tags||[], toggleTagOnDay, removeTagGlobal, tagEdit, 'tag')}
          {addChip(showTagInput, setShowTagInput, newTagInput, setNewTagInput, addTagGlobal)}
        </div>
      </div>
      )}

      {vis('today.antitags') && (
      <div style={S.panel}>
        <SectionHead color={C.red} title={<>Анти-теги<span style={{...S.dimSpan,color:tint(C.red,.8)}}>−{antiXp} XP за каждый</span></>}
          right={<button style={{...linkBtn,color:antiEdit?C.amber:C.dim}} onClick={()=>setAntiEdit(v=>!v)}>{antiEdit?'Готово':'Правка'}</button>} />
        <div style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center',marginTop:6}}>
          {tagChips(antiTags, entry.antiTags||[], toggleAntiTagOnDay, removeAntiTagGlobal, antiEdit, 'anti')}
          {addChip(showAntiInput, setShowAntiInput, newAntiInput, setNewAntiInput, addAntiTagGlobal)}
        </div>
        {(entry.antiTags||[]).length>0 && <div style={{fontSize:12,color:C.red,marginTop:8}}>Отмечено {(entry.antiTags||[]).length}: здоровье снизится на {hpAnti*(entry.antiTags||[]).length} на следующий день.</div>}
      </div>
      )}

      {vis('today.note') && (
      <div style={S.panel}>
        <SectionHead title="Что было и почему" />
        <textarea style={{...S.textarea,marginTop:6}} rows={5} placeholder="Что получилось, что нет и почему" value={noteInput}
          onChange={e=>setNoteInput(e.target.value)} onBlur={()=>updateEntry({note:noteInput})} aria-label="Заметка дня" />
      </div>
      )}

      {isToday && ((vis('today.coach') && coachInsights.length>0) || (vis('today.quests') && quests.length>0) || (vis('today.weekly') && weekly)) && (
      <div style={S.panel}>
        <SectionHead title="Игра" />
        <div style={{borderTop:`1px solid ${C.border}`,marginTop:6}}>
          {vis('today.coach') && coachInsights.length>0 && gameRow('coach','spark','Тренер',`${coachInsights.length}`,
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {coachInsights.map((ins,i)=>(
                <div key={i} style={{display:'flex',gap:8,fontSize:13,lineHeight:1.45,color:ins.tone==='warn'?C.amber:C.text}}>
                  <span style={{flex:'none'}}>{ins.icon}</span><span style={{overflowWrap:'anywhere'}}>{ins.text}</span>
                </div>))}
            </div>)}
          {vis('today.quests') && quests.length>0 && gameRow('quests','check','Задания дня',`${questsDone} из ${quests.length} · +${questsXp}`,
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              {/* отложенные («по итогам дня») не показываем выполненными до начисления. session 032 */}
              {quests.map(q=>{ const dDone = q.deferred ? q.claimed : q.done; return (
                <div key={q.id} style={{display:'flex',alignItems:'center',gap:10,fontSize:13}}>
                  <span style={{width:16,height:16,borderRadius:'50%',flex:'none',display:'grid',placeItems:'center',background:dDone?C.amber:'transparent',border:`1.5px solid ${dDone?C.amber:'#4A4E55'}`,color:C.bg}}>{dDone && <Icon name="check" size={10} stroke={3}/>}</span>
                  <span style={{flex:1,minWidth:0,color:dDone?C.dim:C.text,textDecoration:dDone?'line-through':'none',overflowWrap:'anywhere'}}>{q.label}{q.deferred&&!q.claimed?<span style={{color:C.dim,fontSize:11.5}}> · по итогам дня</span>:null}</span>
                  <span style={{fontSize:12,color:q.claimed?C.green:C.dim,fontVariantNumeric:'tabular-nums'}}>+{q.xp}</span>
                </div>); })}
            </div>)}
          {vis('today.weekly') && weekly && gameRow('weekly','achievements','Испытание недели',weekly.claimed?'пройдено':`${Math.min(weekly.cur,weekly.target)} / ${weekly.target} · +${WEEKLY_XP}`,
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              <div style={{display:'flex',gap:8,fontSize:13}}><span>{weekly.chal.icon}</span><span style={{flex:1,overflowWrap:'anywhere'}}>{weekly.chal.label}</span></div>
              <div style={{height:4,background:C.panelAlt,borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',background:weekly.done?C.green:C.amber,width:`${Math.min(100,weekly.cur/weekly.target*100)}%`}}/></div>
              <div style={{fontSize:12,color:weekly.claimed||weekly.done?C.green:C.dim}}>{weekly.claimed?`Пройдено · +${WEEKLY_XP} XP`:weekly.done?`Выполнено · +${WEEKLY_XP} XP начислено`:`Награда +${WEEKLY_XP} XP`}</div>
            </div>)}
        </div>
      </div>
      )}
    </div>
  );

  return <div className="grid2" style={S.grid2}>{left}{right}</div>;
}
