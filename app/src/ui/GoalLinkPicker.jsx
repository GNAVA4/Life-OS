// МУЛЬТИ-привязка «выполнил → вклад в цель»: задача/привычка может вкладываться сразу в несколько целей. session 015.
import { useState } from 'react';
import { C } from '../lib/theme.js';
import { S } from '../lib/styles.js';
import { GL_SCOPE } from '../lib/constants.js';
import { goalByKey, goalLinkOptions, goalMode } from '../lib/goals.js';
import { Icon } from './Icon.jsx';
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
            return <div key={l.scope+'|'+l.goalId+'_'+i} className="chip" style={{background:'rgba(227,162,76,.14)',color:C.amber,display:'flex',gap:6,alignItems:'center',maxWidth:'100%',paddingRight:6}}>
              <Icon name="goals" size={13}/>
              <span style={{minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{GL_SCOPE[l.scope]}: {gg?gg.title:'—'} +{l.amount}{unit}</span>
              <button type="button" aria-label="Убрать цель" style={{background:'none',border:'none',color:C.amber,cursor:'pointer',display:'flex',padding:0,flexShrink:0}} onClick={()=>remove(l)}><Icon name="x" size={13}/></button>
            </div>; })}
        </div>
      )}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',width:'100%'}}>
        <Select style={{flex:'1 1 150px',minWidth:0,maxWidth:'100%'}} value={key} onChange={setKey} options={goalLinkOptions(goals)} />
        <input style={{...S.input,flex:'0 0 auto',width:90,minWidth:0}} type="number" placeholder={isCounter?'+ штук':'+ %'} value={amount} onChange={e=>setAmount(e.target.value)} />
        <button style={{...S.iconBtnAmber,width:36,height:36,opacity:key?1:.45}} title="добавить цель" aria-label="Добавить цель" onClick={add}><Icon name="plus" size={16}/></button>
      </div>
      {g && <span style={{fontSize:12,color:C.dim,display:'block',marginTop:5}}>{isCounter?'к счётчику при выполнении · по умолчанию +1 шт':'% к цели при выполнении · по умолчанию +1%'}</span>}
    </div>
  );
}
