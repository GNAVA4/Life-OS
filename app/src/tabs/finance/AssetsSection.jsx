// Финансы → Счета: счета, замеры баланса, распределение и чистые активы во времени.
// Вынесено из FinanceTab.jsx (session 036). Редизайн «Тихий» — session 043 (Э6в): итог и график сверху,
// у счёта — текущий баланс и «Замер» (форма с валютой/курсом/датой), история замеров, удаление.
import { useMemo, useState } from 'react';
import { baseChartOpts } from '../../lib/charts.js';
import { DEFAULT_ACCOUNTS } from '../../lib/constants.js';
import { openDatePicker, todayStr } from '../../lib/dates.js';
import { accountBalanceNow, accountBalanceOn, unassignedNetOn } from '../../lib/finance.js';
import { fmtMoney, maskMoney } from '../../lib/format.js';
import { vis } from '../../lib/storage.js';
import { S } from '../../lib/styles.js';
import { C, PIE_COLORS, tint } from '../../lib/theme.js';
import { ChartCanvas } from '../../ui/ChartCanvas.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { ConfirmIconBtn, Select } from '../../ui/primitives.jsx';

export function AssetsSection({accounts, transactions, finMask={}, netWorth=0, addAccount, deleteAccount, addSnapshot, deleteSnapshot}){
  const mn = n => maskMoney(finMask.net, n);
  const [newAccName,setNewAccName] = useState('');
  const [addOpen,setAddOpen] = useState(false);
  const [openId,setOpenId] = useState(null);
  const [snapForms,setSnapForms] = useState({});
  const setField = (id,f,v) => setSnapForms(prev=>({...prev,[id]:{...prev[id],[f]:v}}));
  const today = todayStr();

  const balances = useMemo(()=> accounts.map(a=>({a, bal:accountBalanceNow(a, transactions)})), [accounts, transactions]);
  const unassigned = useMemo(()=> unassignedNetOn(transactions, today), [transactions, today]);
  const allocation = useMemo(()=> balances.filter(x=>x.bal>0).map(x=>({name:x.a.name, value:x.bal})), [balances]);

  const netWorthTrend = useMemo(()=>{
    // старт графика = самая ранняя дата среди замеров И операций (не только замеров)
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
  }, [accounts, transactions, today]);
  const monthAgo = (() => { if(netWorthTrend.length<2) return null; const d=new Date(today+'T00:00:00'); d.setMonth(d.getMonth()-1);
    const md = `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const past = [...netWorthTrend].reverse().find(p=>p.date<=md); return past ? netWorth - past.total : null; })();

  const accountTrends = useMemo(()=>{
    const minSnapshotDate = accounts.reduce((min,a)=>a.snapshots.reduce((m,s)=>!m||s.date<m?s.date:m, min), null);
    if(!minSnapshotDate) return {labels:[], datasets:[]};
    const dateSet=new Set([today]);
    accounts.forEach(a=>a.snapshots.forEach(s=>dateSet.add(s.date)));
    transactions.forEach(t=>{ if(t.accountId && t.date>=minSnapshotDate && t.date<=today) dateSet.add(t.date); });
    const dates=[...dateSet].filter(d=>d>=minSnapshotDate).sort();
    const datasets = accounts.map((a,i)=>({ label:a.name, data:dates.map(ds=>accountBalanceOn(a, transactions, ds)), borderColor:PIE_COLORS[i%PIE_COLORS.length], backgroundColor:'transparent', tension:.3, pointRadius:0, borderWidth:2 }));
    return { labels:dates.map(d=>d.slice(5)), datasets };
  }, [accounts, transactions, today]);

  const lineOpts = baseChartOpts({plugins:{legend:{display:false},tooltip:{enabled:!finMask.net}},
    scales:{x:{ticks:{color:C.dim,font:{size:10},maxTicksLimit:6,maxRotation:0},grid:{display:false}}, y:{ticks:{color:C.dim,font:{size:10},display:!finMask.net},grid:{color:C.border}}}});

  return (
    <div>
      {vis('assets.netWorth') && (
        <div style={{...S.plate,marginBottom:20,display:'flex',flexDirection:'column',gap:4}}>
          <span style={{fontSize:12.5,color:C.dim}}>Чистые активы</span>
          <span style={{fontSize:26,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{mn(netWorth)}</span>
          {monthAgo!=null && !finMask.net && <span style={{fontSize:12,color:monthAgo>=0?C.green:C.red}}>{monthAgo>=0?'+':'−'}{fmtMoney(Math.abs(monthAgo))} за месяц</span>}
          {netWorthTrend.length<2 ? <span style={{fontSize:12,color:C.dim,marginTop:6}}>График появится, когда будет хотя бы два замера или операции.</span> :
            <div style={{marginTop:8}}><ChartCanvas type="line" data={{labels:netWorthTrend.map(d=>d.date), datasets:[{data:netWorthTrend.map(d=>d.total), borderColor:C.green, backgroundColor:tint(C.green,.12), fill:true, tension:.3, pointRadius:0, borderWidth:2}]}} options={lineOpts} height={130}/></div>}
        </div>
      )}

      <div style={S.panel}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
          <div style={{...S.panelTitle,marginBottom:0}}>Счета</div>
          <button style={{background:'none',border:'none',color:addOpen?C.amber:C.dim,fontSize:12.5,cursor:'pointer',fontFamily:'inherit',display:'inline-flex',gap:4,alignItems:'center'}} onClick={()=>setAddOpen(o=>!o)}><Icon name="plus" size={14}/>Счёт</button>
        </div>
        {addOpen && (
          <div style={{display:'flex',flexDirection:'column',gap:8,margin:'8px 0 6px'}}>
            <div style={{display:'flex',gap:8}}>
              <input autoFocus style={S.input} placeholder="Название счёта" value={newAccName} aria-label="Название счёта" onChange={e=>setNewAccName(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'&&newAccName.trim()){ addAccount(newAccName.trim()); setNewAccName(''); setAddOpen(false); } }} />
              <button style={S.iconBtnAmber} aria-label="Добавить счёт" onClick={()=>{ if(newAccName.trim()){ addAccount(newAccName.trim()); setNewAccName(''); setAddOpen(false); } }}><Icon name="plus" size={18}/></button>
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {DEFAULT_ACCOUNTS.filter(d=>!accounts.some(a=>a.name===d)).map(d=><button key={d} className="chip" style={{fontFamily:'inherit',background:C.panelAlt,color:C.dim}} onClick={()=>{ addAccount(d); setAddOpen(false); }}>+ {d}</button>)}
            </div>
          </div>
        )}
        {accounts.length===0 && !addOpen && <div style={S.emptyState}>Счетов нет. Добавь карту или наличные и запиши их баланс — дальше он будет считаться по операциям.</div>}
        {balances.map(({a,bal})=>{
          const f = snapForms[a.id] || {amount:'',currency:'RUB',rate:'',date:today};
          const last = a.snapshots[0]; const open = openId===a.id;
          return (
            <div key={a.id} style={{borderBottom:`1px solid ${C.border}`}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 0'}}>
                <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:2}}>
                  <span style={{fontSize:14.5}}>{a.name}</span>
                  <span style={{fontSize:12,color:C.dim}}>{last?`замер ${last.date.slice(8,10)}.${last.date.slice(5,7)}${last.currency==='USD'&&!finMask.net?` · $${last.amount} × ${last.rate}`:''}`:'замеров нет'}</span>
                </div>
                <span style={{fontVariantNumeric:'tabular-nums',fontWeight:600}}>{mn(bal)}</span>
                <button style={{...S.btnGhost,color:open?C.amber:C.text}} onClick={()=>setOpenId(open?null:a.id)} aria-expanded={open}>Замер</button>
              </div>
              {open && (
                <div className="anim-collapse" style={{display:'flex',flexDirection:'column',gap:8,paddingBottom:12}}>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <input style={{...S.input,flex:'1 1 110px'}} inputMode="decimal" placeholder="Сумма на счёте" value={f.amount} aria-label="Сумма на счёте" onChange={e=>setField(a.id,'amount',e.target.value)} />
                    <Select small style={{width:70}} value={f.currency} onChange={v=>setField(a.id,'currency',v)} options={[{value:'RUB',label:'₽'},{value:'USD',label:'$'}]} />
                    {f.currency==='USD' && <input style={{...S.input,flex:'0 1 90px'}} inputMode="decimal" placeholder="Курс" value={f.rate} aria-label="Курс" onChange={e=>setField(a.id,'rate',e.target.value)} />}
                    <input style={{...S.input,flex:'0 1 140px',padding:'6px 9px',fontSize:12.5}} type="date" value={f.date} aria-label="Дата замера" onChange={e=>setField(a.id,'date',e.target.value)} onClick={openDatePicker} />
                    <button style={S.btnPrimary} onClick={()=>{ const amount=parseFloat(String(f.amount).replace(',','.')); if(isNaN(amount)) return;
                      addSnapshot(a.id,{date:f.date||today, amount, currency:f.currency, rate:f.rate?parseFloat(String(f.rate).replace(',','.')):undefined}); setField(a.id,'amount',''); }}>Записать</button>
                  </div>
                  <span style={{fontSize:12,color:C.dim}}>Замер — фактическая сумма на счёте на дату. Дальше баланс считается от него по операциям.</span>
                  {a.snapshots.slice(0,5).map(s=>(
                    <div key={s.id} style={{display:'flex',alignItems:'center',gap:10,fontSize:13}}>
                      <span style={{width:52,color:C.dim,fontVariantNumeric:'tabular-nums'}}>{s.date.slice(8,10)}.{s.date.slice(5,7)}</span>
                      <span style={{flex:1}}>{finMask.net ? '••••••' : (s.currency==='USD'?`$${s.amount} (курс ${s.rate})`:fmtMoney(s.amount))}</span>
                      <ConfirmIconBtn onConfirm={()=>deleteSnapshot(a.id,s.id)} title="удалить замер" confirmLabel="удалить?" />
                    </div>))}
                  <div style={{alignSelf:'flex-start'}}><ConfirmIconBtn onConfirm={()=>{ setOpenId(null); deleteAccount(a.id); }} icon={<span style={{...S.btnGhost,color:C.red,borderColor:tint(C.red,.35)}}><Icon name="trash" size={14}/>Удалить счёт</span>} confirmLabel="удалить счёт?" title="удалить счёт" /></div>
                </div>
              )}
            </div>
          );
        })}
        {unassigned!==0 && accounts.length>0 && (
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 0'}}>
            <div style={{flex:1,display:'flex',flexDirection:'column',gap:2}}><span style={{fontSize:14.5,color:C.dim}}>Не распределено</span><span style={{fontSize:12,color:C.dim}}>операции без счёта</span></div>
            <span style={{fontVariantNumeric:'tabular-nums',fontWeight:600,color:C.dim}}>{mn(unassigned)}</span>
          </div>
        )}
      </div>

      {vis('assets.allocation') && allocation.length>0 && (() => { const total=allocation.reduce((s,a)=>s+a.value,0); return (
        <div style={S.panel}>
          <div style={S.panelTitle}>Распределение</div>
          <div style={{display:'flex',height:10,borderRadius:6,overflow:'hidden',gap:2,marginBottom:10}}>
            {allocation.map((a,i)=><i key={a.name} title={a.name} style={{flex:a.value,background:PIE_COLORS[i%PIE_COLORS.length]}}/>)}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'6px 16px'}}>
            {allocation.map((a,i)=>(
              <div key={a.name} style={{display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                <span style={{width:9,height:9,borderRadius:3,background:PIE_COLORS[i%PIE_COLORS.length],flex:'none'}}/>
                <span style={{flex:1,minWidth:0,color:C.dim,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</span>
                <span style={{fontVariantNumeric:'tabular-nums'}}>{Math.round(a.value/total*100)}%</span>
              </div>))}
          </div>
        </div>); })()}

      {vis('assets.accountTrends') && accountTrends.datasets.length>0 && accountTrends.labels.length>1 && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Баланс по счетам во времени</div>
          <ChartCanvas type="line" data={accountTrends} options={baseChartOpts({...lineOpts, plugins:{legend:{display:true,position:'bottom',labels:{color:C.dim,font:{size:11},boxWidth:10,boxHeight:10}},tooltip:{enabled:!finMask.net}}})} height={220} />
        </div>
      )}
    </div>
  );
}
