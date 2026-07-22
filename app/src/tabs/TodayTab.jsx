// Вкладка/раздел: TodayTab (вынесено из App.jsx, session: decompose phase 3)
import { useEffect, useState } from 'react';
import { addDays, openDatePicker, todayStr } from '../lib/dates.js';
import { maskMoney } from '../lib/format.js';
import { WEEKLY_XP } from '../lib/gamify.js';
import { goalLinksOf } from '../lib/goals.js';
import { vis } from '../lib/storage.js';
import { S } from '../lib/styles.js';
import { C } from '../lib/theme.js';
import { GoalLinkPicker } from '../ui/GoalLinkPicker.jsx';
import { ConfirmIconBtn, Select } from '../ui/primitives.jsx';

export function TodayTab({entry, selectedDate, setSelectedDate, addTask, toggleTask, deleteTask, updateEntry, goals,
  tags, toggleTagOnDay, addTagGlobal, removeTagGlobal,
  antiTags=[], toggleAntiTagOnDay, addAntiTagGlobal, removeAntiTagGlobal, antiXp=15, hpAnti=5,
  dailyTasks, toggleDaily, addDailyTask, deleteDailyTask,
  ongoing, addOngoing, finishOngoing, deleteOngoing, bills, maskOps=false,
  taskTemplates=[], saveTaskTemplate, applyTaskTemplate, deleteTaskTemplate, carryOverTasks, prevUndoneCount=0,
  isToday=true, quests=[], weekly=null, combo={streak:0,mult:1}, coachInsights=[], collapsedUI={}, onToggleUI}){
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
  const [newAntiInput,setNewAntiInput] = useState('');
  const [showAntiInput,setShowAntiInput] = useState(false);
  const [newDailyText,setNewDailyText] = useState('');
  const [ongoingText,setOngoingText] = useState('');
  const [ongoingEnd,setOngoingEnd] = useState('');

  // Ре-синк ПОЛЕЙ дня с загруженным entry. Раньше зависело только от selectedDate → на первом рендере
  // entry пуст (данные грузятся асинхронно), а когда подгрузятся, поле «что было · почему» / сон
  // оставались пустыми, пока не переключишь дату туда-обратно. Добавлены entry.note/sleepHours в deps:
  // при вводе они не меняются (сохранение onBlur), поэтому набор текста не перетирается. session: dayfields-sync.
  useEffect(()=>{ setRatingEdit(false); }, [selectedDate]);
  useEffect(()=>{ setNoteInput(entry.note || ''); }, [selectedDate, entry.note]);
  useEffect(()=>{ setSleepInput(entry.sleepHours ?? ''); }, [selectedDate, entry.sleepHours]);

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

        {isToday && vis('today.coach') && coachInsights.length>0 && (() => { const isC=!!collapsedUI.coach; return (
        <div style={S.panel}>
          <div style={{...S.panelTitle,cursor:'pointer',display:'flex',alignItems:'center',marginBottom:isC?0:10}} onClick={()=>onToggleUI && onToggleUI('coach')}>
            <span style={{marginRight:6}}>{isC?'▶':'▼'}</span>🧠 Тренер <span style={S.dimSpan}>{coachInsights.length}</span>
          </div>
          {!isC && coachInsights.map((ins,i)=>(
            <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'5px 0',borderBottom:i<coachInsights.length-1?`1px solid ${C.border}`:'none'}}>
              <span style={{fontSize:15,flexShrink:0}}>{ins.icon}</span>
              <span style={{flex:1,minWidth:0,fontSize:12.5,color:ins.tone==='warn'?C.amber:C.text,overflowWrap:'anywhere',lineHeight:1.45}}>{ins.text}</span>
            </div>
          ))}
        </div>
        ); })()}

        {isToday && vis('today.quests') && quests.length>0 && (() => { const isC=!!collapsedUI.quests; return (
        <div style={S.panel}>
          <div style={{...S.panelTitle,cursor:'pointer',display:'flex',alignItems:'center',marginBottom:isC?0:10}} onClick={()=>onToggleUI && onToggleUI('quests')}>
            <span style={{marginRight:6}}>{isC?'▶':'▼'}</span>🎯 Задания дня <span style={S.dimSpan}>{quests.filter(q=>q.done).length}/{quests.length}</span>
          </div>
          {!isC && quests.map(q=>(
            <div key={q.id} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0'}}>
              <span style={{fontSize:15,opacity:q.done?1:.5}}>{q.done?'✅':q.icon}</span>
              <span style={{flex:1,minWidth:0,fontSize:12.5,color:q.done?C.green:C.text,textDecoration:q.done?'line-through':'none',overflowWrap:'anywhere'}}>{q.label}</span>
              <span style={{fontSize:11,color:q.claimed?C.green:C.dim,fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>+{q.xp}{q.claimed?' ✓':''}</span>
            </div>
          ))}
        </div>
        ); })()}

        {isToday && vis('today.weekly') && weekly && (() => { const isC=!!collapsedUI.weekly; return (
        <div style={S.panel}>
          <div style={{...S.panelTitle,cursor:'pointer',display:'flex',alignItems:'center',marginBottom:isC?0:10}} onClick={()=>onToggleUI && onToggleUI('weekly')}>
            <span style={{marginRight:6}}>{isC?'▶':'▼'}</span>🏆 Испытание недели{isC && weekly.claimed ? <span style={S.dimSpan}>✓</span> : isC ? <span style={S.dimSpan}>{Math.min(weekly.cur,weekly.target)}/{weekly.target}</span> : null}
          </div>
          {!isC && <>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <span style={{fontSize:15}}>{weekly.chal.icon}</span>
            <span style={{flex:1,minWidth:0,fontSize:12.5,overflowWrap:'anywhere'}}>{weekly.chal.label}</span>
            <span style={{fontSize:11,color:weekly.done?C.green:C.dim,fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>{Math.min(weekly.cur,weekly.target)}/{weekly.target}</span>
          </div>
          <div style={{height:5,background:C.panelAlt,borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',background:weekly.done?C.green:C.amber,width:`${Math.min(100,weekly.cur/weekly.target*100)}%`}}/></div>
          <div style={{fontSize:10.5,color:weekly.claimed?C.green:C.dim,marginTop:5}}>{weekly.claimed?`✓ пройдено · +${WEEKLY_XP} XP`:weekly.done?`выполнено! +${WEEKLY_XP} XP начислено`:`награда +${WEEKLY_XP} XP`}</div>
          </>}
        </div>
        ); })()}

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

        {vis('today.antitags') && (
        <div style={S.panel}>
          <div style={{...S.panelTitle, color:C.red}}>🚫 Анти-теги дня <span style={S.dimSpan}>−{antiXp} XP</span></div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>
            {antiTags.map(tg=>{ const active=(entry.antiTags||[]).includes(tg);
              return <div key={tg} className="chip" style={{background:active?C.red:C.panelAlt, color:active?'#1A0B0B':C.dim, borderColor:active?C.red:C.border, display:'inline-flex', alignItems:'center', gap:4, paddingTop:2, paddingBottom:2}}>
                <span style={{cursor:'pointer'}} onClick={()=>toggleAntiTagOnDay(tg)}>{tg}</span>
                <ConfirmIconBtn onConfirm={()=>removeAntiTagGlobal(tg)} title="удалить анти-тег" />
              </div>; })}
            {showAntiInput ? (
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <input autoFocus style={{...S.input, maxWidth:120, minWidth:80}} value={newAntiInput} onChange={e=>setNewAntiInput(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter' && newAntiInput.trim()){ addAntiTagGlobal(newAntiInput.trim()); setNewAntiInput(''); setShowAntiInput(false); } if(e.key==='Escape'){ setShowAntiInput(false); setNewAntiInput(''); } }} />
                <button title="добавить анти-тег" style={{...S.iconBtnAmber,width:30,height:30,fontSize:14}}
                  onClick={()=>{ if(newAntiInput.trim()){ addAntiTagGlobal(newAntiInput.trim()); setNewAntiInput(''); } setShowAntiInput(false); }}>✓</button>
                <button className="icon-btn" onClick={()=>{ setShowAntiInput(false); setNewAntiInput(''); }}>✕</button>
              </div>
            ) : <div className="chip" style={{background:C.panelAlt,color:C.dim,borderColor:C.border}} onClick={()=>setShowAntiInput(true)}>+ добавить</div>}
          </div>
          {(entry.antiTags||[]).length>0 && <div style={{fontSize:10.5,color:C.red,marginTop:8}}>сегодня отмечено {(entry.antiTags||[]).length} · здоровье снизится на {hpAnti*(entry.antiTags||[]).length} на следующий день</div>}
        </div>
        )}
      </div>

      <div>
        {vis('today.rating') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Оценка дня</div>
          {!ratingEdit ? (
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1,fontFamily:"'JetBrains Mono',monospace",fontSize:16,fontWeight:700}}>{entry.rating!=null?`${entry.rating.toLocaleString('ru-RU')} / 10`:<span style={{color:C.dim,fontWeight:400,fontSize:13}}>не оценён</span>}</div>
              <button style={{...S.exportBtn,borderColor:C.amber,color:C.amber}} onClick={()=>{ setRatingDraft(entry.rating||5); setRatingEdit(true); }}>✏ {entry.rating!=null?'изменить':'оценить'}</button>
            </div>
          ) : (
            <div>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <input type="range" min="1" max="10" step="0.1" value={ratingDraft} style={{flex:1}} onChange={e=>setRatingDraft(Math.round(parseFloat(e.target.value)*10)/10)} />
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:16,fontWeight:700,minWidth:34,textAlign:'right'}}>{ratingDraft.toLocaleString('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1})}</div>
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
