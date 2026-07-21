// Вкладка/раздел: AchievementsTab (вынесено из App.jsx, session: decompose phase 3)
import { useState } from 'react';
import { ACHIEVEMENTS, ACH_GROUPS, ACH_TIERS, achValDisplay } from '../lib/achievements.js';
import { S } from '../lib/styles.js';
import { C } from '../lib/theme.js';

export function AchievementsTab({stats, unlocked}){
  const [filter,setFilter] = useState('all'); // all | done | todo
  const total = ACHIEVEMENTS.length;
  const doneCount = ACHIEVEMENTS.filter(a=>unlocked[a.id]).length;
  const points = ACHIEVEMENTS.reduce((p,a)=> p + (unlocked[a.id]?ACH_TIERS[a.tier].pts:0), 0);
  const maxPoints = ACHIEVEMENTS.reduce((p,a)=> p+ACH_TIERS[a.tier].pts, 0);
  const pct = total? Math.round(doneCount/total*100) : 0;

  return (
    <div>
      <div style={S.panel}>
        <div style={S.panelTitle}>Достижения <span style={S.dimSpan}>{doneCount} / {total}</span></div>
        <div style={{height:8, background:C.panelAlt, borderRadius:4, overflow:'hidden', margin:'8px 0'}}>
          <div style={{height:'100%', width:`${pct}%`, background:C.amber}}/>
        </div>
        <div style={S.dimSpan}>Очки славы: {points} / {maxPoints} · открыто {pct}%</div>
        <div style={{display:'flex', gap:6, marginTop:12, flexWrap:'wrap'}}>
          {[{id:'all',label:'Все'},{id:'done',label:'Полученные'},{id:'todo',label:'В процессе'}].map(f=>(
            <div key={f.id} className="chip" onClick={()=>setFilter(f.id)} style={{background:filter===f.id?C.amber:C.panelAlt, color:filter===f.id?'#1A1200':C.dim, borderColor:filter===f.id?C.amber:C.border}}>{f.label}</div>
          ))}
        </div>
      </div>

      {ACH_GROUPS.map(group=>{
        const list = ACHIEVEMENTS.filter(a=>a.g===group).filter(a=>{
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
                  <div key={a.id} style={{border:`1px solid ${done?tier.c:C.border}`, background:done?C.panelAlt:'transparent', borderRadius:8, padding:12, position:'relative'}}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <div style={{fontSize:26, filter:done?'none':'grayscale(1)', opacity:done?1:0.45}}>{hidden?'🔒':a.icon}</div>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontSize:13.5, fontWeight:700, color:done?C.text:C.dim}}>{hidden?'Секрет':a.title}</div>
                        <div style={{fontSize:10, color:tier.c, textTransform:'uppercase', letterSpacing:'.05em'}}>{tier.label}{done?` · ${unlocked[a.id]}`:''}</div>
                      </div>
                      {done && <div style={{fontSize:15, color:tier.c}}>✓</div>}
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
