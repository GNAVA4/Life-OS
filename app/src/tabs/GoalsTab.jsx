// Вкладка «Цели» (вынесено из App.jsx, session: decompose phase 3). Редизайн «Тихий» — session 043 (Э3).
// Функции прежние: 4 периода, создание, переименование, тип (галочка/ползунок/шаги/счётчик) и смена типа без
// потери прогресса, счётчик ±/цель, шаги, дедлайн, темп, архив (вернуть/удалить), сворачивание групп.
// Новое (производное, без новых данных): под целью «осталось X за N дней», в заголовке — дней до конца периода;
// переключатель периода («Все» = прежний обзор всех четырёх групп).
import { useState } from 'react';
import { PERIOD_LABEL } from '../lib/constants.js';
import { daysBetween, monthLabelRu, todayStr } from '../lib/dates.js';
import { endOfScope, goalMode as modeOf, paceInfo } from '../lib/goals.js';
import { S } from '../lib/styles.js';
import { C, tint } from '../lib/theme.js';
import { Icon } from '../ui/Icon.jsx';
import { ConfirmIconBtn } from '../ui/primitives.jsx';
import { Check } from '../ui/Check.jsx';

const SCOPES = [{id:'day',label:'День'},{id:'week',label:'Неделя'},{id:'month',label:'Месяц'},{id:'year',label:'Год'}];
const num = (n) => String(n).replace('.',',');
const ddmm = (ds) => new Date(ds+'T00:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'});

function periodTitle(scope, today){
  const end = endOfScope(scope, today); const left = daysBetween(today, end) + 1;
  const name = scope==='day' ? 'сегодня' : scope==='week' ? 'эта неделя' : scope==='month' ? monthLabelRu(today.slice(0,7)).replace(/\s*\d{4}.*$/,'') : today.slice(0,4)+' год';
  return { name, left: scope==='day' ? null : left };
}

export function GoalsTab({goals, addGoal, setGoalProgress, addGoalSubtask, toggleGoalSubtask, deleteGoalSubtask, deleteGoal, renameGoal, setGoalMode, setGoalCounter, setGoalDeadline, archiveGoal, archive=[], restoreGoal, deleteArchivedGoal, showGoalDeadline=false, collapsed={}, onToggleCollapse}){
  const today = todayStr();
  const [view,setView] = useState('all');
  const [addOpen,setAddOpen] = useState(false);
  const [text,setText] = useState(''); const [scope,setScope] = useState('week');
  const [subtaskInputs,setSubtaskInputs] = useState({});
  const [archiveShow,setArchiveShow] = useState(false);
  const [menuId,setMenuId] = useState(null);
  const [deadlineId,setDeadlineId] = useState(null);
  const [editId,setEditId] = useState(null); const [editText,setEditText] = useState('');
  const saveRename = (sc,gid) => { if(editText.trim() && renameGoal) renameGoal(sc,gid,editText.trim()); setEditId(null); };
  const addFromForm = () => { if(text.trim()){ addGoal(scope,text.trim()); setText(''); setAddOpen(false); } };
  const addStep = (sc,g) => { const v=(subtaskInputs[g.id]||'').trim(); if(v){ addGoalSubtask(sc,g.id,v); setSubtaskInputs({...subtaskInputs,[g.id]:''}); } };
  const shown = view==='all' ? SCOPES : SCOPES.filter(s=>s.id===view);

  const goalItem = (sc, g) => {
    const mode = modeOf(g); const done = (g.progress||0)>=100;
    const p = paceInfo(g, sc, today);
    // сколько осталось — в единицах трекера
    let leftTxt = null;
    if(!done){
      if(mode==='counter' && g.counter) leftTxt = `осталось ${Math.max(0,(g.counter.target||0)-(g.counter.current||0))} шт.`;
      else if(mode==='subtasks') { const st=g.subtasks||[]; leftTxt = st.length ? `осталось ${st.filter(s=>!s.done).length} из ${st.length} шагов` : null; }
      else if(mode==='slider') leftTxt = `осталось ${100-(g.progress||0)}%`;
    }
    const showPace = p && !p.done && (mode!=='none' || g.deadline);
    const behind = p && !p.done && !p.overdue && p.need>0 && mode==='counter' && p.need>=1;
    const menuOpen = menuId===g.id;
    return (
      <div key={g.id} style={{padding:'12px 0',borderBottom:`1px solid ${C.border}`,display:'flex',flexDirection:'column',gap:9}}>
        {editId===g.id ? (
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <input style={S.input} value={editText} autoFocus aria-label="Название цели" onChange={e=>setEditText(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') saveRename(sc,g.id); if(e.key==='Escape') setEditId(null); }} />
            <button style={S.btnPrimary} onClick={()=>saveRename(sc,g.id)}>Сохранить</button>
            <button className="icon-btn" aria-label="Отмена" onClick={()=>setEditId(null)}><Icon name="x" size={16}/></button>
          </div>
        ) : (
          <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
            {mode==='none' && <Check checked={done} onChange={()=>setGoalProgress(sc,g.id,done?0:100)} label={g.title} color={C.green} />}
            <div style={{flex:1,minWidth:0,fontSize:14.5,fontWeight:500,color:done?C.dim:C.text,textDecoration:done?'line-through':'none',textDecorationColor:C.faint,overflowWrap:'anywhere',paddingTop:mode==='none'?2:0}}>{g.title}</div>
            {mode==='counter' && g.counter && (
              <div style={{display:'flex',alignItems:'center',gap:6,flex:'none'}}>
                <button className="cnt-btn" style={S.counterBtn} aria-label="минус" onClick={()=>setGoalCounter(sc,g.id,{current:(g.counter.current||0)-1})}><Icon name="minus" size={15}/></button>
                <span style={{fontVariantNumeric:'tabular-nums',minWidth:52,textAlign:'center',fontWeight:600,color:done?C.green:C.text}}>{g.counter.current||0}<span style={{color:C.dim,fontWeight:500}}> / {g.counter.target}</span></span>
                <button className="cnt-btn" style={S.counterBtn} aria-label="плюс" onClick={()=>setGoalCounter(sc,g.id,{current:(g.counter.current||0)+1})}><Icon name="plus" size={15}/></button>
              </div>
            )}
            {mode==='subtasks' && <span style={{fontSize:12.5,color:C.dim,fontVariantNumeric:'tabular-nums',flex:'none',paddingTop:2}}>{(g.subtasks||[]).filter(s=>s.done).length} / {(g.subtasks||[]).length}</span>}
            {mode==='slider' && <span style={{fontSize:12.5,color:done?C.green:C.dim,fontVariantNumeric:'tabular-nums',flex:'none',paddingTop:2}}>{g.progress||0}%</span>}
            {done && g.completedAt && <span style={{fontSize:11.5,color:C.green,background:tint(C.green,.12),borderRadius:20,padding:'2px 8px',flex:'none'}}>{ddmm(g.completedAt)}</span>}
            <button className="icon-btn" aria-label="Действия с целью" aria-expanded={menuOpen} onClick={()=>setMenuId(menuOpen?null:g.id)}><Icon name="more" size={18}/></button>
          </div>
        )}

        {menuOpen && editId!==g.id && (
          <div className="anim-collapse" style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <button style={S.btnGhost} onClick={()=>{ setEditText(g.title||''); setEditId(g.id); setMenuId(null); }}><Icon name="edit" size={14}/>Переименовать</button>
            {mode!=='none' && <button style={S.btnGhost} onClick={()=>{ setGoalMode(sc,g.id,'none'); setMenuId(null); }}>Сменить тип</button>}
            <button style={S.btnGhost} onClick={()=>{ setDeadlineId(deadlineId===g.id?null:g.id); }}><Icon name="clock" size={14}/>Дедлайн</button>
            <ConfirmIconBtn onConfirm={()=>{ setMenuId(null); archiveGoal(sc,g.id); }} icon={<span style={S.btnGhost}><Icon name="archive" size={14}/>В архив</span>} confirmLabel="в архив?" title="в архив (сохранить)" />
            <ConfirmIconBtn onConfirm={()=>{ setMenuId(null); deleteGoal(sc,g.id); }} icon="trash" confirmLabel="удалить навсегда?" title="удалить безвозвратно" />
          </div>
        )}

        {mode==='none' && !done && (
          <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',paddingLeft:32}}>
            <span style={{fontSize:12,color:C.dim}}>Добавить трекер:</span>
            {[['slider','Ползунок'],['subtasks','Шаги'],['counter','Счётчик']].map(([m,l])=>(
              <button key={m} className="chip" style={{background:C.panelAlt,color:C.text,fontFamily:'inherit'}} onClick={()=>setGoalMode(sc,g.id,m)}>{l}</button>))}
          </div>
        )}

        {mode==='counter' && g.counter && (
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{flex:1,height:4,background:C.panelAlt,borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',background:done?C.green:C.amber,width:`${g.progress||0}%`,borderRadius:4}}/></div>
            <label style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:C.dim}}>цель
              <input key={g.counter.target} style={{...S.input,fontSize:12.5,padding:'4px 6px',width:56,flex:'none',textAlign:'center'}} type="number" inputMode="numeric" aria-label="Цель, штук"
                defaultValue={g.counter.target} onBlur={e=>setGoalCounter(sc,g.id,{target:parseInt(e.target.value,10)||1})} /></label>
          </div>
        )}

        {mode==='slider' && (
          <input type="range" className="lo-range" min="0" max="100" step="1" value={g.progress||0} aria-label={`Прогресс: ${g.title}`}
            style={{width:'100%','--p':`${g.progress||0}%`}} onChange={e=>setGoalProgress(sc,g.id,parseInt(e.target.value,10))} />
        )}

        {mode==='subtasks' && (
          <div style={{display:'flex',flexDirection:'column',gap:6,paddingLeft:2}}>
            {(g.subtasks||[]).map(s=>(
              <div key={s.id} style={{display:'flex',alignItems:'center',gap:10}}>
                <Check checked={s.done} onChange={()=>toggleGoalSubtask(sc,g.id,s.id)} label={s.text} />
                <span style={{flex:1,minWidth:0,fontSize:13.5,color:s.done?C.dim:C.text,textDecoration:s.done?'line-through':'none',textDecorationColor:C.faint,overflowWrap:'anywhere'}}>{s.text}</span>
                <ConfirmIconBtn onConfirm={()=>deleteGoalSubtask(sc,g.id,s.id)} title="удалить шаг" confirmLabel="удалить?" />
              </div>
            ))}
            <div style={{display:'flex',gap:6}}>
              <input style={{...S.input,fontSize:13,padding:'7px 10px'}} placeholder="Новый шаг" value={subtaskInputs[g.id]||''} aria-label="Новый шаг"
                onChange={e=>setSubtaskInputs({...subtaskInputs,[g.id]:e.target.value})} onKeyDown={e=>{ if(e.key==='Enter') addStep(sc,g); }} />
              <button style={{...S.iconBtnAmber,width:34,height:34,opacity:(subtaskInputs[g.id]||'').trim()?1:.45}} aria-label="Добавить шаг" onClick={()=>addStep(sc,g)}><Icon name="plus" size={16}/></button>
            </div>
          </div>
        )}

        {(leftTxt || showPace) && !done && (
          <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',fontSize:12,color:C.dim}}>
            <span>{leftTxt}{leftTxt && p && p.daysLeft ? ` за ${p.daysLeft} дн.` : ''}</span>
            {showPace && (p.overdue
              ? <span style={{color:C.red}}>срок прошёл</span>
              : p.need>0 && mode!=='none' && <span style={{color:behind?C.red:C.amber}}>нужно {num(p.need)}{p.unit==='%'?'%':' шт'}/день</span>)}
          </div>
        )}

        {(g.deadline || deadlineId===g.id || (showGoalDeadline && mode!=='none' && !done)) && (
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            {g.deadline && deadlineId!==g.id ? (
              <button className="chip" onClick={()=>setDeadlineId(g.id)} style={{fontFamily:'inherit',background:p&&p.overdue?tint(C.red,.14):C.panelAlt,color:p&&p.overdue?C.red:C.dim}}>
                <Icon name="clock" size={12}/>дедлайн {ddmm(g.deadline)}{!done && g.deadline>=today ? ` · ${daysBetween(today,g.deadline)+1} дн.`:''}
              </button>
            ) : (
              <>
                <span style={{fontSize:12,color:C.dim}}>Дедлайн</span>
                <input type="date" value={g.deadline||''} aria-label="Дедлайн цели" onChange={e=>{ setGoalDeadline(sc,g.id,e.target.value); }}
                  style={{...S.input,fontSize:12.5,padding:'5px 8px',width:150,flex:'none'}} />
                {g.deadline && <button className="icon-btn" aria-label="Убрать дедлайн" onClick={()=>{ setGoalDeadline(sc,g.id,''); setDeadlineId(null); }}><Icon name="x" size={14}/></button>}
                {deadlineId===g.id && <button style={S.btnGhost} onClick={()=>setDeadlineId(null)}>Готово</button>}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:18,flexWrap:'wrap'}}>
        <div style={{...S.seg,flex:'1 1 260px'}}>
          {[{id:'all',label:'Все'},...SCOPES].map(o=>(
            <button key={o.id} onClick={()=>setView(o.id)} style={{...S.segBtn,flex:1,background:view===o.id?C.panelAlt:'transparent',color:view===o.id?C.text:C.dim}}>{o.label}</button>))}
        </div>
        <button style={S.btnPrimary} onClick={()=>{ if(view!=='all') setScope(view); setAddOpen(o=>!o); }} aria-expanded={addOpen}><Icon name={addOpen?'x':'plus'} size={16}/>{addOpen?'Закрыть':'Цель'}</button>
      </div>

      {addOpen && (
        <div style={{...S.plate,display:'flex',flexDirection:'column',gap:10,marginBottom:22}}>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {SCOPES.map(s=><button key={s.id} className="chip" onClick={()=>setScope(s.id)} style={{fontFamily:'inherit',background:scope===s.id?tint(C.amber,.16):C.panelAlt,color:scope===s.id?C.amber:C.dim}}>{s.label}</button>)}
          </div>
          <div style={{display:'flex',gap:8}}>
            <input autoFocus style={{...S.input,background:C.bg}} placeholder="Формулировка цели" value={text} aria-label="Формулировка цели"
              onChange={e=>setText(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') addFromForm(); }} />
            <button style={{...S.iconBtnAmber,opacity:text.trim()?1:.45}} aria-label="Добавить цель" onClick={addFromForm}><Icon name="plus" size={18}/></button>
          </div>
          <span style={{fontSize:12,color:C.dim}}>Тип трекера (ползунок, шаги, счётчик) выбирается у цели после создания.</span>
        </div>
      )}

      <div style={view==='all'?{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',gap:'0 32px'}:{}}>
        {shown.map(({id,label})=>{
          const list = goals[id]||[];
          const avg = list.length? Math.round(list.reduce((s,g)=>s+(g.progress||0),0)/list.length) : 0;
          const doneCount = list.filter(g=>(g.progress||0)>=100).length;
          const isC = view==='all' && !!collapsed[id];
          const pt = periodTitle(id, today);
          return (
            <div key={id} style={{marginBottom:24}}>
              <button onClick={()=>view==='all' && onToggleCollapse && onToggleCollapse(id)} aria-expanded={!isC}
                style={{display:'flex',alignItems:'center',gap:8,width:'100%',background:'none',border:'none',padding:'0 0 6px',cursor:view==='all'?'pointer':'default',color:C.text,fontFamily:'inherit',textAlign:'left'}}>
                {view==='all' && <span style={{color:C.dim,display:'flex',transform:isC?'none':'rotate(90deg)',transition:'transform .15s'}}><Icon name="chevR" size={14}/></span>}
                <span style={{...S.panelTitle,marginBottom:0,flex:1}}>{label}<span style={S.dimSpan}>{pt.name}{pt.left!=null?` · осталось ${pt.left} дн.`:''}</span></span>
                {list.length>0 && <span style={{fontSize:12,color:C.dim,fontVariantNumeric:'tabular-nums'}}>{doneCount} / {list.length} · {avg}%</span>}
              </button>
              {!isC && list.length===0 && (
                <div style={{...S.emptyState,display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                  <span>Целей на {label.toLowerCase()==='день'?'день':label.toLowerCase()==='год'?'год':label.toLowerCase()==='неделя'?'неделю':'месяц'} нет.</span>
                  <button style={S.btnGhost} onClick={()=>{ setScope(id); setAddOpen(true); }}><Icon name="plus" size={14}/>Добавить</button>
                </div>
              )}
              {!isC && <div style={{borderTop:list.length?`1px solid ${C.border}`:'none'}}>{list.map(g=>goalItem(id,g))}</div>}
            </div>
          );
        })}
      </div>

      {/* Архив целей — внизу, свёрнут по умолчанию */}
      {archive.length>0 && (
        <div style={{marginTop:6}}>
          <button onClick={()=>setArchiveShow(s=>!s)} aria-expanded={archiveShow}
            style={{display:'flex',alignItems:'center',gap:8,width:'100%',background:'none',border:'none',color:C.dim,cursor:'pointer',padding:'8px 0',fontFamily:'inherit',fontSize:13}}>
            <Icon name="archive" size={15}/><span style={{flex:1,textAlign:'left'}}>Архив целей · {archive.length}</span>
            <span style={{display:'flex',transform:archiveShow?'rotate(90deg)':'none',transition:'transform .15s'}}><Icon name="chevR" size={14}/></span>
          </button>
          {archiveShow && (
            <div className="anim-collapse">
              {[...archive].reverse().map((g,i)=>(
                <div key={g.id+'_'+g.archivedAt+'_'+i} style={S.taskRow}>
                  <div style={{flex:1,minWidth:0,overflowWrap:'anywhere',display:'flex',flexDirection:'column',gap:2}}>
                    <span style={{fontSize:14,color:(g.progress||0)>=100?C.green:C.text}}>{g.title}</span>
                    <span style={{fontSize:12,color:C.dim}}>{PERIOD_LABEL[g.scope]||g.scope} · {g.period||'—'} · {g.progress||0}%{g.completedAt?` · выполнена ${g.completedAt}`:''} · в архиве с {g.archivedAt}</span>
                  </div>
                  <button style={S.btnGhost} onClick={()=>restoreGoal(g.id, g.archivedAt)}><Icon name="restore" size={14}/>Вернуть</button>
                  <ConfirmIconBtn onConfirm={()=>deleteArchivedGoal(g.id, g.archivedAt)} title="удалить из архива" confirmLabel="удалить?" icon="trash" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
