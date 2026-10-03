// План / факт по категориям (расходы или доходы) за выбранный месяц — вынесено из FinanceTab.jsx (session 036).
// session 046 (референс Э6б): раздел всегда раскрыт — по каждой категории с планом или фактом полоса «факт / план».
// Планы задаются по кнопке «Изменить планы» (прежняя форма: поле на категорию, «Сохранить планы», сброс крестиком).
// Раньше раздел был свёрнут по умолчанию, и пользователь посчитал его пропавшим.
import { useEffect, useState } from 'react';
import { maskMoney } from '../../lib/format.js';
import { S } from '../../lib/styles.js';
import { C } from '../../lib/theme.js';
import { Icon } from '../../ui/Icon.jsx';

export function PlanPanel({title, kindToggle, categories, actualByCat, plans, onSaveBatch, onRemove, barColor, spentWord, resetKey, mask=false, kindWord='расходов'}){
  const mo = n => maskMoney(mask, n);   // приватность: планы — часть «операций» (finMask.ops)
  const [draft,setDraft] = useState({});
  const [editing,setEditing] = useState(false);
  useEffect(()=>{ setDraft({}); setEditing(false); }, [resetKey]);
  const valOf = (c) => draft[c]!==undefined ? draft[c] : (plans[c]!=null ? String(plans[c]) : '');
  const planNum = (c) => { const raw = draft[c]!==undefined ? parseFloat(draft[c]) : plans[c]; return isNaN(raw)||raw==null ? 0 : raw; };
  const totalPlan = categories.reduce((s,c)=>s+planNum(c),0);
  const totalSpent = categories.reduce((s,c)=>s+(actualByCat[c]||0),0);
  const dirty = Object.keys(draft).length>0;
  const save = () => { const patch={}; Object.entries(draft).forEach(([c,v])=>{ const n=parseFloat(v); if(!isNaN(n)&&n>0) patch[c]=n; }); if(Object.keys(patch).length) onSaveBatch(patch); setDraft({}); setEditing(false); };
  // в просмотре — категории с планом или с фактом; сначала с планом, по доле выполнения
  const rows = categories.filter(c=>plans[c]!=null || (actualByCat[c]||0)>0)
    .sort((a,b)=> (plans[b]!=null)-(plans[a]!=null) || (actualByCat[b]||0)-(actualByCat[a]||0));
  const hasPlans = categories.some(c=>plans[c]!=null);

  return (
    <div style={S.panel}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,gap:8,flexWrap:'wrap'}}>
        <div style={{...S.panelTitle,marginBottom:0}}>{title}</div>
        {kindToggle}
      </div>

      {!editing && (<>
        {!hasPlans && <div style={{fontSize:13.5,color:C.dim,marginBottom:10}}>Планов {kindWord} на этот месяц нет. План по категории показывает, сколько ещё можно потратить.</div>}
        {rows.map(c=>{ const spent=actualByCat[c]||0; const pn=plans[c]||0; const over=pn>0&&spent>pn;
          return (
            <div key={c} style={{display:'grid',gridTemplateColumns:'minmax(70px,1fr) minmax(60px,1.4fr) auto',gap:12,alignItems:'center',padding:'6px 0'}}>
              <span style={{fontSize:13.5,overflowWrap:'anywhere',minWidth:0}}>{c}</span>
              <span style={{height:5,background:C.panelAlt,borderRadius:3,overflow:'hidden'}}>
                {pn>0 && <span style={{display:'block',height:'100%',width:`${Math.min(100,spent/pn*100)}%`,background: over?C.red : spent/pn>0.85?C.amber:barColor}}/>}
              </span>
              <span style={{fontSize:12.5,fontVariantNumeric:'tabular-nums',textAlign:'right',color:over?C.red:C.dim,whiteSpace:'nowrap'}}>
                <span style={{color:over?C.red:C.text}}>{mo(spent)}</span>{pn>0?` / ${mo(pn)}`:' · без плана'}
              </span>
            </div>
          );
        })}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginTop:10,flexWrap:'wrap'}}>
          {hasPlans ? <div style={{fontSize:12.5,color:C.dim}}>План {mo(totalPlan)} · {spentWord} {mo(totalSpent)}</div> : <span/>}
          <button style={S.btnGhost} onClick={()=>setEditing(true)}><Icon name="edit" size={14}/>{hasPlans?'Изменить планы':'Задать планы'}</button>
        </div>
      </>)}

      {editing && (<>
        {categories.map(c=>{ const spent=actualByCat[c]||0; const plan=plans[c];
          return (
            <div key={c} style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8,alignItems:'center',marginBottom:8}}>
              <span style={{fontSize:13.5,overflowWrap:'anywhere',minWidth:0}}>{c}</span>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:12,color:C.dim,fontVariantNumeric:'tabular-nums',minWidth:58,textAlign:'right'}}>{mo(spent)}</span>
                <span style={{color:C.faint}}>/</span>
                <input style={{...S.input,fontSize:13,padding:'7px 9px',width:110,minWidth:0,flex:'none'}} type="number" inputMode="decimal" placeholder="план ₽" aria-label={`План: ${c}`}
                  value={valOf(c)} onChange={e=>setDraft({...draft,[c]:e.target.value})} onKeyDown={e=>e.key==='Enter'&&save()} />
                {plan!=null ? <button className="icon-btn" title="сбросить план" aria-label="Сбросить план" onClick={()=>onRemove(c)}><Icon name="x" size={14}/></button> : <span style={{width:23}}/>}
              </div>
            </div>
          );
        })}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginTop:12,flexWrap:'wrap',borderTop:`1px solid ${C.border}`,paddingTop:12}}>
          <div style={{fontSize:12.5,color:C.dim}}>Итого план: <b style={{color:C.text}}>{mo(totalPlan)}</b> · {spentWord} {mo(totalSpent)}</div>
          <div style={{display:'flex',gap:8}}>
            <button style={S.btnGhost} onClick={()=>{ setDraft({}); setEditing(false); }}>Готово</button>
            <button style={{...S.btnPrimary,opacity:dirty?1:0.45}} onClick={save}>Сохранить планы</button>
          </div>
        </div>
      </>)}
    </div>
  );
}
