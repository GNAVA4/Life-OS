// МУЛЬТИ-привязка «выполнил → вклад в цель»: задача/привычка может вкладываться сразу в несколько целей. session 015.
import { useState } from 'react';
import { C } from '../lib/theme.js';
import { S } from '../lib/styles.js';
import { GL_SCOPE } from '../lib/constants.js';
import { goalByKey, goalLinkOptions, goalMode } from '../lib/goals.js';
import { Select } from './primitives.jsx';

export function GoalLinkPicker({goals, links=[], onLinks}){
  const [key,setKey] = useState('');
  const [amount,setAmount] = useState('');
  const g = goalByKey(goals, key);
  const isCounter = g && goalMode(g)==='counter';
  const add = () => {
    if(!key) return; const [scope,goalId]=key.split('|');
    const amt=parseFloat(amount);
    const a=(isNaN(amt)||amt<=0) ? 1 : amt; // дефолт +1 (штука/процент)
    const rest = links.filter(l=>!(l.scope===scope && l.goalId===goalId)); // одна цель — одна запись, сумму обновляем
    onLinks([...rest, {scope,goalId,amount:a}]); setKey(''); setAmount('');
  };
  const remove = (l) => onLinks(links.filter(x=>!(x.scope===l.scope && x.goalId===l.goalId)));
  return (
    <div style={{marginTop:8,width:'100%'}}>
      {links.length>0 && (
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
          {links.map((l,i)=>{ const gg=(goals[l.scope]||[]).find(x=>x.id===l.goalId); const unit=(gg&&goalMode(gg)==='counter')?' шт':'%';
            return <div key={l.scope+'|'+l.goalId+'_'+i} className="chip" style={{background:C.panelAlt,color:C.amber,borderColor:C.border,display:'flex',gap:6,alignItems:'center',maxWidth:'100%'}}>
              <span style={{minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>🎯 {GL_SCOPE[l.scope]}: {gg?gg.title:'—'} +{l.amount}{unit}</span>
              <span style={{cursor:'pointer',flexShrink:0}} onClick={()=>remove(l)}>✕</span>
            </div>; })}
        </div>
      )}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',width:'100%'}}>
        <Select style={{flex:'1 1 150px',minWidth:0,maxWidth:'100%'}} value={key} onChange={setKey} options={goalLinkOptions(goals)} />
        <input style={{...S.input,flex:'0 0 auto',width:90,minWidth:0}} type="number" placeholder={isCounter?'+ штук':'+ %'} value={amount} onChange={e=>setAmount(e.target.value)} />
        <button style={{...S.iconBtnAmber,width:32,height:32,fontSize:14}} title="добавить цель" onClick={add}>+</button>
      </div>
      {g && <span style={{fontSize:11,color:C.dim,display:'block',marginTop:4}}>{isCounter?'к счётчику при выполнении · по умолчанию +1 шт':'% к цели при выполнении · по умолчанию +1%'}</span>}
    </div>
  );
}
