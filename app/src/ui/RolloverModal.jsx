// Rollover целей: по каждому скоупу (неделя/месяц/год) свой выбор carry/fresh. session 022.
import { useState } from 'react';
import { C } from '../lib/theme.js';
import { S } from '../lib/styles.js';
import { PERIOD_LABEL } from '../lib/constants.js';
import { Modal } from './primitives.jsx';

export function RolloverModal({scopes, onApply, onClose}){
  const [choices,setChoices] = useState(()=>Object.fromEntries(scopes.map(s=>[s,'carry'])));
  return (
    <Modal onClose={onClose} title="Новый период">
      <div style={{fontSize:13.5,color:C.text,marginBottom:14,lineHeight:1.5}}>
        Начался новый период. Что сделать с целями прошлого периода — по каждому типу отдельно:
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {scopes.map(sc=>(
          <div key={sc} style={{...S.panel,padding:12,marginBottom:0}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>{PERIOD_LABEL[sc]||sc}</div>
            <div style={{display:'flex',gap:6}}>
              {[{id:'carry',label:'Перенести незавершённые'},{id:'fresh',label:'Начать заново'}].map(({id,label})=>(
                <div key={id} className="chip" onClick={()=>setChoices(c=>({...c,[sc]:id}))}
                  style={{flex:1,textAlign:'center',background:choices[sc]===id?C.amber:C.panelAlt,color:choices[sc]===id?'#1A1200':C.dim,borderColor:choices[sc]===id?C.amber:C.border}}>{label}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button style={{...S.sheetBtn,marginTop:14,width:'100%',flex:'none',borderColor:C.amber,color:C.amber}} onClick={()=>onApply(choices)}>Применить</button>
      <div style={{fontSize:11,color:C.dim,marginTop:12}}>Ничего не удаляется — при «Начать заново» цели уходят в архив (вкладка «Цели»).</div>
    </Modal>
  );
}
