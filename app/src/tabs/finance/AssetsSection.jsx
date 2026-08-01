// Финансы → Активы: счета, замеры баланса, распределение и чистые активы во времени.
// Вынесено из FinanceTab.jsx (session 036).
import { useMemo, useState } from 'react';
import { baseChartOpts } from '../../lib/charts.js';
import { DEFAULT_ACCOUNTS } from '../../lib/constants.js';
import { openDatePicker, todayStr } from '../../lib/dates.js';
import { accountBalanceNow, accountBalanceOn, unassignedNetOn } from '../../lib/finance.js';
import { fmtMoney } from '../../lib/format.js';
import { vis } from '../../lib/storage.js';
import { S } from '../../lib/styles.js';
import { C, PIE_COLORS } from '../../lib/theme.js';
import { ChartCanvas } from '../../ui/ChartCanvas.jsx';
import { Select } from '../../ui/primitives.jsx';

export function AssetsSection({accounts, transactions, finMask={}, addAccount, deleteAccount, addSnapshot, deleteSnapshot}){
  const [newAccName,setNewAccName] = useState('');
  const [snapForms,setSnapForms] = useState({});
  const setField = (id,f,v) => setSnapForms(prev=>({...prev,[id]:{...prev[id],[f]:v}}));

  const allocation = useMemo(()=> accounts.map(a=>
    ({name:a.name, value: accountBalanceNow(a, transactions)})).filter(a=>a.value>0), [accounts, transactions]);

  const netWorthTrend = useMemo(()=>{
    const today = todayStr();
    // старт графика = самая ранняя дата среди замеров И операций (не только замеров),
    // чтобы линия двигалась от операций без необходимости делать повторный замер.
    let start = null;
    accounts.forEach(a=>a.snapshots.forEach(s=>{ if(!start||s.date<start) start=s.date; }));
    transactions.forEach(t=>{ if((!t.exclude||t.debtFlow) && (!start||t.date<start)) start=t.date; });
    if(!start) return [];
    const dateSet=new Set([today]);
    accounts.forEach(a=>a.snapshots.forEach(s=>dateSet.add(s.date)));
    transactions.forEach(t=>{ if((!t.exclude||t.debtFlow) && t.date>=start && t.date<=today) dateSet.add(t.date); });
    const dates=[...dateSet].filter(d=>d>=start && d<=today).sort();
    return dates.map(ds=>{
      const total = accounts.reduce((sum,a)=>sum+accountBalanceOn(a, transactions, ds),0) + unassignedNetOn(transactions, ds);
      return {date:ds.slice(5), total};
    });
  }, [accounts, transactions]);

  const accountTrends = useMemo(()=>{
    const minSnapshotDate = accounts.reduce((min,a)=>a.snapshots.reduce((m,s)=>!m||s.date<m?s.date:m, min), null);
    if(!minSnapshotDate) return {labels:[], datasets:[]};
    const dateSet=new Set([todayStr()]);
    accounts.forEach(a=>a.snapshots.forEach(s=>dateSet.add(s.date)));
    transactions.forEach(t=>{ if(t.accountId && t.date>=minSnapshotDate && t.date<=todayStr()) dateSet.add(t.date); });
    const dates=[...dateSet].filter(d=>d>=minSnapshotDate).sort();
    const datasets = accounts.map((a,i)=>({ label:a.name, data:dates.map(ds=>accountBalanceOn(a, transactions, ds)), borderColor:PIE_COLORS[i%PIE_COLORS.length], backgroundColor:'transparent', tension:.3 }));
    return { labels:dates.map(d=>d.slice(5)), datasets };
  }, [accounts, transactions]);

  return (
    <div>
      <div style={S.panel}>
        <div style={S.panelTitle}>Добавить счёт</div>
        <div style={S.inputRow}>
          <input style={S.input} placeholder="Название" value={newAccName} onChange={e=>setNewAccName(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter'&&newAccName.trim()){ addAccount(newAccName.trim()); setNewAccName(''); } }} />
          <button style={S.iconBtnAmber} onClick={()=>{ if(newAccName.trim()){ addAccount(newAccName.trim()); setNewAccName(''); } }}>+</button>
        </div>
        <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
          {DEFAULT_ACCOUNTS.filter(d=>!accounts.some(a=>a.name===d)).map(d=><div key={d} className="chip" style={{background:C.panelAlt,color:C.dim,borderColor:C.border}} onClick={()=>addAccount(d)}>+ {d}</div>)}
        </div>
      </div>

      {(allocation.length>0 || netWorthTrend.length>1) && (
        <div className="grid2" style={S.grid2}>
          {vis('assets.allocation') && (
          <div style={S.panel}>
            <div style={S.panelTitle}>Распределение</div>
            {allocation.length===0 ? <div style={S.emptyState}>Нет данных</div> :
              <ChartCanvas type="pie" data={{labels:allocation.map(a=>a.name), datasets:[{data:allocation.map(a=>a.value), backgroundColor:PIE_COLORS}]}} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:C.dim,font:{size:11}}}}}} height={200}/>}
          </div>
          )}
          {vis('assets.netWorth') && (
          <div style={S.panel}>
            <div style={S.panelTitle}>Чистые активы во времени</div>
            {netWorthTrend.length<2 ? <div style={S.emptyState}>Мало данных — добавь замер или операцию</div> :
              <ChartCanvas type="line" data={{labels:netWorthTrend.map(d=>d.date), datasets:[{data:netWorthTrend.map(d=>d.total), borderColor:C.cyan, backgroundColor:'transparent', tension:.3}]}} options={baseChartOpts()} height={200}/>}
          </div>
          )}
        </div>
      )}

      {vis('assets.accountTrends') && accountTrends.datasets.length>0 && accountTrends.labels.length>1 && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Баланс по счетам во времени</div>
          <ChartCanvas type="line" data={accountTrends} options={baseChartOpts({plugins:{legend:{display:true, labels:{color:C.dim,font:{size:10}}}}})} height={240} />
        </div>
      )}

      {accounts.map(a=>{
        const f = snapForms[a.id] || {amount:'',currency:'RUB',rate:'',date:todayStr()};
        return (
          <div key={a.id} style={S.panel}>
            <div style={{display:'flex',alignItems:'center'}}>
              <div style={{...S.panelTitle,flex:1,marginBottom:0}}>{a.name}</div>
              <button className="icon-btn" onClick={()=>deleteAccount(a.id)}>✕</button>
            </div>
            <div style={{...S.inputRow,marginTop:10}}>
              <input style={{...S.input,maxWidth:100}} type="number" placeholder="сумма" value={f.amount} onChange={e=>setField(a.id,'amount',e.target.value)} />
              <Select small style={{minWidth:70}} value={f.currency} onChange={v=>setField(a.id,'currency',v)} options={[{value:'RUB',label:'₽'},{value:'USD',label:'$'}]} />
              {f.currency==='USD' && <input style={{...S.input,maxWidth:80}} type="number" placeholder="курс" value={f.rate} onChange={e=>setField(a.id,'rate',e.target.value)} />}
              <input style={{...S.input,maxWidth:130}} type="date" value={f.date} onChange={e=>setField(a.id,'date',e.target.value)} onClick={openDatePicker} />
              <button style={S.iconBtnAmber} onClick={()=>{ const amount=parseFloat(f.amount); if(isNaN(amount)) return;
                addSnapshot(a.id,{date:f.date||todayStr(), amount, currency:f.currency, rate:f.rate?parseFloat(f.rate):undefined}); setField(a.id,'amount',''); }}>+</button>
            </div>
            {a.snapshots.slice(0,5).map(s=>(
              <div key={s.id} className="row-hover" style={S.taskRow}>
                <div style={{width:70,fontSize:12,color:C.dim,fontFamily:"'JetBrains Mono',monospace"}}>{s.date.slice(5)}</div>
                <div style={{flex:1,fontSize:13}}>{finMask.net ? '••••••' : (s.currency==='USD'?`$${s.amount} (курс ${s.rate})`:fmtMoney(s.amount))}</div>
                <button className="icon-btn" onClick={()=>deleteSnapshot(a.id,s.id)}>✕</button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
