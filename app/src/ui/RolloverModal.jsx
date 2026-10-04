// Rollover целей: по каждому скоупу (неделя/месяц/год) свой выбор carry/fresh. session 022.
import { useState } from 'react';
import { C, tint } from '../lib/theme.js';
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
          <div key={sc} style={{background:C.panelAlt,borderRadius:12,padding:12}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>{PERIOD_LABEL[sc]||sc}</div>
            <div style={{display:'flex',gap:6}}>
              {[{id:'carry',label:'Перенести незавершённые'},{id:'fresh',label:'Начать заново'}].map(({id,label})=>(
                <button key={id} type="button" className="chip" aria-pressed={choices[sc]===id} onClick={()=>setChoices(c=>({...c,[sc]:id}))}
                  style={{flex:1,textAlign:'center',fontFamily:'inherit',...(choices[sc]===id?{background:tint(C.amber,.16),color:C.amber}:{background:C.bg,color:C.dim})}}>{label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button style={{...S.btnPrimary,marginTop:14,width:'100%'}} onClick={()=>onApply(choices)}>Применить</button>
      <div style={{fontSize:12,color:C.dim,marginTop:12,lineHeight:1.45}}>Ничего не удаляется — при «Начать заново» цели уходят в архив (вкладка «Цели»).</div>
    </Modal>
  );
}
