// Плашка планов (расходы/доходы) — вынесено из FinanceTab.jsx (session 036, файл был 626 строк).
import { useEffect, useState } from 'react';
import { maskMoney } from '../../lib/format.js';
import { S } from '../../lib/styles.js';
import { C } from '../../lib/theme.js';

export function PlanPanel({title, open, setOpen, planSwitcher, kindToggle, categories, actualByCat, plans, onSaveBatch, onRemove, barColor, spentWord, resetKey, mask=false}){
  const mo = n => maskMoney(mask, n);   // приватность: планы — часть «операций» (finMask.ops)
  const [draft,setDraft] = useState({});
  useEffect(()=>{ setDraft({}); }, [resetKey]);
  const valOf = (c) => draft[c]!==undefined ? draft[c] : (plans[c]!=null ? String(plans[c]) : '');
  const planNum = (c) => { const raw = draft[c]!==undefined ? parseFloat(draft[c]) : plans[c]; return isNaN(raw)||raw==null ? 0 : raw; };
  const totalPlan = categories.reduce((s,c)=>s+planNum(c),0);
  const totalSpent = categories.reduce((s,c)=>s+(actualByCat[c]||0),0);
  const dirty = Object.keys(draft).length>0;
  const save = () => { const patch={}; Object.entries(draft).forEach(([c,v])=>{ const n=parseFloat(v); if(!isNaN(n)&&n>0) patch[c]=n; }); if(Object.keys(patch).length) onSaveBatch(patch); setDraft({}); };
  return (
    <div style={S.panel}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:open?12:0,gap:8,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}} onClick={()=>setOpen(o=>!o)}>
          <span style={{color:C.dim,fontSize:11,transform:open?'none':'rotate(-90deg)',transition:'transform .12s'}}>▾</span>
          <div style={{...S.panelTitle,marginBottom:0}}>{title}</div>
          {kindToggle}
        </div>
        {open && planSwitcher}
      </div>
      {open && (<>
        {categories.map(c=>{ const spent=actualByCat[c]||0; const plan=plans[c]; const pn=planNum(c);
          return (
            <div key={c} style={{marginBottom:10}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8,alignItems:'center'}}>
                <span style={{fontSize:12.5,overflowWrap:'anywhere',minWidth:0}}>{c}</span>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:11.5,color:C.dim,fontFamily:"'JetBrains Mono',monospace",minWidth:58,textAlign:'right'}}>{mo(spent)}</span>
                  <span style={{color:C.dim}}>/</span>
                  <input style={{...S.input,fontSize:12.5,padding:'7px 9px',width:120,minWidth:0,flex:'none'}} type="number" placeholder="план ₽"
                    value={valOf(c)} onChange={e=>setDraft({...draft,[c]:e.target.value})} onKeyDown={e=>e.key==='Enter'&&save()} />
                  {plan!=null ? <button className="icon-btn" title="сбросить план" onClick={()=>onRemove(c)}>✕</button> : <span style={{width:20}}/>}
                </div>
              </div>
              {pn>0 && (
                <div style={{height:4,background:C.panelAlt,borderRadius:2,overflow:'hidden',marginTop:5}}>
                  <div style={{height:'100%',width:`${Math.min(100,spent/pn*100)}%`,background: spent>pn?C.red : spent/pn>0.7?C.amber:barColor}}/>
                </div>
              )}
            </div>
          );
        })}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginTop:14,flexWrap:'wrap',borderTop:`1px solid ${C.border}`,paddingTop:12}}>
          <div style={{fontSize:12,color:C.dim}}>Итого план: <b style={{color:C.text}}>{mo(totalPlan)}</b> · {spentWord} {mo(totalSpent)}</div>
          <button style={{...S.iconBtnAmber,width:'auto',padding:'0 18px',height:36,fontWeight:700,opacity:dirty?1:0.55}} onClick={save}>Сохранить планы</button>
        </div>
      </>)}
    </div>
  );
}

