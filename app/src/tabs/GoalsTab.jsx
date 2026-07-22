// Вкладка/раздел: GoalsTab (вынесено из App.jsx, session: decompose phase 3)
import { useState } from 'react';
import { PERIOD_LABEL } from '../lib/constants.js';
import { daysBetween, toLocalISODate, todayStr } from '../lib/dates.js';
import { S } from '../lib/styles.js';
import { C } from '../lib/theme.js';
import { goalMode as modeOf } from '../lib/goals.js';
import { ConfirmIconBtn, Select } from '../ui/primitives.jsx';

export function GoalsTab({goals, addGoal, setGoalProgress, addGoalSubtask, toggleGoalSubtask, deleteGoalSubtask, deleteGoal, setGoalMode, setGoalCounter, setGoalDeadline, archiveGoal, archive=[], restoreGoal, deleteArchivedGoal, showGoalDeadline=false, collapsed={}, onToggleCollapse}){
  const [text,setText] = useState(''); const [scope,setScope] = useState('week');
  const [subtaskInputs,setSubtaskInputs] = useState({});
  const [archiveShow,setArchiveShow] = useState(false);
  const scopes = [{id:'year',label:'Год'},{id:'month',label:'Месяц'},{id:'week',label:'Неделя'},{id:'day',label:'День'}];
  const addFromForm = () => { if(text.trim()){ addGoal(scope,text.trim()); setText(''); } };
  // modeOf импортирован из lib/goals (goalMode) — единый источник, чтобы привязка/вклад и UI совпадали
  // последний день текущего периода скоупа — неявный дедлайн, если явный не задан (session: goal-deadline-hide)
  const endOfScope = (scope) => {
    const t = todayStr(); const d = new Date(t+'T00:00:00');
    if(scope==='day') return t;
    if(scope==='week'){ const wd=(d.getDay()+6)%7; const end=new Date(d); end.setDate(d.getDate()+(6-wd)); return toLocalISODate(end); } // Пн=0 → до Вс
    if(scope==='month') return toLocalISODate(new Date(d.getFullYear(), d.getMonth()+1, 0));
    if(scope==='year')  return `${d.getFullYear()}-12-31`;
    return null;
  };
  // 🎯 темп к дедлайну (session 025): сколько нужно в день, чтобы успеть; или ✓/просрочено.
  // Дедлайн — явный (g.deadline) ИЛИ неявный = последний день недели/месяца/года скоупа. session: goal-deadline-hide.
  const paceInfo = (g, scope) => {
    const deadline = g.deadline || endOfScope(scope);
    if(!deadline) return null;
    const today = todayStr(); const done=(g.progress||0)>=100;
    if(done) return {done:true, explicit:!!g.deadline};
    if(deadline < today) return {overdue:true, explicit:!!g.deadline};
    const daysLeft = daysBetween(today, deadline) + 1;
    let rem, unit;
    if(modeOf(g)==='counter' && g.counter){ rem=Math.max(0,g.counter.target-(g.counter.current||0)); unit=' шт'; }
    else { rem=Math.max(0,100-(g.progress||0)); unit='%'; }
    return {daysLeft, need: Math.round(rem/Math.max(1,daysLeft)*10)/10, unit, explicit:!!g.deadline};
  };

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
          const isC = !!collapsed[id]; const doneCount = list.filter(g=>(g.progress||0)>=100).length;
          return (
            <div key={id} style={S.panel}>
              <div style={{...S.panelTitle,cursor:'pointer',display:'flex',alignItems:'center',marginBottom:isC?0:10}} onClick={()=>onToggleCollapse && onToggleCollapse(id)}>
                <span style={{marginRight:6}}>{isC?'▶':'▼'}</span>{label} <span style={S.dimSpan}>{avg}%{list.length?` · ${doneCount}/${list.length}`:''}</span>
              </div>
              {!isC && list.length===0 && <div style={S.emptyState}>Целей пока нет</div>}
              {!isC && list.map(g=>{ const mode=modeOf(g); const done=(g.progress||0)>=100;
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
                      <input type="range" min="0" max="100" step="1" value={g.progress||0} style={{flex:1,minWidth:0}} onChange={e=>setGoalProgress(id,g.id,parseInt(e.target.value,10))} />
                      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11.5,color:C.dim,minWidth:34,textAlign:'right'}}>{g.progress||0}%</div>
                    </div>
                  )}

                  {/* дедлайн + темп (session 025; скрытие дедлайна — goal-deadline-hide).
                      Дата-инпут показывается только при settings.showGoalDeadline; темп считается всегда
                      по неявному дедлайну (конец недели/месяца/года), кроме простых целей-галочек без явного дедлайна. */}
                  {(() => { const p=paceInfo(g, id); const showPace = p && (mode!=='none' || g.deadline);
                    if(!showGoalDeadline && !showPace) return null;
                    return (
                    <div style={{marginTop:8,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      {showGoalDeadline && <>
                        <span style={{fontSize:10.5,color:C.dim}}>⏰ дедлайн</span>
                        <input type="date" value={g.deadline||''} onChange={e=>setGoalDeadline(id,g.id,e.target.value)}
                          style={{...S.input,fontSize:11,padding:'4px 6px',minWidth:0,flex:'none',width:140}} />
                        {g.deadline && <span className="icon-btn" style={{fontSize:11,color:C.dim,cursor:'pointer'}} onClick={()=>setGoalDeadline(id,g.id,'')}>✕</span>}
                      </>}
                      {showPace && (p.done
                        ? <span style={{fontSize:10.5,color:C.green}}>✓ выполнено</span>
                        : p.overdue
                          ? <span style={{fontSize:10.5,color:C.red}}>просрочено</span>
                          : <span style={{fontSize:10.5,color:p.need<=0?C.green:C.amber}}>нужно +{p.need}{p.unit}/день · {p.daysLeft} дн.</span>)}
                    </div>
                  ); })()}

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
      {/* Архив целей — внизу, свёрнут по умолчанию (инлайн, как у привычек/дел) */}
      {archive.length>0 && (
        <div style={{marginTop:18}}>
          <div onClick={()=>setArchiveShow(s=>!s)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',userSelect:'none',padding:'6px 2px'}}>
            <span style={{fontSize:12.5,color:C.dim}}>🗄 Архив целей · {archive.length}</span>
            <span style={{color:C.dim,fontSize:12,transition:'transform .2s ease',transform:archiveShow?'rotate(180deg)':'none'}}>▾</span>
          </div>
          {archiveShow && (
            <div className="anim-collapse" style={{marginTop:8}}>
              {[...archive].reverse().map((g,i)=>(
                <div key={g.id+'_'+g.archivedAt+'_'+i} className="row-hover" style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
                  <div style={{flex:1,minWidth:0,overflowWrap:'anywhere'}}>
                    <div style={{fontSize:13,color:(g.progress||0)>=100?C.green:C.text}}>{(g.progress||0)>=100?'✓ ':''}{g.title}</div>
                    <div style={{fontSize:10.5,color:C.dim}}>{PERIOD_LABEL[g.scope]||g.scope} · {g.period||'—'} · {g.progress||0}%{g.completedAt?` · ✅ выполнено ${g.completedAt}`:''} · архив {g.archivedAt}</div>
                  </div>
                  <button className="icon-btn" title="вернуть в активные" style={{color:C.cyan}} onClick={()=>restoreGoal(g.id, g.archivedAt)}>↩</button>
                  <ConfirmIconBtn onConfirm={()=>deleteArchivedGoal(g.id, g.archivedAt)} title="удалить из архива" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
