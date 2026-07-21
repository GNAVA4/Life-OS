// Вкладка/раздел: StudyTab (вынесено из App.jsx, session: decompose phase 3)
import { useMemo, useState } from 'react';
import { BASE_EPICS, IMPORTANCE_COLOR, STUDY_IMPORTANCE, STUDY_STATUSES, STUDY_URGENCY, URGENCY_COLOR } from '../lib/constants.js';
import { addDays, openDatePicker, todayStr } from '../lib/dates.js';
import { S } from '../lib/styles.js';
import { C } from '../lib/theme.js';
import { ConfirmIconBtn, Select, StatusSeg } from '../ui/primitives.jsx';

export function StudyTab({study, addStudyTask, updateStudyTask, deleteStudyTask, archiveStudyTask, archive=[], deleteArchivedStudy, restoreStudy, collapsed={}, onToggleCollapse}){
  const [epic,setEpic] = useState(''); const [taskText,setTaskText] = useState('');
  const [archiveShow,setArchiveShow] = useState(false);
  const [importance,setImportance] = useState(STUDY_IMPORTANCE[1]); const [urgency,setUrgency] = useState(STUDY_URGENCY[1]);
  const [deadline,setDeadline] = useState('');
  const [filterStatus,setFilterStatus] = useState('Все'); const [sortBy,setSortBy] = useState('createdAt');

  const submit = () => { if(!taskText.trim()) return;
    addStudyTask({epic:epic.trim()||'Входящие', task:taskText.trim(), status:'Не начато', importance, urgency, deadline:deadline||undefined, note:''});
    setTaskText(''); setDeadline(''); };
  const customEpics = [...new Set(study.map(s=>s.epic))].filter(e=>!BASE_EPICS.includes(e));
  const epicOptions = [...BASE_EPICS, ...customEpics];

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
  const today = todayStr();

  return (
    <div>
      <div style={S.panel}>
        <div style={S.panelTitle}>Новое дело</div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
          {epicOptions.map(e=><div key={e} className="chip" onClick={()=>setEpic(e)}
            style={{background:epic===e?C.amber:C.panelAlt,color:epic===e?'#1A1200':C.dim,borderColor:epic===e?C.amber:C.border}}>{e}</div>)}
        </div>
        <div style={S.inputRow}>
          <input style={{...S.input,maxWidth:150}} placeholder="Категория/эпик" value={epic} onChange={e=>setEpic(e.target.value)} />
          <input style={S.input} placeholder="Что нужно сделать" value={taskText} onChange={e=>setTaskText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />
          <button style={S.iconBtnAmber} onClick={submit}>+</button>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8,alignItems:'center'}}>
          <div style={{minWidth:150}}><div style={{fontSize:10.5,color:C.dim,marginBottom:3}}>Важность</div>
            <Select small value={importance} onChange={setImportance} options={STUDY_IMPORTANCE.map(v=>({value:v,label:v,dotColor:IMPORTANCE_COLOR[v]}))} /></div>
          <div style={{minWidth:150}}><div style={{fontSize:10.5,color:C.dim,marginBottom:3}}>Срочность</div>
            <Select small value={urgency} onChange={setUrgency} options={STUDY_URGENCY.map(v=>({value:v,label:v,dotColor:URGENCY_COLOR[v]}))} /></div>
          <div><div style={{fontSize:10.5,color:C.dim,marginBottom:3}}>Дедлайн</div>
            <input style={{...S.input,maxWidth:150}} type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} onClick={openDatePicker} /></div>
        </div>
      </div>
      <div style={{display:'flex',gap:10,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {['Все',...STUDY_STATUSES].map(s=><div key={s} className="chip" onClick={()=>setFilterStatus(s)} style={{background:filterStatus===s?C.amber:C.panelAlt,color:filterStatus===s?'#1A1200':C.dim,borderColor:filterStatus===s?C.amber:C.border}}>{s}</div>)}
        </div>
        <Select small style={{minWidth:150}} value={sortBy} onChange={setSortBy} options={[
          {value:'createdAt',label:'по дате'},{value:'importance',label:'по важности'},{value:'urgency',label:'по срочности'},{value:'deadline',label:'по дедлайну'}]} />
      </div>
      {Object.keys(grouped).length===0 && <div style={{...S.panel,...S.emptyState}}>Дел пока нет</div>}
      {Object.entries(grouped).map(([epicName,tasks])=>{
        const isC = collapsed[epicName]; const doneCount = tasks.filter(t=>t.status==='Выполнено').length;
        return (
          <div key={epicName} style={S.panel}>
            <div style={{...S.panelTitle,cursor:'pointer',display:'flex',alignItems:'center',marginBottom:isC?0:10}} onClick={()=>onToggleCollapse && onToggleCollapse(epicName)}>
              <span style={{marginRight:6}}>{isC?'▶':'▼'}</span>{epicName}<span style={S.dimSpan}>{doneCount}/{tasks.length}</span>
            </div>
            {!isC && tasks.map(t=>{
              const done = t.status==='Выполнено';
              const overdue = t.deadline && !done && t.deadline < today;
              const dueSoon = t.deadline && !done && !overdue && t.deadline <= addDays(today,2);
              return (
              <div key={t.id} className="row-hover" style={{...S.taskRow,flexWrap:'wrap',alignItems:'flex-start'}}>
                <div style={{display:'flex',gap:4,paddingTop:4}}>
                  <div style={{width:8,height:8,borderRadius:4,background:IMPORTANCE_COLOR[t.importance]||C.dim}} title={`Важность: ${t.importance||'—'}`}/>
                  <div style={{width:8,height:8,borderRadius:4,background:URGENCY_COLOR[t.urgency]||C.dim}} title={`Срочность: ${t.urgency||'—'}`}/>
                </div>
                <div style={{flex:1,minWidth:160,fontSize:13.5,color:done?C.dim:C.text,textDecoration:done?'line-through':'none'}}>
                  {t.task}
                  <div style={{fontSize:11,color:C.dim,marginTop:3,display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                    {t.importance && <span>{t.importance}</span>}
                    {t.urgency && <span style={{color:URGENCY_COLOR[t.urgency]}}>{t.urgency}</span>}
                    {t.deadline && <span style={{color:overdue?C.red:dueSoon?C.amber:C.dim,fontWeight:overdue?700:400}}>
                      ⏰ {t.deadline}{overdue?' · просрочено':''}</span>}
                  </div>
                </div>
                <StatusSeg value={t.status} onChange={v=>updateStudyTask(t.id,{status:v})} />
                <ConfirmIconBtn onConfirm={()=>archiveStudyTask(t.id)} icon="🏁" confirmLabel="в архив?" title="в архив (сохранить)" />
                <ConfirmIconBtn onConfirm={()=>deleteStudyTask(t.id)} confirmLabel="удалить?" title="удалить безвозвратно" />
              </div>
            );})}
          </div>
        );
      })}

      {/* Архив дел — внизу, свёрнут по умолчанию (session 016) */}
      {archive.length>0 && (
        <div style={{marginTop:6}}>
          <div onClick={()=>setArchiveShow(s=>!s)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',userSelect:'none',padding:'6px 2px'}}>
            <span style={{fontSize:12.5,color:C.dim}}>🗄 Архив дел · {archive.length}</span>
            <span style={{color:C.dim,fontSize:12,transition:'transform .2s ease',transform:archiveShow?'rotate(180deg)':'none'}}>▾</span>
          </div>
          {archiveShow && (
            <div className="anim-collapse" style={{marginTop:8}}>
              {[...archive].reverse().map((s,i)=>(
                <div key={s.id+'_'+s.archivedAt+'_'+i} className="row-hover" style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
                  <div style={{flex:1,minWidth:0,overflowWrap:'anywhere'}}>
                    <div style={{fontSize:13,color:s.status==='Выполнено'?C.green:C.text}}>{s.status==='Выполнено'?'✓ ':''}{s.task}</div>
                    <div style={{fontSize:10.5,color:C.dim}}>{s.epic||'—'} · {s.status||'—'}{s.deadline?` · ⏰ ${s.deadline}`:''} · архив {s.archivedAt}</div>
                  </div>
                  <button className="icon-btn" title="вернуть в активные" style={{color:C.cyan}} onClick={()=>restoreStudy(s.id, s.archivedAt)}>↩</button>
                  <ConfirmIconBtn onConfirm={()=>deleteArchivedStudy(s.id, s.archivedAt)} title="удалить из архива" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
