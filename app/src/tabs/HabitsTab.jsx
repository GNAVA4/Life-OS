// Вкладка/раздел: HabitsTab (вынесено из App.jsx, session: decompose phase 3)
import { useState } from 'react';
import { addDays, todayStr } from '../lib/dates.js';
import { goalLinksOf } from '../lib/goals.js';
import { HABIT_WD, habitBestStreak, habitChallengeDone, habitCompletedCount, habitCurrentStreak, habitDoneOn, habitScheduleLabel, isHabitScheduled } from '../lib/habits.js';
import { S } from '../lib/styles.js';
import { C } from '../lib/theme.js';
import { GoalLinkPicker } from '../ui/GoalLinkPicker.jsx';
import { ConfirmIconBtn } from '../ui/primitives.jsx';

export function HabitsTab({habits, addHabit, toggleHabitDay, deleteHabit, updateHabit, archiveHabit, abandonHabit, archive=[], deleteArchivedHabit, restoreHabit, goals={}, notifsOn}){
  const [name,setName] = useState('');
  const [archiveShow,setArchiveShow] = useState(false);
  const [schedType,setSchedType] = useState('daily');
  const [wdays,setWdays] = useState([1,2,3,4,5,6,0]);
  const [target,setTarget] = useState('');
  const [freezes,setFreezes] = useState('');
  const [reminder,setReminder] = useState('');
  const [showOpts,setShowOpts] = useState(false);
  const [habitLinks,setHabitLinks] = useState([]);
  const today = todayStr();
  const WD_ORDER = [1,2,3,4,5,6,0]; // Пн..Вс

  const submit = () => {
    if(!name.trim()) return;
    if(schedType==='weekdays' && wdays.length===0){ alert('Выбери хотя бы один день недели'); return; }
    const schedule = schedType==='weekdays' ? {type:'weekdays', days:[...wdays]} : {type:'daily'};
    const t = parseInt(target,10), f = parseInt(freezes,10);
    addHabit({ name:name.trim(), schedule, targetDays: t>0?t:0, freezesPerMonth: f>0?f:0, reminderTime: reminder||undefined, ...(habitLinks.length?{goalLinks:habitLinks}:{}) });
    setName(''); setTarget(''); setFreezes(''); setReminder(''); setSchedType('daily'); setWdays([1,2,3,4,5,6,0]); setShowOpts(false); setHabitLinks([]);
  };
  const toggleWd = (d) => setWdays(prev => prev.includes(d)? prev.filter(x=>x!==d) : [...prev,d]);

  return (
    <div>
      <div style={S.panel}>
        <div style={S.panelTitle}>Новая привычка</div>
        <div style={S.inputRow}>
          <input style={S.input} placeholder="Например: 10 минут медитации" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />
          <button style={S.iconBtnAmber} onClick={submit}>+</button>
        </div>
        <div style={{marginTop:8}}>
          <span style={{fontSize:11.5,color:C.cyan,cursor:'pointer'}} onClick={()=>setShowOpts(!showOpts)}>{showOpts?'скрыть настройки':'настройки: расписание · цель · заморозки'}</span>
        </div>
        {showOpts && (
          <div style={{marginTop:10, display:'flex', flexDirection:'column', gap:10}}>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
              {[{id:'daily',label:'Каждый день'},{id:'weekdays',label:'Дни недели'}].map(o=>(
                <div key={o.id} className="chip" onClick={()=>setSchedType(o.id)} style={{background:schedType===o.id?C.amber:C.panelAlt,color:schedType===o.id?'#1A1200':C.dim,borderColor:schedType===o.id?C.amber:C.border}}>{o.label}</div>
              ))}
            </div>
            {schedType==='weekdays' && (
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {WD_ORDER.map(d=>{ const on=wdays.includes(d); return (
                  <div key={d} className="chip" onClick={()=>toggleWd(d)} style={{background:on?C.cyan:C.panelAlt,color:on?'#08201E':C.dim,borderColor:on?C.cyan:C.border,minWidth:34,textAlign:'center',padding:'6px 8px'}}>{HABIT_WD[d]}</div>
                ); })}
              </div>
            )}
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <input style={{...S.input,maxWidth:190}} type="number" min="0" placeholder="цель на N дней (0 = без цели)" value={target} onChange={e=>setTarget(e.target.value)} />
              <input style={{...S.input,maxWidth:210}} type="number" min="0" placeholder="заморозки: пропусков в месяц" value={freezes} onChange={e=>setFreezes(e.target.value)} />
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{fontSize:12,color:C.dim}}>🔔 Напоминание в</span>
              <input style={{...S.input,maxWidth:120,flex:'none'}} type="time" value={reminder} onChange={e=>setReminder(e.target.value)} />
              <span style={{fontSize:10.5,color:C.dim}}>{notifsOn?'(придёт на телефон)':'(включи уведомления в Настройках)'}</span>
            </div>
            <div>
              <div style={{fontSize:11,color:C.dim,marginBottom:2}}>🎯 Привязать к цели (вклад при отметке)</div>
              <GoalLinkPicker goals={goals} links={habitLinks} onLinks={setHabitLinks} />
            </div>
          </div>
        )}
      </div>

      {habits.length===0 && <div style={{...S.panel,...S.emptyState}}>Пока нет привычек. Добавь первую 🔁</div>}

      {habits.map(h=>{
        const streak = habitCurrentStreak(h, today);
        const best = habitBestStreak(h, today);
        const done = habitCompletedCount(h);
        const todayScheduled = isHabitScheduled(h, today);
        const todayDone = habitDoneOn(h, today);
        const targetPct = h.targetDays>0 ? Math.min(100, done/h.targetDays*100) : 0;
        const challenge = habitChallengeDone(h);
        const last7 = []; for(let i=6;i>=0;i--) last7.push(addDays(today,-i));
        return (
          <div key={h.id} style={S.panel}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14.5,fontWeight:700}}>{h.name}</div>
                <div style={{fontSize:11,color:C.dim,marginTop:2}}>
                  {habitScheduleLabel(h)}{h.freezesPerMonth>0?` · ❄ ${h.freezesPerMonth}/мес`:''}{h.targetDays>0?` · цель ${h.targetDays} дн.`:''}{goalLinksOf(h).map((l,i)=><span key={i} style={{color:C.amber}}> · 🎯+{l.amount}</span>)}{h.reminderTime?<span style={{color:C.cyan}}> · 🔔 {h.reminderTime}</span>:null}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
                  <span style={{fontSize:10.5,color:C.dim}}>🔔</span>
                  <input style={{...S.input,maxWidth:110,flex:'none',fontSize:11,padding:'4px 6px'}} type="time" value={h.reminderTime||''}
                    onChange={e=>updateHabit(h.id,{reminderTime:e.target.value||undefined})} />
                  {h.reminderTime && <button className="icon-btn" title="убрать напоминание" onClick={()=>updateHabit(h.id,{reminderTime:undefined})}>✕</button>}
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:16,fontWeight:700,color:streak>0?C.amber:C.dim}}>🔥 {streak}</div>
                <div style={{fontSize:10,color:C.dim}}>рекорд {best}</div>
              </div>
              <ConfirmIconBtn onConfirm={()=>archiveHabit(h.id)} icon="🏁" confirmLabel="завершить?" title="завершить успешно → в архив" />
              <ConfirmIconBtn onConfirm={()=>abandonHabit(h.id)} icon="🏳️" confirmLabel="сдаться?" title="сдаться (провал) → в архив" />
              <ConfirmIconBtn onConfirm={()=>deleteHabit(h.id)} confirmLabel="удалить?" title="удалить безвозвратно" />
            </div>

            {h.targetDays>0 && (
              <div style={{marginTop:8}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:C.dim,marginBottom:3}}>
                  <span>Челлендж{challenge?' · пройден 🎉':''}</span><span>{done} / {h.targetDays}</span>
                </div>
                <div style={{height:5,background:C.panelAlt,borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${targetPct}%`,background:challenge?C.green:C.amber}}/></div>
              </div>
            )}

            <div style={{display:'flex',gap:6,marginTop:12,flexWrap:'wrap'}}>
              {last7.map(ds=>{ const sched=isHabitScheduled(h,ds); const d=habitDoneOn(h,ds); const isToday=ds===today;
                const wd=HABIT_WD[new Date(ds+'T00:00:00').getDay()];
                return (
                  <div key={ds} onClick={()=> sched && toggleHabitDay(h.id, ds)} title={ds}
                    style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3, cursor:sched?'pointer':'default', opacity:sched?1:0.4}}>
                    <div style={{fontSize:9,color:isToday?C.amber:C.dim}}>{wd}</div>
                    <div style={{width:26,height:26,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,
                      background:d?C.amber:'transparent', border:`1px solid ${d?C.amber:(isToday?C.amber:C.border)}`, color:d?'#1A1200':C.dim}}>{d?'✓':(sched?'':'·')}</div>
                    <div style={{fontSize:9,color:C.dim}}>{ds.slice(8,10)}</div>
                  </div>
                );
              })}
            </div>

            {todayScheduled
              ? <button onClick={()=>toggleHabitDay(h.id, today)}
                  style={{...S.exportBtn, marginTop:12, width:'100%', padding:'10px', background:todayDone?C.panelAlt:C.amber, color:todayDone?C.dim:'#1A1200', borderColor:todayDone?C.border:C.amber, fontWeight:700}}>
                  {todayDone ? '✓ Сегодня выполнено — отменить' : 'Отметить сегодня'}
                </button>
              : <div style={{...S.dimSpan, marginTop:10, marginLeft:0, display:'block'}}>Сегодня не по расписанию</div>}
          </div>
        );
      })}

      {/* Архив привычек — внизу, свёрнут по умолчанию (session 015) */}
      {archive.length>0 && (
        <div style={{marginTop:18}}>
          <div onClick={()=>setArchiveShow(s=>!s)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',userSelect:'none',padding:'6px 2px'}}>
            <span style={{fontSize:12.5,color:C.dim}}>🗄 Архив привычек · {archive.length}</span>
            <span style={{color:C.dim,fontSize:12,transition:'transform .2s ease',transform:archiveShow?'rotate(180deg)':'none'}}>▾</span>
          </div>
          {archiveShow && (
            <div className="anim-collapse" style={{marginTop:8}}>
              {[...archive].reverse().map((h,i)=>(
                <div key={h.id+'_'+h.archivedAt+'_'+i} className="row-hover" style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
                  <div style={{flex:1,minWidth:0,overflowWrap:'anywhere'}}>
                    <div style={{fontSize:13,color:h.outcome==='failed'?C.red:C.text}}>{h.outcome==='failed'?'🏳️ ':h.challengeDone?'🎉 ':''}{h.name}{h.outcome==='failed'?' · сдался':''}</div>
                    <div style={{fontSize:10.5,color:C.dim}}>рекорд 🔥 {h.bestStreak||0} · выполнено {h.completedCount||0}{h.targetDays>0?` / ${h.targetDays}`:''} дн. · архив {h.archivedAt}</div>
                  </div>
                  <button className="icon-btn" title="вернуть в активные" style={{color:C.cyan}} onClick={()=>restoreHabit(h.id, h.archivedAt)}>↩</button>
                  <ConfirmIconBtn onConfirm={()=>deleteArchivedHabit(h.id, h.archivedAt)} title="удалить из архива" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
