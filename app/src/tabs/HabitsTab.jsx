// Вкладка «Привычки» (вынесено из App.jsx, session: decompose phase 3). Редизайн «Тихий» — session 043 (Э2/Э2б).
// Функции прежние: создание (расписание, челлендж, заморозки, напоминание, цели), отметка любого из 7 дней и
// «Отметить сегодня», серия/рекорд, челлендж, напоминание, завершить/сдаться/удалить, архив с возвратом.
// Новое: «подробно» — месяц целиком, можно отметить и давние дни (toggleHabitDay и раньше принимал любую дату).
import { useState } from 'react';
import { addDays, monthLabelRu, shiftMonth, todayStr } from '../lib/dates.js';
import { goalLinksOf, goalMode } from '../lib/goals.js';
import { HABIT_WD, habitBestStreak, habitChallengeDone, habitChallengeRun, habitCompletedCount, habitCurrentStreak, habitDoneOn, habitScheduleLabel, isHabitScheduled } from '../lib/habits.js';
import { S } from '../lib/styles.js';
import { C, tint } from '../lib/theme.js';
import { GoalLinkPicker } from '../ui/GoalLinkPicker.jsx';
import { Icon } from '../ui/Icon.jsx';
import { ConfirmIconBtn, Modal } from '../ui/primitives.jsx';

const WD_ORDER = [1,2,3,4,5,6,0]; // Пн..Вс
const daysWord = (n) => { const a=Math.abs(n)%100, b=a%10; return (a>10&&a<20)?'дней':b===1?'день':(b>=2&&b<=4)?'дня':'дней'; };

function goalNames(goals, h){
  return goalLinksOf(h).map(l=>{ const g=(goals[l.scope]||[]).find(x=>x.id===l.goalId); return g ? `${g.title} +${l.amount}${goalMode(g)==='counter'?'':'%'}` : null; }).filter(Boolean);
}

// Клетка дня: число, отмечено/нет, сегодня обведено, не по расписанию — бледная и не нажимается.
function DayCell({ds, h, today, onToggle, showWd}){
  const sched = isHabitScheduled(h, ds), done = habitDoneOn(h, ds), fut = ds>today, isT = ds===today;
  const can = sched && !fut;
  return (
    <button type="button" disabled={!can} onClick={()=>can && onToggle(ds)} aria-pressed={done} aria-label={`${ds}${done?' — отмечено':''}`}
      style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:'none',border:'none',padding:0,cursor:can?'pointer':'default',fontFamily:'inherit',minWidth:0}}>
      {showWd && <span style={{fontSize:10,color:isT?C.amber:C.faint}}>{HABIT_WD[new Date(ds+'T00:00:00').getDay()]}</span>}
      <span style={{width:'100%',height:30,borderRadius:8,display:'grid',placeItems:'center',fontSize:12,fontWeight:done?600:500,fontVariantNumeric:'tabular-nums',
        background:done?C.amber:(sched&&!fut?C.panelAlt:'transparent'),color:done?'#17130C':(sched&&!fut?C.dim:C.faint),
        outline:isT?`1.5px solid ${C.amber}`:'none',outlineOffset:isT&&done?2:0,opacity:sched?1:.5}}>
        {parseInt(ds.slice(8),10)}
      </span>
    </button>
  );
}

export function HabitsTab({habits, addHabit, toggleHabitDay, deleteHabit, updateHabit, archiveHabit, abandonHabit, archive=[], deleteArchivedHabit, restoreHabit, goals={}, notifsOn}){
  const [view,setView] = useState('active');
  const [addOpen,setAddOpen] = useState(false);
  const [name,setName] = useState('');
  const [schedType,setSchedType] = useState('daily');
  const [wdays,setWdays] = useState([1,2,3,4,5,6,0]);
  const [target,setTarget] = useState('');
  const [freezes,setFreezes] = useState('');
  const [reminder,setReminder] = useState('');
  const [habitLinks,setHabitLinks] = useState([]);
  const [formErr,setFormErr] = useState('');
  const [detailId,setDetailId] = useState(null);
  const [detailMonth,setDetailMonth] = useState(null);
  const today = todayStr();

  const submit = () => {
    if(!name.trim()){ setFormErr('Введи название привычки.'); return; }
    // alert() в Android WebView не показывается — ошибка видна в форме
    if(schedType==='weekdays' && wdays.length===0){ setFormErr('Выбери хотя бы один день недели.'); return; }
    const schedule = schedType==='weekdays' ? {type:'weekdays', days:[...wdays]} : {type:'daily'};
    const t = parseInt(target,10), f = parseInt(freezes,10);
    addHabit({ name:name.trim(), schedule, targetDays: t>0?t:0, freezesPerMonth: f>0?f:0, reminderTime: reminder||undefined, ...(habitLinks.length?{goalLinks:habitLinks}:{}) });
    setName(''); setTarget(''); setFreezes(''); setReminder(''); setSchedType('daily'); setWdays([1,2,3,4,5,6,0]); setHabitLinks([]); setFormErr(''); setAddOpen(false);
  };
  const toggleWd = (d) => setWdays(prev => prev.includes(d)? prev.filter(x=>x!==d) : [...prev,d]);
  const last7 = []; for(let i=6;i>=0;i--) last7.push(addDays(today,-i));
  const detail = habits.find(h=>h.id===detailId);
  const openDetail = (h) => { setDetailId(h.id); setDetailMonth(today.slice(0,7)); };

  const chipBtn = (on, onClick, children, key) => (
    <button key={key} type="button" className="chip" onClick={onClick}
      style={{background:on?tint(C.amber,.16):C.panelAlt,color:on?C.amber:C.dim,fontFamily:'inherit'}}>{children}</button>
  );

  return (
    <div>
      <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:18}}>
        <div style={{...S.seg,flex:1}}>
          {[{id:'active',l:`Активные · ${habits.length}`},{id:'archive',l:`Архив · ${archive.length}`}].map(o=>(
            <button key={o.id} onClick={()=>setView(o.id)} style={{...S.segBtn,flex:1,background:view===o.id?C.panelAlt:'transparent',color:view===o.id?C.text:C.dim}}>{o.l}</button>
          ))}
        </div>
        {view==='active' && <button style={S.btnPrimary} onClick={()=>setAddOpen(o=>!o)} aria-expanded={addOpen}><Icon name={addOpen?'x':'plus'} size={16}/>{addOpen?'Закрыть':'Привычка'}</button>}
      </div>

      {view==='active' && addOpen && (
        <div style={{...S.plate,display:'flex',flexDirection:'column',gap:12,marginBottom:22}}>
          <input autoFocus style={{...S.input,background:C.bg}} placeholder="Например: 10 минут медитации" value={name} onChange={e=>{ setName(e.target.value); setFormErr(''); }} onKeyDown={e=>e.key==='Enter'&&submit()} aria-label="Название привычки" />
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <span style={{fontSize:12,color:C.dim}}>Расписание</span>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {chipBtn(schedType==='daily', ()=>setSchedType('daily'), 'Каждый день', 'd')}
              {chipBtn(schedType==='weekdays', ()=>setSchedType('weekdays'), 'Дни недели', 'w')}
            </div>
            {schedType==='weekdays' && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',gap:4}}>
                {WD_ORDER.map(d=>{ const on=wdays.includes(d); return (
                  <button key={d} type="button" onClick={()=>toggleWd(d)} aria-pressed={on}
                    style={{height:32,borderRadius:8,border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:12.5,fontWeight:600,background:on?C.amber:C.panelAlt,color:on?'#17130C':C.dim}}>{HABIT_WD[d]}</button>); })}
              </div>
            )}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:8}}>
            <label style={{display:'flex',flexDirection:'column',gap:5,fontSize:12,color:C.dim}}>Челлендж, дней подряд
              <input style={{...S.input,background:C.bg}} type="number" min="0" inputMode="numeric" placeholder="без челленджа" value={target} onChange={e=>setTarget(e.target.value)} /></label>
            <label style={{display:'flex',flexDirection:'column',gap:5,fontSize:12,color:C.dim}}>Пропусков в месяц без срыва
              <input style={{...S.input,background:C.bg}} type="number" min="0" inputMode="numeric" placeholder="0" value={freezes} onChange={e=>setFreezes(e.target.value)} /></label>
            <label style={{display:'flex',flexDirection:'column',gap:5,fontSize:12,color:C.dim}}>Напоминание
              <input style={{...S.input,background:C.bg}} type="time" value={reminder} onChange={e=>setReminder(e.target.value)} /></label>
          </div>
          {reminder && <span style={{fontSize:12,color:C.dim,marginTop:-4}}>{notifsOn?'Придёт на телефон в это время.':'Уведомления выключены — включи их в Настройках.'}</span>}
          <div style={{display:'flex',flexDirection:'column',gap:2}}>
            <span style={{fontSize:12,color:C.dim}}>Цели (вклад при отметке)</span>
            <GoalLinkPicker goals={goals} links={habitLinks} onLinks={setHabitLinks} />
          </div>
          {formErr && <span style={{fontSize:12.5,color:C.red}}>{formErr}</span>}
          <button style={S.btnPrimary} onClick={submit}>Добавить привычку</button>
        </div>
      )}

      {view==='active' && habits.length===0 && !addOpen && (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,padding:'36px 10px',textAlign:'center',color:C.dim,fontSize:13.5}}>
          <span style={{width:44,height:44,borderRadius:'50%',background:C.panel,display:'grid',placeItems:'center',color:C.faint}}><Icon name="habits" size={22}/></span>
          <b style={{color:C.text,fontSize:15}}>Привычек пока нет</b>
          <span>Привычка отмечается раз в день, серия растёт, пока не пропускаешь.</span>
          <button style={{...S.btnPrimary,marginTop:6}} onClick={()=>setAddOpen(true)}><Icon name="plus" size={15}/>Добавить привычку</button>
        </div>
      )}

      {view==='active' && habits.map(h=>{
        const streak = habitCurrentStreak(h, today);
        const best = habitBestStreak(h, today);
        const done = habitCompletedCount(h);
        const todayScheduled = isHabitScheduled(h, today);
        const todayDone = habitDoneOn(h, today);
        // Прогресс челленджа = ТЕКУЩАЯ серия (с учётом разрешённых пропусков), а не сумма отметок. См. lib/habits.js.
        const run = habitChallengeRun(h, today);
        const targetPct = h.targetDays>0 ? Math.min(100, run/h.targetDays*100) : 0;
        const challenge = habitChallengeDone(h, today);
        const gn = goalNames(goals, h);
        return (
          <div key={h.id} style={{padding:'4px 0 18px',marginBottom:18,borderBottom:`1px solid ${C.border}`,opacity:todayScheduled?1:.8}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:10}}>
              <button onClick={()=>openDetail(h)} style={{flex:1,minWidth:0,background:'none',border:'none',padding:0,textAlign:'left',cursor:'pointer',color:C.text,fontFamily:'inherit'}}>
                <div style={{fontSize:15.5,fontWeight:600,overflowWrap:'anywhere'}}>{h.name}</div>
                <div style={{fontSize:12,color:C.dim,marginTop:3,display:'flex',flexWrap:'wrap',gap:'2px 8px',alignItems:'center'}}>
                  <span>{habitScheduleLabel(h)}{!todayScheduled?' · сегодня не по расписанию':''}</span>
                  {h.reminderTime && <span style={{display:'inline-flex',gap:3,alignItems:'center'}}><Icon name="bell" size={12}/>{h.reminderTime}</span>}
                  {h.freezesPerMonth>0 && <span title="разрешённых пропусков в месяц">можно пропустить {h.freezesPerMonth} в мес.</span>}
                  {gn.map((g,i)=><span key={i} style={{color:C.amber,display:'inline-flex',gap:3,alignItems:'center'}}><Icon name="goals" size={12}/>{g}</span>)}
                </div>
              </button>
              <div style={{textAlign:'right',flex:'none'}}>
                <div style={{display:'flex',gap:4,alignItems:'center',justifyContent:'flex-end',fontSize:16,fontWeight:700,fontVariantNumeric:'tabular-nums',color:streak>0?C.amber:C.dim}}><Icon name="flame" size={15}/>{streak}</div>
                <div style={{fontSize:11,color:C.dim}}>рекорд {best}</div>
              </div>
              <button className="icon-btn" aria-label="Подробно и действия" title="Подробно" onClick={()=>openDetail(h)}><Icon name="more" size={18}/></button>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',gap:5}}>
              {last7.map(ds=><DayCell key={ds} ds={ds} h={h} today={today} showWd onToggle={(d)=>toggleHabitDay(h.id, d)} />)}
            </div>

            {h.targetDays>0 && (
              <div style={{marginTop:12}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:C.dim,marginBottom:5}}>
                  <span>Челлендж · подряд{challenge?<span style={{color:C.green}}> · пройден</span>:''}</span>
                  <span style={{fontVariantNumeric:'tabular-nums'}}>{run} / {h.targetDays}<span style={{opacity:.7}}> · всего {done}</span></span>
                </div>
                <div style={{height:4,background:C.panelAlt,borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',width:`${targetPct}%`,background:challenge?C.green:C.amber,borderRadius:4}}/></div>
              </div>
            )}

            {todayScheduled && (
              <button onClick={()=>toggleHabitDay(h.id, today)}
                style={{...(todayDone?S.btnGhost:S.btnPrimary),marginTop:12,width:'100%',padding:'10px'}}>
                {todayDone ? <><Icon name="check" size={15}/>Сегодня отмечено · отменить</> : 'Отметить сегодня'}
              </button>
            )}
          </div>
        );
      })}

      {view==='archive' && (
        archive.length===0
          ? <div style={S.emptyState}>Архив пуст. Сюда попадают завершённые привычки и те, где ты сдался.</div>
          : <div>
            {[...archive].reverse().map((h,i)=>(
              <div key={h.id+'_'+h.archivedAt+'_'+i} style={S.taskRow}>
                <div style={{flex:1,minWidth:0,overflowWrap:'anywhere',display:'flex',flexDirection:'column',gap:2}}>
                  <span style={{fontSize:14.5,color:h.outcome==='failed'?C.red:C.text}}>{h.name}{h.outcome==='failed'?' · сдался':h.challengeDone?' · челлендж пройден':''}</span>
                  <span style={{fontSize:12,color:C.dim}}>рекорд {h.bestStreak||0} · выполнено {h.completedCount||0}{h.targetDays>0?` / ${h.targetDays}`:''} дн. · в архиве с {h.archivedAt}</span>
                </div>
                <button style={S.btnGhost} title="вернуть в активные" onClick={()=>restoreHabit(h.id, h.archivedAt)}><Icon name="restore" size={14}/>Вернуть</button>
                <ConfirmIconBtn onConfirm={()=>deleteArchivedHabit(h.id, h.archivedAt)} title="удалить из архива" confirmLabel="удалить?" icon="trash" />
              </div>
            ))}
          </div>
      )}

      {detail && (
        <Modal onClose={()=>setDetailId(null)} title={detail.name}>
          {(() => {
            const ym = detailMonth || today.slice(0,7);
            const [y,m] = ym.split('-').map(Number);
            const first = `${ym}-01`; const dim = new Date(y,m,0).getDate();
            const lead = (new Date(y,m-1,1).getDay()+6)%7;
            const cells = [...Array(lead).fill(null), ...Array.from({length:dim},(_,i)=>`${ym}-${String(i+1).padStart(2,'0')}`)];
            const monthDone = cells.filter(ds=>ds && habitDoneOn(detail, ds)).length;
            const gn = goalNames(goals, detail);
            return (
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <div style={{fontSize:12.5,color:C.dim}}>{habitScheduleLabel(detail)} · серия {habitCurrentStreak(detail,today)} {daysWord(habitCurrentStreak(detail,today))} · рекорд {habitBestStreak(detail,today)} · всего {habitCompletedCount(detail)}</div>
                <div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                    <button style={S.navArrow} aria-label="Предыдущий месяц" onClick={()=>setDetailMonth(shiftMonth(ym,-1))}><Icon name="chevL"/></button>
                    <span style={{fontWeight:600,textTransform:'capitalize'}}>{monthLabelRu(ym)} <span style={{color:C.dim,fontWeight:500,fontSize:12.5}}>· {monthDone} отм.</span></span>
                    <button style={{...S.navArrow,opacity:ym>=today.slice(0,7)?.3:1}} disabled={ym>=today.slice(0,7)} aria-label="Следующий месяц" onClick={()=>setDetailMonth(shiftMonth(ym,1))}><Icon name="chevR"/></button>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',gap:4}}>
                    {WD_ORDER.map(d=><span key={d} style={{fontSize:10.5,color:C.faint,textAlign:'center'}}>{HABIT_WD[d]}</span>)}
                    {cells.map((ds,i)=> ds ? <DayCell key={ds} ds={ds} h={detail} today={today} onToggle={(d)=>toggleHabitDay(detail.id, d)} /> : <span key={'e'+i}/>)}
                  </div>
                  <div style={{fontSize:11.5,color:C.dim,marginTop:8}}>Нажми на день, чтобы отметить или снять отметку. Будущие дни и дни не по расписанию не нажимаются.</div>
                </div>
                <div style={{background:C.panelAlt,borderRadius:12,padding:'0 14px'}}>
                  <div style={{...S.taskRow,gap:10}}>
                    <span style={{color:C.dim,display:'flex'}}><Icon name="bell"/></span>
                    <span style={{flex:1}}>Напоминание</span>
                    <input style={{...S.input,flex:'none',width:110,padding:'6px 8px',background:C.bg}} type="time" value={detail.reminderTime||''} aria-label="Время напоминания"
                      onChange={e=>updateHabit(detail.id,{reminderTime:e.target.value||undefined})} />
                    {detail.reminderTime && <button className="icon-btn" title="убрать напоминание" aria-label="Убрать напоминание" onClick={()=>updateHabit(detail.id,{reminderTime:undefined})}><Icon name="x" size={15}/></button>}
                  </div>
                  <div style={{...S.taskRow,gap:10,borderBottom:'none'}}>
                    <span style={{color:C.dim,display:'flex'}}><Icon name="goals"/></span>
                    <span style={{flex:1}}>Цели</span>
                    <span style={{fontSize:12.5,color:gn.length?C.amber:C.dim,textAlign:'right'}}>{gn.length?gn.join(', '):'не привязана'}</span>
                  </div>
                </div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                  <ConfirmIconBtn onConfirm={()=>{ setDetailId(null); archiveHabit(detail.id); }} icon={<span style={{...S.btnGhost,color:C.green}}><Icon name="check" size={14}/>Завершить успешно</span>} confirmLabel="в архив?" title="завершить успешно → в архив" />
                  <ConfirmIconBtn onConfirm={()=>{ setDetailId(null); abandonHabit(detail.id); }} icon={<span style={{...S.btnGhost,color:C.red,borderColor:tint(C.red,.4)}}>Сдаться</span>} confirmLabel="сдаться?" title="сдаться (провал) → в архив" />
                  <span style={{marginLeft:'auto'}}><ConfirmIconBtn onConfirm={()=>{ setDetailId(null); deleteHabit(detail.id); }} icon="trash" confirmLabel="удалить навсегда?" title="удалить безвозвратно" /></span>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
