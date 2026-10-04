// Вкладка/раздел: AchievementsTab (вынесено из App.jsx, session: decompose phase 3)
import { useMemo, useState } from 'react';
import { ACHIEVEMENTS, ACH_GROUPS, ACH_TIERS, achValDisplay } from '../lib/achievements.js';
import { formatDateRu } from '../lib/dates.js';
import { S } from '../lib/styles.js';
import { C, tint } from '../lib/theme.js';
import { Icon } from '../ui/Icon.jsx';

export function AchievementsTab({stats, unlocked}){
  const [filter,setFilter] = useState('all'); // all | done | todo
  const [byDay,setByDay] = useState(false);   // просмотр по дням открытия vs каталог по группам
  const [query,setQuery] = useState('');      // поиск по названию/описанию/группе. session 033
  const total = ACHIEVEMENTS.length;
  const doneCount = ACHIEVEMENTS.filter(a=>unlocked[a.id]).length;
  const points = ACHIEVEMENTS.reduce((p,a)=> p + (unlocked[a.id]?ACH_TIERS[a.tier].pts:0), 0);
  const maxPoints = ACHIEVEMENTS.reduce((p,a)=> p+ACH_TIERS[a.tier].pts, 0);
  const pct = total? Math.round(doneCount/total*100) : 0;

  // Поиск по названию/описанию/группе. Секретные НЕполученные из поиска исключены — иначе
  // запрос выдал бы их настоящее название и заспойлерил. session 033.
  const q = query.trim().toLowerCase();
  const matchesQuery = (a) => {
    if(!q) return true;
    if(a.secret && !unlocked[a.id]) return false;
    return a.title.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q) || a.g.toLowerCase().includes(q);
  };
  const foundCount = useMemo(()=> q ? ACHIEVEMENTS.filter(matchesQuery).length : 0, [q, unlocked]);

  // Хронология: полученные достижения, сгруппированные по дате открытия (новые сверху). session: ach-by-day.
  const timeline = useMemo(()=>{
    const byDate = {};
    ACHIEVEMENTS.forEach(a=>{ const d=unlocked[a.id]; if(!d || !matchesQuery(a)) return; (byDate[d]=byDate[d]||[]).push(a); });
    return Object.keys(byDate).sort((a,b)=>b<a?-1:1).map(date=>({date, list:byDate[date]}));
  }, [unlocked, q]);

  return (
    <div>
      <div style={S.panel}>
        <div style={S.panelTitle}>Достижения <span style={S.dimSpan}>{doneCount} / {total}</span></div>
        <div style={{height:6, background:C.panelAlt, borderRadius:4, overflow:'hidden', margin:'10px 0 8px'}}>
          <div style={{height:'100%', width:`${pct}%`, background:C.amber}}/>
        </div>
        <div style={S.dimSpan}>Очки славы: {points} / {maxPoints} · открыто {pct}%</div>
        <div style={{display:'flex', gap:6, marginTop:12, alignItems:'center'}}>
          <div style={{position:'relative', flex:1, minWidth:0, display:'flex'}}>
            <span style={{position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:C.faint, display:'flex', pointerEvents:'none'}}><Icon name="search" size={15}/></span>
            <input style={{...S.input, paddingLeft:34}} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Найти достижение — название, описание, группа" aria-label="Поиск достижений"/>
          </div>
          {query && <button type="button" className="icon-btn" onClick={()=>setQuery('')} title="сбросить поиск" aria-label="Сбросить поиск"><Icon name="x" size={15}/></button>}
        </div>
        {q && <div style={{fontSize:11.5, color:foundCount?C.dim:C.red, marginTop:6}}>
          {foundCount ? `найдено: ${foundCount}` : 'ничего не найдено'}
        </div>}
        <div style={{display:'flex', gap:6, marginTop:12, flexWrap:'wrap', alignItems:'center'}}>
          {!byDay && [{id:'all',label:'Все'},{id:'done',label:'Полученные'},{id:'todo',label:'В процессе'}].map(f=>(
            <button key={f.id} type="button" className="chip" aria-pressed={filter===f.id} onClick={()=>setFilter(f.id)} style={{fontFamily:'inherit', ...(filter===f.id?{background:tint(C.amber,.16),color:C.amber}:{background:C.panelAlt, color:C.dim})}}>{f.label}</button>
          ))}
          <button type="button" className="chip" aria-pressed={byDay} onClick={()=>setByDay(v=>!v)} title="группировать по дате открытия"
            style={{fontFamily:'inherit', marginLeft:byDay?0:'auto', display:'inline-flex', alignItems:'center', gap:5, ...(byDay?{background:tint(C.cyan,.16), color:C.cyan}:{background:C.panelAlt, color:C.dim})}}><Icon name="calendar" size={13}/>по дням</button>
        </div>
      </div>

      {byDay && (
        timeline.length===0
          ? <div style={{...S.panel,...S.emptyState}}>Пока нет полученных достижений</div>
          : timeline.map(({date,list})=>(
            <div key={date} style={S.panel}>
              <div style={S.panelTitle}><span style={{textTransform:'capitalize'}}>{formatDateRu(date)}</span> <span style={S.dimSpan}>{date} · +{list.length}</span></div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))', gap:10}}>
                {list.map(a=>{ const tier=ACH_TIERS[a.tier]; return (
                  <div key={a.id} style={{border:`1px solid ${tint(tier.c,.45)}`, background:C.panelAlt, borderRadius:12, padding:12}}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <div style={{fontSize:26}}>{a.icon}</div>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontSize:13.5, fontWeight:700, color:C.text}}>{a.title}</div>
                        <div style={{fontSize:10, color:tier.c, textTransform:'uppercase', letterSpacing:'.05em'}}>{tier.label} · {a.g}</div>
                      </div>
                    </div>
                    <div style={{fontSize:11.5, color:C.dim, marginTop:8}}>{a.desc}</div>
                  </div>
                ); })}
              </div>
            </div>
          ))
      )}

      {!byDay && ACH_GROUPS.map(group=>{
        const list = ACHIEVEMENTS.filter(a=>a.g===group).filter(matchesQuery).filter(a=>{
          const done=!!unlocked[a.id];
          return filter==='all' || (filter==='done'&&done) || (filter==='todo'&&!done);
        });
        if(list.length===0) return null;
        return (
          <div key={group} style={S.panel}>
            <div style={S.panelTitle}>{group} <span style={S.dimSpan}>{list.filter(a=>unlocked[a.id]).length}/{list.length}</span></div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))', gap:10}}>
              {list.map(a=>{
                const done=!!unlocked[a.id];
                const tier=ACH_TIERS[a.tier];
                const v=a.val(stats);
                const prog=Math.min(100, a.target? v/a.target*100 : 0);
                const hidden=a.secret && !done;
                return (
                  <div key={a.id} style={{border:`1px solid ${done?tint(tier.c,.45):C.border}`, background:done?C.panelAlt:'transparent', borderRadius:12, padding:12, position:'relative'}}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <div style={{fontSize:26, filter:done?'none':'grayscale(1)', opacity:done?1:0.45}}>{hidden?'🔒':a.icon}</div>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontSize:13.5, fontWeight:700, color:done?C.text:C.dim}}>{hidden?'Секрет':a.title}</div>
                        <div style={{fontSize:10, color:tier.c, textTransform:'uppercase', letterSpacing:'.05em'}}>{tier.label}{done?` · ${unlocked[a.id]}`:''}</div>
                      </div>
                      {done && <span style={{color:tier.c, display:'flex'}}><Icon name="check" size={16}/></span>}
                    </div>
                    <div style={{fontSize:11.5, color:C.dim, marginTop:8, minHeight:30}}>{hidden?'Секретное достижение — открой его сам':a.desc}</div>
                    {!done && !hidden && (
                      <div style={{marginTop:6}}>
                        <div style={{height:4, background:C.panelAlt, borderRadius:2, overflow:'hidden'}}><div style={{height:'100%', width:`${prog}%`, background:tier.c}}/></div>
                        <div style={{fontSize:10, color:C.dim, marginTop:3, textAlign:'right'}}>{achValDisplay(a, Math.min(v,a.target))} / {achValDisplay(a, a.target)}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
