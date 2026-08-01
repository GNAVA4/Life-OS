// Финансы → Долги: движения долга = операции на счёт (debtFlow+exclude) — не идут в доход/расход,
// но реально двигают баланс счёта и чистые активы. Вынесено из FinanceTab.jsx (session 036).
import { useState } from 'react';
import { fmtMoney } from '../../lib/format.js';
import { S } from '../../lib/styles.js';
import { C } from '../../lib/theme.js';
import { ConfirmIconBtn, Select } from '../../ui/primitives.jsx';


// Строка долга: имя + остаток + ✏ (переименовать, без движения денег) + удалить. Изменение остатка и
// движение денег — только через плашку «Движение по долгу» (или создание). session 028c.
function DebtRow({d, mask, updateDebt, deleteDebt}){
  const [editing,setEditing] = useState(false);
  const [name,setName] = useState(d.name||'');
  const done = (d.amount||0)<=0;
  const save = () => { updateDebt(d.id,{name:name.trim()||d.name}); setEditing(false); };
  if(editing) return (
    <div className="row-hover" style={{...S.taskRow, gap:6}}>
      <input style={{...S.input,flex:1,minWidth:0}} value={name} onChange={e=>setName(e.target.value)} autoFocus onKeyDown={e=>e.key==='Enter'&&save()} />
      <button style={{...S.iconBtnAmber,width:34,height:34,fontSize:14,flex:'none'}} title="сохранить имя" onClick={save}>💾</button>
      <button className="icon-btn" title="отмена" onClick={()=>{ setEditing(false); setName(d.name||''); }}>✕</button>
    </div>
  );
  return (
    <div className="row-hover" style={{...S.taskRow, opacity:done?0.5:1}}>
      <div style={{flex:1,minWidth:0,fontSize:13.5,overflowWrap:'anywhere',textDecoration:done?'line-through':'none'}}>{d.name}</div>
      <div style={{width:100,textAlign:'right',flex:'none',fontFamily:"'JetBrains Mono',monospace",fontSize:13}}>{mask?'••••••':fmtMoney(d.amount||0)}</div>
      <button className="icon-btn" title="переименовать" onClick={()=>{ setName(d.name||''); setEditing(true); }}>✏</button>
      <ConfirmIconBtn onConfirm={()=>deleteDebt(d.id)} confirmLabel="удалить?" title="удалить долг" />
    </div>
  );
}

// Вкладка «Долги» (session 028c). Две плашки-«операции»: «Новый долг» (создание сразу двигает счёт) и
// «Движение по долгу» (человек + действие + счёт + сумма → меняет остаток и баланс). В доход/расход не идёт.
export function DebtsSection({debtors=[], transactions=[], accounts=[], mask=false, addDebt, updateDebt, deleteDebt, debtMovement}){
  const [name,setName] = useState(''); const [amount,setAmount] = useState(''); const [dir,setDir] = useState('owed_to_me'); const [acc,setAcc] = useState('');
  const [mvId,setMvId] = useState(''); const [mvAmt,setMvAmt] = useState(''); const [mvAcc,setMvAcc] = useState(''); const [mvDir,setMvDir] = useState('less');
  const [logAcc,setLogAcc] = useState('');
  const mm = n => mask ? '••••••' : fmtMoney(n);
  const list = debtors.map(d=>({...d, dir:d.dir||'owed_to_me'}));
  const owed = list.filter(d=>d.dir==='owed_to_me');
  const iOwe = list.filter(d=>d.dir==='i_owe');
  const sumOut = (arr)=>arr.reduce((s,d)=>s+Math.max(0,d.amount||0),0);
  const accName = (id) => accounts.find(a=>a.id===id)?.name;
  const accOpts = (empty) => [{value:'',label:empty}, ...accounts.map(a=>({value:a.id,label:a.name}))];
  const submit = () => { const a=parseFloat(amount); if(name.trim()&&a>0){ addDebt({name:name.trim(), amount:a, dir, accountId:acc||null}); setName(''); setAmount(''); } };
  const mvDebt = list.find(d=>d.id===mvId);
  const mvOwed = mvDebt ? mvDebt.dir==='owed_to_me' : true;
  const submitMv = () => { const v=parseFloat(mvAmt); if(mvDebt && v>0){ debtMovement({debtId:mvId, amount:v, accountId:mvAcc||null, decrease: mvDir==='less'}); setMvAmt(''); } };
  const debtTx = transactions.filter(t=>t.debtFlow);
  const logTx = debtTx.filter(t=> !logAcc || (t.accountId||'')===logAcc).slice(0,40);
  const row = (d) => <DebtRow key={d.id} d={d} mask={mask} updateDebt={updateDebt} deleteDebt={deleteDebt} />;
  return (
    <div>
      <div style={S.panel}>
        <div style={S.panelTitle}>Новый долг</div>
        <div style={S.inputRow}>
          <Select style={{minWidth:170}} value={dir} onChange={setDir} options={[{value:'owed_to_me',label:'Мне должны (дал в долг)'},{value:'i_owe',label:'Я должен (взял в долг)'}]} />
          <input style={S.input} placeholder="Имя (кто / кому)" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />
          <input style={{...S.input,maxWidth:120}} type="number" inputMode="decimal" placeholder="сумма" value={amount} onChange={e=>setAmount(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />
          <Select style={{minWidth:160}} value={acc} onChange={setAcc} options={accOpts(dir==='owed_to_me'?'с какого счёта дал':'на какой счёт пришло')} />
          <button style={S.iconBtnAmber} onClick={submit}>+</button>
        </div>
        <div style={{display:'flex',gap:14,flexWrap:'wrap',marginTop:10,fontSize:12}}>
          <span style={{color:C.green}}>Мне должны: <b>{mm(sumOut(owed))}</b></span>
          <span style={{color:C.red}}>Я должен: <b>{mm(sumOut(iOwe))}</b></span>
        </div>
        <div style={{...S.dimSpan,marginLeft:0,marginTop:8,display:'block',fontSize:11}}>
          Создание сразу двигает счёт: «дал в долг» — списывается с выбранного счёта; «взял в долг» — зачисляется. В доход/расход не идёт. Дальше меняй долг через «Движение по долгу» ниже.
        </div>
      </div>

      {list.length>0 && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Движение по долгу</div>
          <div style={S.inputRow}>
            <Select style={{minWidth:170,flex:1}} value={mvId} onChange={setMvId} placeholder="выбери долг" options={list.map(d=>({value:d.id,label:`${d.name} · ${d.dir==='owed_to_me'?'мне':'я'} ${fmtMoney(d.amount||0)}`}))} />
            <Select style={{minWidth:150}} value={mvDir} onChange={setMvDir} options={mvOwed?[{value:'less',label:'вернули мне'},{value:'more',label:'дал ещё'}]:[{value:'less',label:'я отдал'},{value:'more',label:'взял ещё'}]} />
            <input style={{...S.input,maxWidth:120}} type="number" inputMode="decimal" placeholder="сумма" value={mvAmt} onChange={e=>setMvAmt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitMv()} />
            <Select style={{minWidth:160}} value={mvAcc} onChange={setMvAcc} options={accOpts(mvOwed?(mvDir==='less'?'куда пришло':'с какого счёта'):(mvDir==='less'?'с какого счёта':'на какой счёт'))} />
            <button style={S.iconBtnAmber} onClick={submitMv} disabled={!mvDebt}>+</button>
          </div>
          <div style={{...S.dimSpan,marginLeft:0,marginTop:8,display:'block',fontSize:11}}>Меняет остаток долга и баланс счёта (и «чистые активы»). «вернули/отдал» — уменьшают долг, «ещё» — увеличивают. Доходом/расходом не считается.</div>
        </div>
      )}

      <div style={S.panel}>
        <div style={S.panelTitle}>Мне должны <span style={S.dimSpan}>{mm(sumOut(owed))}</span></div>
        {owed.length===0 ? <div style={S.emptyState}>Пусто</div> : owed.map(row)}
      </div>
      <div style={S.panel}>
        <div style={S.panelTitle}>Я должен <span style={S.dimSpan}>{mm(sumOut(iOwe))}</span></div>
        {iOwe.length===0 ? <div style={S.emptyState}>Пусто</div> : iOwe.map(row)}
      </div>

      {debtTx.length>0 && (
        <div style={S.panel}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap',marginBottom:10}}>
            <div style={{...S.panelTitle,marginBottom:0}}>История движений</div>
            <Select small style={{minWidth:150}} value={logAcc} onChange={setLogAcc} options={accOpts('все счета')} />
          </div>
          {logTx.length===0 ? <div style={S.emptyState}>Нет по этому счёту</div> : logTx.map(t=>(
            <div key={t.id} className="row-hover" style={S.taskRow}>
              <div style={{width:56,fontSize:12,color:C.dim,fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>{t.date.slice(5)}</div>
              <div style={{flex:1,minWidth:0,fontSize:13,overflowWrap:'anywhere'}}>{t.category}{t.note?` · ${t.note}`:''}<span style={{color:C.dim}}> · {accName(t.accountId)||'без счёта'}</span></div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:t.type==='income'?C.green:C.red,flexShrink:0}}>{t.type==='income'?'+':'−'}{mm(t.amount)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
