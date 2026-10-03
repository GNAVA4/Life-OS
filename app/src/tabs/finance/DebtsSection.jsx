// Финансы → Долги: движения долга = операции на счёт (debtFlow+exclude) — не идут в доход/расход,
// но реально двигают баланс счёта и чистые активы. Вынесено из FinanceTab.jsx (session 036).
// Редизайн «Тихий» — session 043 (Э6г): движение — кнопками прямо у человека («Вернул / Дал ещё»,
// «Я отдал / Взял ещё»), без выбора долга из списка. Логика debtMovement прежняя.
import { useState } from 'react';
import { fmtMoney } from '../../lib/format.js';
import { S } from '../../lib/styles.js';
import { C, tint } from '../../lib/theme.js';
import { Icon } from '../../ui/Icon.jsx';
import { ConfirmIconBtn, Select } from '../../ui/primitives.jsx';

function DebtRow({d, mm, accounts, updateDebt, deleteDebt, debtMovement}){
  const [editing,setEditing] = useState(false);
  const [name,setName] = useState(d.name||'');
  const [mv,setMv] = useState(null); // 'less' | 'more'
  const [amt,setAmt] = useState(''); const [acc,setAcc] = useState('');
  const owed = d.dir==='owed_to_me';
  const done = (d.amount||0)<=0;
  const save = () => { updateDebt(d.id,{name:name.trim()||d.name}); setEditing(false); };
  const submitMv = () => { const v=parseFloat(String(amt).replace(',','.')); if(v>0){ debtMovement({debtId:d.id, amount:v, accountId:acc||null, decrease: mv==='less'}); setAmt(''); setMv(null); } };
  const labels = owed ? {less:'Вернули', more:'Дал ещё'} : {less:'Я отдал', more:'Взял ещё'};
  const accLabel = owed ? (mv==='less'?'куда пришло':'с какого счёта') : (mv==='less'?'с какого счёта':'на какой счёт');
  return (
    <div style={{borderBottom:`1px solid ${C.border}`,padding:'12px 0',opacity:done&&!mv?.55:1,display:'flex',flexDirection:'column',gap:8}}>
      {editing ? (
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <input style={S.input} value={name} onChange={e=>setName(e.target.value)} autoFocus aria-label="Имя" onKeyDown={e=>{ if(e.key==='Enter') save(); if(e.key==='Escape') setEditing(false); }} />
          <button style={S.btnPrimary} onClick={save}>Сохранить</button>
          <button className="icon-btn" aria-label="Отмена" onClick={()=>{ setEditing(false); setName(d.name||''); }}><Icon name="x" size={16}/></button>
        </div>
      ) : (
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{flex:1,minWidth:0,fontSize:14.5,overflowWrap:'anywhere',textDecoration:done?'line-through':'none'}}>{d.name}</span>
          <span style={{fontVariantNumeric:'tabular-nums',fontWeight:600}}>{mm(d.amount||0)}</span>
          <button className="icon-btn" title="переименовать" aria-label="Переименовать" onClick={()=>{ setName(d.name||''); setEditing(true); }}><Icon name="edit" size={15}/></button>
          <ConfirmIconBtn onConfirm={()=>deleteDebt(d.id)} confirmLabel="удалить?" title="удалить долг" icon="trash" />
        </div>
      )}
      <div style={{display:'flex',gap:6}}>
        {['less','more'].map(k=>(
          <button key={k} style={{...S.btnGhost,color:mv===k?C.amber:C.text,borderColor:mv===k?tint(C.amber,.5):C.border}} onClick={()=>setMv(mv===k?null:k)} aria-pressed={mv===k}>{labels[k]}</button>))}
      </div>
      {mv && (
        <div className="anim-collapse" style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <input autoFocus style={{...S.input,flex:'1 1 110px'}} inputMode="decimal" placeholder="Сумма" value={amt} aria-label="Сумма движения" onChange={e=>setAmt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitMv()} />
          <Select small style={{flex:'1 1 150px'}} value={acc} onChange={setAcc} options={[{value:'',label:accLabel}, ...accounts.map(a=>({value:a.id,label:a.name}))]} />
          <button style={{...S.btnPrimary,opacity:parseFloat(amt)>0?1:.45}} onClick={submitMv}>Записать</button>
        </div>
      )}
    </div>
  );
}

// Вкладка «Долги» (session 028c): создание сразу двигает счёт; движения меняют остаток и баланс; в доход/расход не идёт.
export function DebtsSection({debtors=[], transactions=[], accounts=[], mask=false, addDebt, updateDebt, deleteDebt, debtMovement}){
  const [addOpen,setAddOpen] = useState(false);
  const [name,setName] = useState(''); const [amount,setAmount] = useState(''); const [dir,setDir] = useState('owed_to_me'); const [acc,setAcc] = useState('');
  const [logOpen,setLogOpen] = useState(false); const [logAcc,setLogAcc] = useState('');
  const mm = n => mask ? '••••••' : fmtMoney(n);
  const list = debtors.map(d=>({...d, dir:d.dir||'owed_to_me'}));
  const owed = list.filter(d=>d.dir==='owed_to_me');
  const iOwe = list.filter(d=>d.dir==='i_owe');
  const sumOut = (arr)=>arr.reduce((s,d)=>s+Math.max(0,d.amount||0),0);
  const accName = (id) => accounts.find(a=>a.id===id)?.name;
  const accOpts = (empty) => [{value:'',label:empty}, ...accounts.map(a=>({value:a.id,label:a.name}))];
  const submit = () => { const a=parseFloat(String(amount).replace(',','.')); if(name.trim()&&a>0){ addDebt({name:name.trim(), amount:a, dir, accountId:acc||null}); setName(''); setAmount(''); setAddOpen(false); } };
  const debtTx = transactions.filter(t=>t.debtFlow);
  const logTx = debtTx.filter(t=> !logAcc || (t.accountId||'')===logAcc).slice(0,40);
  const row = (d) => <DebtRow key={d.id} d={d} mm={mm} accounts={accounts} updateDebt={updateDebt} deleteDebt={deleteDebt} debtMovement={debtMovement} />;
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:8,marginBottom:20,alignItems:'stretch'}}>
        <div style={S.statCard}><div style={{fontSize:11.5,color:C.dim}}>Мне должны</div><div style={{fontSize:18,fontWeight:700,color:C.green,fontVariantNumeric:'tabular-nums'}}>{mm(sumOut(owed))}</div></div>
        <div style={S.statCard}><div style={{fontSize:11.5,color:C.dim}}>Я должен</div><div style={{fontSize:18,fontWeight:700,color:C.red,fontVariantNumeric:'tabular-nums'}}>{mm(sumOut(iOwe))}</div></div>
        <button style={{...S.btnPrimary,flexDirection:'column',gap:2,padding:'8px 12px'}} onClick={()=>setAddOpen(o=>!o)} aria-expanded={addOpen}><Icon name={addOpen?'x':'plus'} size={16}/><span style={{fontSize:12}}>{addOpen?'Закрыть':'Долг'}</span></button>
      </div>

      {addOpen && (
        <div style={{...S.plate,display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
          <div style={{...S.seg,background:C.bg,display:'flex'}}>
            {[{v:'owed_to_me',l:'Мне должны (дал)'},{v:'i_owe',l:'Я должен (взял)'}].map(o=>(
              <button key={o.v} onClick={()=>setDir(o.v)} style={{...S.segBtn,flex:1,background:dir===o.v?C.panelAlt:'transparent',color:dir===o.v?C.text:C.dim}}>{o.l}</button>))}
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <input autoFocus style={{...S.input,background:C.bg,flex:'1 1 150px'}} placeholder="Кто / кому" value={name} aria-label="Имя" onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />
            <input style={{...S.input,background:C.bg,flex:'0 1 120px'}} inputMode="decimal" placeholder="Сумма" value={amount} aria-label="Сумма долга" onChange={e=>setAmount(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />
          </div>
          <Select small value={acc} onChange={setAcc} options={accOpts(dir==='owed_to_me'?'с какого счёта дал':'на какой счёт пришло')} />
          <span style={{fontSize:12,color:C.dim,lineHeight:1.45}}>Создание сразу двигает счёт: «дал» — списывается, «взял» — зачисляется. В доходы и расходы не идёт.</span>
          <button style={{...S.btnPrimary,opacity:name.trim()&&parseFloat(amount)>0?1:.45}} onClick={submit}>Добавить долг</button>
        </div>
      )}

      <div style={S.panel}>
        <div style={S.panelTitle}>Мне должны<span style={S.dimSpan}>{mm(sumOut(owed))}</span></div>
        {owed.length===0 ? <div style={S.emptyState}>Никто не должен.</div> : owed.map(row)}
      </div>
      <div style={S.panel}>
        <div style={S.panelTitle}>Я должен<span style={S.dimSpan}>{mm(sumOut(iOwe))}</span></div>
        {iOwe.length===0 ? <div style={S.emptyState}>Долгов нет.</div> : iOwe.map(row)}
      </div>

      {debtTx.length>0 && (
        <div style={S.panel}>
          <button onClick={()=>setLogOpen(o=>!o)} aria-expanded={logOpen}
            style={{display:'flex',alignItems:'center',gap:8,width:'100%',background:'none',border:'none',color:C.dim,cursor:'pointer',padding:'4px 0',fontFamily:'inherit',fontSize:13}}>
            <Icon name="clock" size={15}/><span style={{flex:1,textAlign:'left'}}>История движений · {debtTx.length}</span>
            <span style={{display:'flex',transform:logOpen?'rotate(90deg)':'none'}}><Icon name="chevR" size={14}/></span>
          </button>
          {logOpen && (
            <div className="anim-collapse" style={{marginTop:8}}>
              <Select small style={{maxWidth:200,marginBottom:6}} value={logAcc} onChange={setLogAcc} options={accOpts('все счета')} />
              {logTx.length===0 ? <div style={S.emptyState}>По этому счёту движений нет.</div> : logTx.map(t=>(
                <div key={t.id} style={{...S.taskRow,gap:10}}>
                  <span style={{width:44,fontSize:12,color:C.dim,fontVariantNumeric:'tabular-nums',flexShrink:0}}>{t.date.slice(8,10)}.{t.date.slice(5,7)}</span>
                  <span style={{flex:1,minWidth:0,fontSize:13.5,overflowWrap:'anywhere'}}>{t.category}{t.note?` · ${t.note}`:''}<span style={{color:C.dim}}> · {accName(t.accountId)||'без счёта'}</span></span>
                  <span style={{fontVariantNumeric:'tabular-nums',fontSize:13.5,color:t.type==='income'?C.green:C.text,flexShrink:0}}>{t.type==='income'?'+':'−'}{mm(t.amount)}</span>
                </div>))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
