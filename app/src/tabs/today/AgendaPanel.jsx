// Повестка дня (s058) — плашка вверху вкладки «Сегодня»: всё, что приходится на выбранный день из других
// вкладок. Данные — lib/agenda.js (тот же расчёт, что у утренней сводки в уведомлениях).
// Каждую строку можно нажать — откроется запись в своей вкладке; кружок справа закрывает пункт прямо здесь
// (дело → «Готово», напоминание → выполнено, длительная задача → готово, цель → +1 / выполнено).
// Видимость: модуль today.agenda + разделы agenda.<key> (Настройки → «Что показывать»).
import { maskMoney } from '../../lib/format.js';
import { vis } from '../../lib/storage.js';
import { S } from '../../lib/styles.js';
import { C, tint } from '../../lib/theme.js';
import { agendaOpenCount, AGENDA_SECTIONS, dayWord } from '../../lib/agenda.js';
import { Check } from '../../ui/Check.jsx';
import { Icon } from '../../ui/Icon.jsx';

const WD_ACC = ['воскресенье','понедельник','вторник','среду','четверг','пятницу','субботу'];
const ddmm = (ds) => new Date(ds+'T00:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
const KIND_ICON = { study:'study', ongoing:'pin', goal:'goals', note:'bell' };

function Kind({icon, color}){
  return <span style={{width:28,height:28,borderRadius:8,flex:'none',display:'grid',placeItems:'center',
    background:color?tint(color,.14):C.panelAlt,color:color||C.dim}}><Icon name={icon} size={15}/></span>;
}

// Строка повестки: [время] [значок] текст (нажать = открыть) [действие]
function Row({time, icon, color, title, sub, done, onOpen, action, first}){
  return (
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderTop:first?'none':`1px solid ${C.border}`}}>
      {time!==undefined && <span style={{width:38,flex:'none',fontSize:12.5,fontVariantNumeric:'tabular-nums',color:C.text,fontWeight:600}}>{time}</span>}
      <Kind icon={icon} color={done?null:color} />
      <button onClick={onOpen} disabled={!onOpen} style={{flex:1,minWidth:0,background:'none',border:'none',padding:0,textAlign:'left',fontFamily:'inherit',cursor:onOpen?'pointer':'default',display:'flex',flexDirection:'column',gap:1}}>
        <span style={{fontSize:14,color:done?C.dim:C.text,textDecoration:done?'line-through':'none',textDecorationColor:C.faint,overflowWrap:'anywhere'}}>{title}</span>
        {sub && <span style={{fontSize:12,color:C.dim}}>{sub}</span>}
      </button>
      {action}
    </div>
  );
}

function Group({title, color, children}){
  return (
    <div>
      <div style={{fontSize:11,fontWeight:600,letterSpacing:'.06em',textTransform:'uppercase',color:color||C.dim,padding:'10px 0 2px'}}>{title}</div>
      {children}
    </div>
  );
}

export function AgendaPanel({agenda, tomorrow, isToday, date, collapsed, onToggle, maskOps=false, h}){
  if(!agenda) return null;
  const on = (k) => vis('agenda.'+k);
  const hidden = Object.fromEntries(AGENDA_SECTIONS.map(s => [s.key, !on(s.key)]));
  const open = agendaOpenCount(agenda, hidden);
  const list = (k) => on(k) ? (agenda[k]||[]) : [];
  const overdue = list('overdue'), study = list('study'), ongoing = list('ongoing'), goals = list('goals'),
    bills = list('bills'), reminders = list('reminders'), habits = list('habits');
  const anyItems = overdue.length + study.length + ongoing.length + goals.length + bills.length + reminders.length + habits.length > 0;
  const title = isToday ? 'Повестка' : `План на ${WD_ACC[new Date(date+'T00:00:00').getDay()]}`;
  const remOpen = reminders.filter(r=>!r.done).length;
  const habDone = habits.filter(x=>x.done).length;

  const chip = (n, label, color) => (
    <span style={{fontSize:11.5,padding:'3px 9px',borderRadius:999,background:C.panelAlt,color:C.dim,fontVariantNumeric:'tabular-nums'}}>
      <b style={{color:color||C.text,fontWeight:600}}>{n}</b> {label}</span>);
  const overdueOpen = overdue.filter(o=>!o.done).length;
  const dueOpen = study.filter(s=>!s.done).length + ongoing.filter(o=>!o.done).length + goals.filter(g=>g.kind==='deadline'&&!g.done).length;

  // «дел. пункт закрыть» — разный жест для разных типов, но один вид: круг справа
  const studyCheck = (s) => <Check checked={s.done} label={`${s.done?'Вернуть в работу':'Готово'}: ${s.label}`} color={C.green}
    onChange={()=>h.studyDone(s.id, !s.done)} />;
  const overdueAction = (o) => {
    if(o.kind==='study') return studyCheck(o);
    if(o.kind==='ongoing') return <Check checked={o.done} label={`Готово: ${o.label}`} color={C.green} onChange={()=>{ if(!o.done) h.ongoingDone(o.id); }} />;
    if(o.kind==='note') return <Check checked={false} label={`Выполнено: ${o.label}`} color={C.green} onChange={()=>h.reminderDone(o.id, true, date, false)} />;
    return null; // цель — открыть и закрыть там (у целей разные трекеры)
  };
  const overdueOpenFn = (o) => o.kind==='study' ? ()=>h.open('study', o.id)
    : o.kind==='note' ? ()=>h.open('notes', o.id) : o.kind==='goal' ? ()=>h.open('goals', o.id) : null;

  const goalAction = (g) => {
    if(g.mode==='counter' && g.counter) return (
      <button onClick={()=>h.goalPlus(g.scope, g.id)} aria-label={`+1: ${g.label}`}
        style={{...S.btnGhost,padding:'5px 10px',flex:'none',fontVariantNumeric:'tabular-nums'}}>+1</button>);
    if(g.mode==='none') return <Check checked={g.done} label={`Цель выполнена: ${g.label}`} color={C.green}
      onChange={()=>h.goalToggle(g.scope, g.id, !g.done)} />;
    return null;
  };

  return (
    <div data-agenda="" style={{...S.plate,marginBottom:18,padding:'10px 14px 6px'}}>
      <button onClick={onToggle} aria-expanded={!collapsed}
        style={{display:'flex',alignItems:'center',gap:8,width:'100%',background:'none',border:'none',padding:'2px 0 8px',cursor:'pointer',fontFamily:'inherit',color:C.text}}>
        <span style={{fontSize:15,fontWeight:650,flex:1,textAlign:'left'}}>{title}</span>
        {open>0 && <span style={{fontSize:12.5,color:C.dim,fontVariantNumeric:'tabular-nums'}}>{open}</span>}
        <span style={{display:'flex',color:C.dim,transform:collapsed?'none':'rotate(90deg)',transition:'transform .15s'}}><Icon name="chevR" size={15}/></span>
      </button>

      {(anyItems || collapsed) && (
        <div style={{display:'flex',gap:6,flexWrap:'wrap',paddingBottom:collapsed?6:4}}>
          {overdueOpen>0 && chip(overdueOpen, 'просрочено', C.red)}
          {dueOpen>0 && chip(dueOpen, dueOpen===1?'срок':'срока')}
          {reminders.length>0 && chip(remOpen, 'напомин.')}
          {habits.length>0 && chip(`${habDone}/${habits.length}`, 'привычки')}
          {bills.length>0 && chip(bills.length, 'платёж')}
        </div>
      )}

      {!collapsed && !anyItems && (
        <div style={{fontSize:13,color:C.dim,padding:'0 0 8px'}}>{isToday ? 'Ничего срочного на сегодня.' : 'На этот день ничего не запланировано.'}</div>
      )}

      {!collapsed && anyItems && (
        <div className="anim-collapse">
          {overdue.length>0 && (
            <Group title="Просрочено" color={C.red}>
              {overdue.map((o,i)=>(
                <Row key={o.kind+o.id} first={i===0} icon={KIND_ICON[o.kind]} color={C.red} title={o.label} done={o.done}
                  sub={o.done ? 'закрыто сегодня' : `${o.kind==='note'?'было':'срок'} ${ddmm(o.deadline)} · ${dayWord(o.late)} назад${o.epic?` · ${o.epic}`:''}`}
                  onOpen={overdueOpenFn(o)} action={overdueAction(o)} />
              ))}
            </Group>
          )}

          {(study.length+ongoing.length+goals.length+bills.length+reminders.length+habits.length)>0 && (
            <Group title={isToday?'Сегодня':'В этот день'}>
              {study.map((s,i)=>(
                <Row key={'s'+s.id} first={i===0} time="" icon="study" color={C.amber} title={s.label} done={s.done}
                  sub={[s.done?'готово':'срок сегодня', s.checklist?`чек-лист ${s.checklist.done} / ${s.checklist.total}`:null, s.epic].filter(Boolean).join(' · ')}
                  onOpen={()=>h.open('study', s.id)} action={studyCheck(s)} />
              ))}
              {ongoing.map((o,i)=>(
                <Row key={'o'+o.id} first={i===0 && !study.length} time="" icon="pin" color={C.amber} title={o.label} done={o.done}
                  sub={o.done?'готово':'длительная задача · заканчивается'}
                  action={<Check checked={o.done} label={`Готово: ${o.label}`} color={C.green} onChange={()=>{ if(!o.done) h.ongoingDone(o.id); }} />} />
              ))}
              {goals.map((g,i)=>(
                <Row key={'g'+g.scope+g.id} first={i===0 && !study.length && !ongoing.length} time="" icon="goals" color={C.cyan} title={g.label} done={g.done}
                  sub={g.kind==='deadline'
                    ? (g.done ? 'цель выполнена' : `срок цели${g.counter?` · ${g.counter.current} / ${g.counter.target}`:''}`)
                    : `нужно +${String(g.need).replace('.',',')} шт/день · ${g.counter?`${g.counter.current} / ${g.counter.target}`:''}`}
                  onOpen={()=>h.open('goals', g.id)} action={goalAction(g)} />
              ))}
              {bills.map((b,i)=>(
                <Row key={'b'+b.id} first={i===0 && !study.length && !ongoing.length && !goals.length} time="" icon="finance" title={`${b.label} · ${maskMoney(maskOps, b.amount)}`}
                  sub="регулярный платёж" onOpen={()=>h.open('finance')} />
              ))}
              {reminders.map((r,i)=>(
                <Row key={'r'+r.id} first={i===0 && !study.length && !ongoing.length && !goals.length && !bills.length} time={r.time||''} icon="bell" title={r.label} done={r.done}
                  sub={r.oneShot ? 'напоминание' : r.repeat==='daily' ? 'каждый день' : r.repeat==='weekly' ? 'каждую неделю' : 'каждый месяц'}
                  onOpen={()=>h.open('notes', r.id)}
                  action={<Check checked={r.done} label={`${r.done?'Снять отметку':'Выполнено'}: ${r.label}`} color={C.green} onChange={()=>h.reminderDone(r.id, !r.done, date, r.oneShot)} />} />
              ))}
              {habits.length>0 && (
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderTop:(study.length+ongoing.length+goals.length+bills.length+reminders.length)?`1px solid ${C.border}`:'none'}}>
                  <span style={{width:38,flex:'none'}}/>
                  <Kind icon="habits" color={habDone===habits.length?null:C.green} />
                  <div style={{flex:1,minWidth:0,display:'flex',gap:6,flexWrap:'wrap'}}>
                    {habits.map(x=>(
                      <button key={x.id} aria-pressed={x.done} onClick={()=>h.habit(x.id, date)} aria-label={`Привычка: ${x.label}`}
                        style={{fontFamily:'inherit',fontSize:12.5,padding:'4px 10px',borderRadius:999,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:5,
                          border:`1px solid ${x.done?'transparent':C.border}`,background:x.done?tint(C.green,.14):'transparent',color:x.done?C.green:C.text}}>
                        {x.done && <Icon name="check" size={12} stroke={2.6}/>}{x.label}</button>
                    ))}
                  </div>
                </div>
              )}
            </Group>
          )}
        </div>
      )}

      {!collapsed && on('tomorrow') && tomorrow && tomorrow.length>0 && (
        <button onClick={h.goTomorrow} style={{display:'flex',alignItems:'center',gap:6,width:'100%',background:'none',border:'none',borderTop:`1px solid ${C.border}`,
          padding:'10px 0',marginTop:4,cursor:'pointer',fontFamily:'inherit',fontSize:13,color:C.dim,textAlign:'left'}}>
          <span style={{flex:'none'}}>{isToday?'Завтра:':'Следующий день:'}</span>
          <span style={{flex:1,minWidth:0,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tomorrow.join(', ')}</span>
          <Icon name="chevR" size={14}/>
        </button>
      )}
    </div>
  );
}
