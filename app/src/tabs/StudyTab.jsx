// Вкладка «Дела» (вынесено из App.jsx, session: decompose phase 3). Редизайн «Тихий» — session 043 (Э4).
// Функции прежние: эпики (базовые+свои), важность/срочность (4 уровня), дедлайн и просрочка, статус в строке,
// фильтр по статусу, сортировка, сворачивание эпиков, архив (вернуть/удалить), удаление.
// Новое: важность/срочность — цветные метки словами + полоса слева; статус всегда виден под названием
// (раньше на телефоне переключатель уезжал); «свернуть/развернуть все»; правка дела после создания
// (поля те же — updateStudyTask и раньше принимал патч).
import { useMemo, useState } from 'react';
import { BASE_EPICS, IMPORTANCE_COLOR, STUDY_IMPORTANCE, STUDY_STATUSES, STUDY_URGENCY, URGENCY_COLOR } from '../lib/constants.js';
import { daysBetween, openDatePicker, todayStr } from '../lib/dates.js';
import { S } from '../lib/styles.js';
import { C, tint } from '../lib/theme.js';
import { Icon } from '../ui/Icon.jsx';
import { ConfirmIconBtn, Select, StatusSeg } from '../ui/primitives.jsx';

const SORTS = [{value:'createdAt',label:'по дате'},{value:'importance',label:'по важности'},{value:'urgency',label:'по срочности'},{value:'deadline',label:'по дедлайну'}];
const ddmm = (ds) => new Date(ds+'T00:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
const Lvl = ({text, color}) => text ? <span style={{fontSize:11,fontWeight:600,borderRadius:6,padding:'2px 7px',whiteSpace:'nowrap',
  background:color===C.dim?C.panelAlt:tint(color,.16),color:color===C.dim?C.dim:color}}>{text}</span> : null;

function deadlineText(t, today){
  if(!t.deadline) return null;
  const d = daysBetween(today, t.deadline);
  if(t.status==='Выполнено') return {txt:ddmm(t.deadline), col:C.dim};
  if(d<0) return {txt:`просрочено ${-d} ${-d===1?'день':(-d<5?'дня':'дней')}`, col:C.red, bad:true};
  if(d===0) return {txt:'сегодня', col:C.amber};
  if(d<=2) return {txt:d===1?'завтра':'послезавтра', col:C.amber};
  return {txt:`${ddmm(t.deadline)} · через ${d} дн.`, col:C.dim};
}

// Поля дела (создание и правка): эпик, название, важность, срочность, дедлайн.
function StudyForm({init, epicOptions, onSubmit, onCancel, submitLabel}){
  const [epic,setEpic] = useState(init.epic||''); const [task,setTask] = useState(init.task||'');
  const [importance,setImportance] = useState(init.importance||STUDY_IMPORTANCE[1]); const [urgency,setUrgency] = useState(init.urgency||STUDY_URGENCY[1]);
  const [deadline,setDeadline] = useState(init.deadline||'');
  const submit = () => { if(!task.trim()) return; onSubmit({epic:epic.trim()||'Входящие', task:task.trim(), importance, urgency, deadline:deadline||undefined}); };
  return (
    <div style={{...S.plate,display:'flex',flexDirection:'column',gap:10}}>
      <input autoFocus style={{...S.input,background:C.bg}} placeholder="Что нужно сделать" value={task} aria-label="Что нужно сделать"
        onChange={e=>setTask(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') submit(); if(e.key==='Escape' && onCancel) onCancel(); }} />
      <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
        {epicOptions.map(e=><button key={e} className="chip" onClick={()=>setEpic(e)} style={{fontFamily:'inherit',background:epic===e?tint(C.amber,.16):C.bg,color:epic===e?C.amber:C.dim}}>{e}</button>)}
        <input style={{...S.input,background:C.bg,flex:'0 1 150px',padding:'5px 10px',fontSize:12.5}} placeholder="Новый эпик" value={epicOptions.includes(epic)?'':epic} aria-label="Новый эпик" onChange={e=>setEpic(e.target.value)} />
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:8}}>
        <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:12,color:C.dim}}>Важность
          <Select small value={importance} onChange={setImportance} options={STUDY_IMPORTANCE.map(v=>({value:v,label:v,dotColor:IMPORTANCE_COLOR[v]}))} /></label>
        <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:12,color:C.dim}}>Срочность
          <Select small value={urgency} onChange={setUrgency} options={STUDY_URGENCY.map(v=>({value:v,label:v,dotColor:URGENCY_COLOR[v]}))} /></label>
        <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:12,color:C.dim}}>Дедлайн
          <div style={{display:'flex',gap:4,alignItems:'center'}}>
            <input style={{...S.input,background:C.bg,padding:'5px 8px',fontSize:12.5}} type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} onClick={openDatePicker} aria-label="Дедлайн" />
            {deadline && <button className="icon-btn" aria-label="Убрать дедлайн" onClick={()=>setDeadline('')}><Icon name="x" size={14}/></button>}
          </div></label>
      </div>
      <div style={{display:'flex',gap:8}}>
        <button style={{...S.btnPrimary,opacity:task.trim()?1:.45}} onClick={submit}>{submitLabel}</button>
        {onCancel && <button style={S.exportBtn} onClick={onCancel}>Отмена</button>}
      </div>
    </div>
  );
}

export function StudyTab({study, addStudyTask, updateStudyTask, deleteStudyTask, archiveStudyTask, archive=[], deleteArchivedStudy, restoreStudy, collapsed={}, onToggleCollapse, onSetCollapseAll}){
  const [addOpen,setAddOpen] = useState(false);
  const [archiveShow,setArchiveShow] = useState(false);
  const [filterStatus,setFilterStatus] = useState('Все'); const [sortBy,setSortBy] = useState('createdAt');
  const [editId,setEditId] = useState(null);
  const today = todayStr();

  const customEpics = [...new Set(study.map(s=>s.epic))].filter(e=>e && !BASE_EPICS.includes(e));
  const epicOptions = [...BASE_EPICS, ...customEpics];
  const counts = useMemo(()=>{ const c={'Все':study.length}; STUDY_STATUSES.forEach(s=>c[s]=study.filter(x=>x.status===s).length); return c; }, [study]);

  const grouped = useMemo(()=>{
    const filtered = study.filter(s=>filterStatus==='Все'||s.status===filterStatus).slice().sort((a,b)=>{
      if(sortBy==='createdAt') return a.createdAt>b.createdAt?-1:1;
      if(sortBy==='importance') return STUDY_IMPORTANCE.indexOf(b.importance)-STUDY_IMPORTANCE.indexOf(a.importance);
      if(sortBy==='urgency') return STUDY_URGENCY.indexOf(b.urgency)-STUDY_URGENCY.indexOf(a.urgency);
      if(sortBy==='deadline') return (a.deadline||'9999')>(b.deadline||'9999')?1:-1;
      return 0;
    });
    // порядок эпиков: базовые вперёд, затем остальные
    const map={}; filtered.forEach(s=>{ (map[s.epic]=map[s.epic]||[]).push(s); });
    const ordered={}; [...BASE_EPICS, ...Object.keys(map).filter(e=>!BASE_EPICS.includes(e))].forEach(e=>{ if(map[e]) ordered[e]=map[e]; });
    return ordered;
  }, [study, filterStatus, sortBy]);
  const epicNames = Object.keys(grouped);
  const allCollapsed = epicNames.length>0 && epicNames.every(e=>collapsed[e]);
  const STATUS_SHORT = {'Не начато':'Не начато','В процессе':'В работе','Выполнено':'Готово'};

  return (
    <div>
      <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:14,flexWrap:'wrap'}}>
        <div style={{...S.seg,flex:'1 1 100%',order:2}}>
          {['Все',...STUDY_STATUSES].map(s=>(
            <button key={s} onClick={()=>setFilterStatus(s)} style={{...S.segBtn,flex:1,whiteSpace:'nowrap',padding:'6px 4px',background:filterStatus===s?C.panelAlt:'transparent',color:filterStatus===s?C.text:C.dim}}>
              {s==='Все'?'Все':STATUS_SHORT[s]} <span style={{opacity:.65,fontWeight:500}}>{counts[s]}</span></button>))}
        </div>
        <button style={{...S.btnPrimary,marginLeft:'auto',order:1}} onClick={()=>setAddOpen(o=>!o)} aria-expanded={addOpen}><Icon name={addOpen?'x':'plus'} size={16}/>{addOpen?'Закрыть':'Новое дело'}</button>
      </div>

      {addOpen && (
        <div style={{marginBottom:20}}>
          <StudyForm init={{}} epicOptions={epicOptions} submitLabel="Добавить дело" onCancel={()=>setAddOpen(false)}
            onSubmit={(v)=>{ addStudyTask({...v, status:'Не начато', note:''}); setAddOpen(false); }} />
        </div>
      )}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:10}}>
        <Select small style={{width:170}} value={sortBy} onChange={setSortBy} options={SORTS} />
        {epicNames.length>1 && onSetCollapseAll && (
          <button style={{background:'none',border:'none',color:C.dim,fontSize:12.5,cursor:'pointer',fontFamily:'inherit'}}
            onClick={()=>onSetCollapseAll(epicNames, !allCollapsed)}>{allCollapsed?'Развернуть все':'Свернуть все'}</button>
        )}
      </div>

      {epicNames.length===0 && (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,padding:'32px 10px',textAlign:'center',color:C.dim,fontSize:13.5}}>
          <span style={{width:44,height:44,borderRadius:'50%',background:C.panel,display:'grid',placeItems:'center',color:C.faint}}><Icon name="study" size={22}/></span>
          <b style={{color:C.text,fontSize:15}}>{filterStatus==='Все'?'Дел пока нет':'С таким статусом дел нет'}</b>
          {filterStatus==='Все' && <span>Дела — то, что тянется дольше дня: с важностью, срочностью и дедлайном.</span>}
        </div>
      )}

      {Object.entries(grouped).map(([epicName,tasks])=>{
        const isC = !!collapsed[epicName]; const doneCount = tasks.filter(t=>t.status==='Выполнено').length;
        const overdueN = tasks.filter(t=>t.deadline && t.status!=='Выполнено' && t.deadline<today).length;
        return (
          <div key={epicName} style={{marginBottom:isC?0:16,borderTop:`1px solid ${C.border}`}}>
            <button onClick={()=>onToggleCollapse && onToggleCollapse(epicName)} aria-expanded={!isC}
              style={{display:'flex',alignItems:'center',gap:8,width:'100%',background:'none',border:'none',color:C.text,cursor:'pointer',padding:'12px 0',fontFamily:'inherit',fontSize:15,fontWeight:600,textAlign:'left'}}>
              <span style={{color:C.dim,display:'flex',transform:isC?'none':'rotate(90deg)',transition:'transform .15s'}}><Icon name="chevR" size={15}/></span>
              <span style={{flex:1,minWidth:0,overflowWrap:'anywhere'}}>{epicName}</span>
              {overdueN>0 && <span style={{fontSize:11.5,fontWeight:600,color:C.red}}>{overdueN} просроч.</span>}
              <span style={{fontSize:12,color:C.dim,fontWeight:500,fontVariantNumeric:'tabular-nums'}}>{doneCount} / {tasks.length}</span>
            </button>
            {!isC && tasks.map(t=>{
              const done = t.status==='Выполнено';
              const dl = deadlineText(t, today);
              if(editId===t.id) return (
                <div key={t.id} style={{margin:'4px 0 10px'}}>
                  <StudyForm init={t} epicOptions={epicOptions} submitLabel="Сохранить" onCancel={()=>setEditId(null)}
                    onSubmit={(v)=>{ updateStudyTask(t.id, v); setEditId(null); }} />
                </div>
              );
              return (
                <div key={t.id} style={{display:'flex',gap:12,padding:'11px 0',borderBottom:`1px solid ${C.border}`,alignItems:'stretch'}}>
                  <span title={`Важность: ${t.importance||'—'}`} style={{width:3,borderRadius:3,flex:'none',background:done?C.panelAlt:(IMPORTANCE_COLOR[t.importance]||C.panelAlt)}}/>
                  <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:7}}>
                    <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                      <span style={{flex:1,minWidth:0,fontSize:14.5,color:done?C.dim:C.text,textDecoration:done?'line-through':'none',textDecorationColor:C.faint,overflowWrap:'anywhere'}}>{t.task}</span>
                      <button className="icon-btn" aria-label="Изменить дело" title="изменить" onClick={()=>setEditId(t.id)}><Icon name="edit" size={15}/></button>
                    </div>
                    {!done && (t.importance || t.urgency || dl) && (
                      <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center'}}>
                        <Lvl text={t.importance} color={IMPORTANCE_COLOR[t.importance]||C.dim} />
                        <Lvl text={t.urgency} color={URGENCY_COLOR[t.urgency]||C.dim} />
                        {dl && <span style={{fontSize:11.5,fontWeight:dl.bad?600:500,color:dl.col,display:'inline-flex',gap:3,alignItems:'center'}}><Icon name="clock" size={12}/>{dl.txt}</span>}
                      </div>
                    )}
                    <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                      <StatusSeg value={t.status} onChange={v=>updateStudyTask(t.id,{status:v})} />
                      <span style={{marginLeft:'auto',display:'flex',gap:2}}>
                        <ConfirmIconBtn onConfirm={()=>archiveStudyTask(t.id)} icon="archive" confirmLabel="в архив?" title="в архив (сохранить)" />
                        <ConfirmIconBtn onConfirm={()=>deleteStudyTask(t.id)} icon="trash" confirmLabel="удалить?" title="удалить безвозвратно" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Архив дел — внизу, свёрнут по умолчанию (session 016) */}
      {archive.length>0 && (
        <div style={{marginTop:10,borderTop:`1px solid ${C.border}`}}>
          <button onClick={()=>setArchiveShow(s=>!s)} aria-expanded={archiveShow}
            style={{display:'flex',alignItems:'center',gap:8,width:'100%',background:'none',border:'none',color:C.dim,cursor:'pointer',padding:'12px 0',fontFamily:'inherit',fontSize:13}}>
            <Icon name="archive" size={15}/><span style={{flex:1,textAlign:'left'}}>Архив дел · {archive.length}</span>
            <span style={{display:'flex',transform:archiveShow?'rotate(90deg)':'none',transition:'transform .15s'}}><Icon name="chevR" size={14}/></span>
          </button>
          {archiveShow && (
            <div className="anim-collapse">
              {[...archive].reverse().map((s,i)=>(
                <div key={s.id+'_'+s.archivedAt+'_'+i} style={S.taskRow}>
                  <div style={{flex:1,minWidth:0,overflowWrap:'anywhere',display:'flex',flexDirection:'column',gap:2}}>
                    <span style={{fontSize:14,color:s.status==='Выполнено'?C.green:C.text}}>{s.task}</span>
                    <span style={{fontSize:12,color:C.dim}}>{s.epic||'—'} · {s.status||'—'}{s.deadline?` · дедлайн ${s.deadline}`:''} · в архиве с {s.archivedAt}</span>
                  </div>
                  <button style={S.btnGhost} onClick={()=>restoreStudy(s.id, s.archivedAt)}><Icon name="restore" size={14}/>Вернуть</button>
                  <ConfirmIconBtn onConfirm={()=>deleteArchivedStudy(s.id, s.archivedAt)} title="удалить из архива" confirmLabel="удалить?" icon="trash" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
