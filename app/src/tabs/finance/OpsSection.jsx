// Финансы → Операции: транзакции, категории, планы, регулярные платежи, графики, бюджет-алерты,
// «свободно на сегодня», помесячный просмотр. Вынесено из FinanceTab.jsx (session 036).
import { useMemo, useState } from 'react';
import { baseChartOpts } from '../../lib/charts.js';
import { monthLabelRu, openDatePicker, shiftMonth, todayStr } from '../../lib/dates.js';
import { maskMoney } from '../../lib/format.js';
import { vis } from '../../lib/storage.js';
import { S } from '../../lib/styles.js';
import { C, PIE_COLORS } from '../../lib/theme.js';
import { ChartCanvas } from '../../ui/ChartCanvas.jsx';
import { Select } from '../../ui/primitives.jsx';
import { PlanPanel } from './PlanPanel.jsx';

export function OpsSection({finance, categories, budgets, incomePlans, bills, monthTx, defaults={}, finMask={}, addTransaction, deleteTransaction, addCategory, removeCategory, setBudget, removeBudget, setIncomePlan, removeIncomePlan, setBudgetsBatch, setIncomePlansBatch, addBill, deleteBill, updateBill, collapse={}, toggleCollapse, dismissedAlerts={}, dismissAlert}){
  const mo = n => maskMoney(finMask.ops, n);   // приватность: скрытие сумм операций
  const [planOpen,setPlanOpen] = useState(false);
  const [planKind,setPlanKind] = useState('expense'); // переключатель внутри плашки планов (session 020)
  // категория по умолчанию: из настроек, если валидна, иначе первая в списке
  const defExpenseCat = categories.expense.includes(defaults.expenseCat) ? defaults.expenseCat : categories.expense[0];
  const defIncomeCat = categories.income.includes(defaults.incomeCat) ? defaults.incomeCat : categories.income[0];
  const defAccount = finance.accounts.some(a=>a.id===defaults.account) ? defaults.account : '';
  const [txAmount,setTxAmount] = useState(''); const [txType,setTxType] = useState('expense');
  const [txCat,setTxCat] = useState(defExpenseCat); const [txNote,setTxNote] = useState('');
  const [txDate,setTxDate] = useState(todayStr()); const [txExclude,setTxExclude] = useState(false);
  const [txAccountId,setTxAccountId] = useState(defAccount);
  const [newCat,setNewCat] = useState(''); const [showCatManager,setShowCatManager] = useState(false);
  const [catKind,setCatKind] = useState('expense');
  const [billName,setBillName] = useState(''); const [billAmount,setBillAmount] = useState(''); const [billDay,setBillDay] = useState('');
  const [opsCat,setOpsCat] = useState('');        // фильтр списка операций по категории (session: ops-filter-group)
  const [opsGroup,setOpsGroup] = useState(false); // группировка списка операций по дням
  const [opsExcludeOnly,setOpsExcludeOnly] = useState(false); // показать только «не считаемые» операции
  const cats = txType==='expense' ? categories.expense : categories.income;
  const managedCats = catKind==='expense' ? categories.expense : categories.income;
  const accountName = (id) => finance.accounts.find(a=>a.id===id)?.name;

  const submit = () => { const amount=parseFloat(txAmount); if(isNaN(amount)||amount<=0) return;
    addTransaction({type:txType, amount, category:txCat, note:txNote.trim(), exclude:txExclude, date:txDate, accountId:txAccountId||null});
    setTxAmount(''); setTxNote(''); setTxExclude(false); };

  // Выбранный месяц просмотра (операции/графики/планы) — можно листать историю. session 032
  const [viewMonth,setViewMonth] = useState(todayStr().slice(0,7));
  const viewTx = useMemo(()=> finance.transactions.filter(t=>!t.debtFlow && t.date.slice(0,7)===viewMonth), [finance.transactions, viewMonth]);
  // круговые диаграммы — по ВЫБРАННОМУ месяцу
  const viewExpenseByCat = useMemo(()=>{ const m={}; viewTx.filter(t=>t.type==='expense'&&!t.exclude).forEach(t=>{ m[t.category]=(m[t.category]||0)+t.amount; }); return m; }, [viewTx]);
  const viewIncomeByCat  = useMemo(()=>{ const m={}; viewTx.filter(t=>t.type==='income'&&!t.exclude).forEach(t=>{ m[t.category]=(m[t.category]||0)+t.amount; }); return m; }, [viewTx]);
  const pieData = { labels:Object.keys(viewExpenseByCat), datasets:[{data:Object.values(viewExpenseByCat), backgroundColor:PIE_COLORS}] };
  const incomePieData = { labels:Object.keys(viewIncomeByCat), datasets:[{data:Object.values(viewIncomeByCat), backgroundColor:PIE_COLORS}] };
  // бюджет-алерты — по ТЕКУЩЕМУ месяцу (прогноз до конца месяца), не зависят от viewMonth
  const expenseByCat = useMemo(()=>{ const map={}; monthTx.filter(t=>t.type==='expense'&&!t.exclude).forEach(t=>{ map[t.category]=(map[t.category]||0)+t.amount; }); return map; }, [monthTx]);
  const expenseCountByCat = useMemo(()=>{ const m={}; monthTx.filter(t=>t.type==='expense'&&!t.exclude).forEach(t=>{ m[t.category]=(m[t.category]||0)+1; }); return m; }, [monthTx]);

  // помесячные планы: план vs факт по ВЫБРАННОМУ месяцу
  const planTx = useMemo(()=> viewTx.filter(t=>!t.exclude), [viewTx]);
  const planExpenseByCat = useMemo(()=>{ const m={}; planTx.filter(t=>t.type==='expense').forEach(t=>{ m[t.category]=(m[t.category]||0)+t.amount; }); return m; }, [planTx]);
  const planIncomeByCat  = useMemo(()=>{ const m={}; planTx.filter(t=>t.type==='income').forEach(t=>{ m[t.category]=(m[t.category]||0)+t.amount; }); return m; }, [planTx]);
  const monthBudgets = budgets[viewMonth]||{};
  const monthIncomePlans = incomePlans[viewMonth]||{};
  // 💸 «Свободно на сегодня»: (план месяца − потрачено) / оставшиеся дни. session 025.
  const safeToSpend = useMemo(()=>{
    const ym = todayStr().slice(0,7);
    const plan = Object.values(budgets[ym]||{}).reduce((s,v)=>s+(v||0),0);
    if(plan<=0) return null;
    const spent = monthTx.filter(t=>t.type==='expense'&&!t.exclude).reduce((s,t)=>s+t.amount,0);
    const [y,mm] = ym.split('-').map(Number);
    const daysInMonth = new Date(y,mm,0).getDate();
    const dayNum = Number(todayStr().slice(8,10)); // логический день (не new Date()) — иначе рассинхрон в окне до 9 утра. session 032
    const remainingDays = Math.max(1, daysInMonth - dayNum + 1);
    const remaining = plan - spent;
    const perDay = remaining/remainingDays;
    const spentToday = monthTx.filter(t=>t.type==='expense'&&!t.exclude&&t.date===todayStr()).reduce((s,t)=>s+t.amount,0);
    return {plan, spent, remaining, perDay:Math.round(perDay), remainingDays, spentToday, leftToday:Math.round(perDay-spentToday)};
  }, [budgets, monthTx]);
  const monthSwitcher = (
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <button style={S.navArrow} onClick={()=>setViewMonth(shiftMonth(viewMonth,-1))}>◀</button>
      <span style={{fontSize:12,color:C.dim,minWidth:120,textAlign:'center',textTransform:'capitalize'}}>{monthLabelRu(viewMonth)}</span>
      <button style={S.navArrow} onClick={()=>setViewMonth(shiftMonth(viewMonth,1))} disabled={viewMonth>=todayStr().slice(0,7)} title="следующий месяц">▶</button>
    </div>
  );

  // бюджет-алерты + прогноз к концу месяца (текущий месяц). session 015; уточнено 016/017.
  // Прогноз = run-rate: факт/деньМесяца*днейВМесяце — честен ТОЛЬКО для частых трат.
  //   Для категорий с ≤5 операциями (разовые: транспорт-абонемент, аренда) НЕ экстраполируем (sparse). [user, 017]
  // Алерт показываем ТОЛЬКО если ФАКТ по категории ≥25% всех планируемых расходов месяца —
  //   т.е. категория реально «весит» в бюджете. Мелкая трата (транспорт 2к из 30к плана) на 100%
  //   своего плана — бесполезный шум, не показываем. Фильтр по ФАКТУ, не по плану. [user, 017]
  const MIN_TX_FOR_FORECAST = 6;      // >5 операций → строим прогноз
  const MIN_SHARE_FOR_ALERT = 0.25;   // факт категории ≥25% от общих планируемых расходов
  const budgetAlerts = useMemo(()=>{
    const cur = todayStr().slice(0,7);
    const b = budgets[cur]||{};
    const totalPlan = Object.values(b).reduce((s,v)=>s+(v>0?v:0),0);
    if(totalPlan<=0) return [];
    const [Y,M,D] = todayStr().split('-').map(Number);
    const daysInMonth = new Date(Y, M, 0).getDate();  // M 1-based → последний день месяца M
    const rows=[];
    Object.keys(b).forEach(c=>{ const plan=b[c]; if(!plan||plan<=0) return;
      const spent=expenseByCat[c]||0;
      if(spent/totalPlan < MIN_SHARE_FOR_ALERT) return;   // факт мелкий на фоне бюджета — не шумим
      const ratio=spent/plan; const cnt=expenseCountByCat[c]||0;
      const sparse = cnt < MIN_TX_FOR_FORECAST;
      const projected = (sparse || D<=0) ? spent : Math.round(spent/D*daysInMonth);
      if(ratio>=0.8) rows.push({cat:c, spent, plan, ratio, projected, over:spent>plan, sparse, cnt});
    });
    return rows.sort((a,b)=>b.ratio-a.ratio);
  }, [budgets, expenseByCat, expenseCountByCat]);

  // расходы по каждому дню ВЫБРАННОГО месяца (гистограмма, НЕ накопительно). session 015; помесячно session 032.
  const dailyExpense = useMemo(()=>{
    const byDate={};
    viewTx.forEach(t=>{ if(!t.exclude && t.type==='expense') byDate[t.date]=(byDate[t.date]||0)+t.amount; });
    const [y,m]=viewMonth.split('-').map(Number); const dim=new Date(y,m,0).getDate();
    const labels=[], data=[];
    for(let d=1; d<=dim; d++){ const ds=`${viewMonth}-${String(d).padStart(2,'0')}`; labels.push(String(d)); data.push(byDate[ds]||0); }
    return {labels, data};
  }, [viewTx, viewMonth]);

  // список операций: фильтр по категории + опциональная группировка по дням (session: ops-filter-group)
  // debtFlow (движения долгов) не показываем среди операций — у них своя вкладка «Долги».
  const opsCats = useMemo(()=>{ const set=new Set(); finance.transactions.forEach(t=>{ if(!t.debtFlow) set.add(t.category); }); return [...set].sort(); }, [finance.transactions]);
  const filteredTx = useMemo(()=> finance.transactions.filter(t=> !t.debtFlow && t.date.slice(0,7)===viewMonth && (!opsCat || t.category===opsCat) && (!opsExcludeOnly || t.exclude)), [finance.transactions, viewMonth, opsCat, opsExcludeOnly]);
  const groupedTx = useMemo(()=>{
    const map={}; filteredTx.slice(0,120).forEach(t=>{ (map[t.date]=map[t.date]||[]).push(t); });
    return Object.keys(map).sort((a,b)=>b<a?-1:1).map(date=>{ const rows=map[date];
      const inc=rows.filter(t=>t.type==='income'&&!t.exclude).reduce((s,t)=>s+t.amount,0);
      const exp=rows.filter(t=>t.type==='expense'&&!t.exclude).reduce((s,t)=>s+t.amount,0);
      return {date, rows, inc, exp}; });
  }, [filteredTx]);
  const txRow = (t) => (
    <div key={t.id} className="row-hover" style={S.taskRow}>
      <div style={{width:8,height:8,borderRadius:4,background:t.type==='income'?C.green:C.red}} />
      <div style={{width:60,fontSize:12,color:C.dim,fontFamily:"'JetBrains Mono',monospace"}}>{t.date.slice(5)}</div>
      <div style={{flex:1,fontSize:13.5}}>{t.category}{t.accountId?` · ${accountName(t.accountId)||'?'}`:''}{t.note?` · ${t.note}`:''}{t.exclude?<span style={{...S.dimSpan,marginLeft:4}}>(не считается)</span>:null}</div>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:t.type==='income'?C.green:C.red}}>{t.type==='income'?'+':'−'}{mo(t.amount)}</div>
      <button className="icon-btn" onClick={()=>deleteTransaction(t.id)}>✕</button>
    </div>
  );

  return (
    <div>
      <div style={{...S.panel, display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
        <div style={{fontSize:12.5,color:C.dim}}>📅 Месяц просмотра (операции, графики, планы){viewMonth!==todayStr().slice(0,7) && <span style={{color:C.amber}}> · не текущий</span>}</div>
        {monthSwitcher}
      </div>
      <div style={S.panel}>
        <div style={S.panelTitle}>Новая операция</div>
        <div style={S.inputRow}>
          <Select style={{minWidth:110}} value={txType} onChange={v=>{ setTxType(v); setTxCat(v==='expense'?defExpenseCat:defIncomeCat); }}
            options={[{value:'expense',label:'Расход'},{value:'income',label:'Доход'}]} />
          <input style={{...S.input,maxWidth:100}} type="number" placeholder="сумма" value={txAmount} onChange={e=>setTxAmount(e.target.value)} />
          <Select style={{minWidth:130,flex:1}} value={txCat} onChange={setTxCat} options={cats} />
          <Select style={{minWidth:130,flex:1}} value={txAccountId} onChange={setTxAccountId}
            options={[{value:'',label:'— без счёта —'}, ...finance.accounts.map(a=>({value:a.id,label:a.name}))]} />
          <input style={{...S.input,maxWidth:130}} type="date" value={txDate} onChange={e=>setTxDate(e.target.value)} onClick={openDatePicker} />
          <input style={S.input} placeholder="комментарий" value={txNote} onChange={e=>setTxNote(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />
          <label style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:C.dim,whiteSpace:'nowrap'}}><input type="checkbox" checked={txExclude} onChange={e=>setTxExclude(e.target.checked)} />не считать</label>
          <button style={S.iconBtnAmber} onClick={submit}>+</button>
        </div>
        <div style={{marginTop:8}}>
          <span style={{fontSize:11.5,color:C.cyan,cursor:'pointer'}} onClick={()=>setShowCatManager(!showCatManager)}>{showCatManager?'скрыть категории':'управление категориями'}</span>
        </div>
        {showCatManager && (
          <div style={{marginTop:10}}>
            <div style={{display:'flex',gap:6,marginBottom:8}}>
              {[{id:'expense',label:'Расходы'},{id:'income',label:'Доходы'}].map(({id,label})=>(
                <div key={id} className="chip" onClick={()=>setCatKind(id)} style={{background:catKind===id?C.amber:C.panelAlt,color:catKind===id?'#1A1200':C.dim,borderColor:catKind===id?C.amber:C.border}}>{label}</div>
              ))}
            </div>
            <div style={S.inputRow}>
              <input style={S.input} placeholder="новая категория" value={newCat} onChange={e=>setNewCat(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'&&newCat.trim()){ addCategory(catKind,newCat.trim()); setNewCat(''); } }} />
              <button style={S.iconBtnAmber} onClick={()=>{ if(newCat.trim()){ addCategory(catKind,newCat.trim()); setNewCat(''); } }}>+</button>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:8}}>
              {managedCats.map(c=>(
                <div key={c} className="chip" style={{background:C.panelAlt,color:C.dim,borderColor:C.border,display:'flex',gap:6,alignItems:'center'}}>
                  {c}
                  <span style={{cursor:'pointer'}} onClick={()=>removeCategory(catKind,c)}>✕</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {vis('ops.safeToSpend') && safeToSpend && (() => {
        const st = safeToSpend; const over = st.leftToday<0; const col = over?C.red:(st.leftToday< st.perDay*0.3?C.amber:C.green);
        return (
        <div style={{...S.panel, borderColor:col}}>
          <div style={{...S.panelTitle, color:col}}>💸 Свободно на сегодня</div>
          <div style={{display:'flex',alignItems:'baseline',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:26,fontWeight:800,color:col,fontFamily:"'JetBrains Mono',monospace"}}>{over?'−':''}{mo(Math.abs(st.leftToday))}</span>
            <span style={{fontSize:12,color:C.dim}}>{over?'превышен дневной лимит':'ещё можно потратить сегодня'}</span>
          </div>
          <div style={{fontSize:11,color:C.dim,marginTop:6,lineHeight:1.5}}>
            дневной лимит ~{mo(st.perDay)} · потрачено сегодня {mo(st.spentToday)}<br/>
            в месяце осталось {mo(st.remaining)} на {st.remainingDays} дн. (план {mo(st.plan)}, потрачено {mo(st.spent)})
          </div>
        </div>
        );
      })()}

      {(() => {
        if(!vis('ops.budgetAlerts')) return null;
        const ym = todayStr().slice(0,7);
        const visibleAlerts = budgetAlerts.filter(a=>!dismissedAlerts[ym+'_'+a.cat]);
        if(!visibleAlerts.length) return null;
        const isC = !!(collapse.ui && collapse.ui.alerts);
        return (
        <div style={{...S.panel, borderColor:C.amber}}>
          <div style={{...S.panelTitle, color:C.amber, cursor:'pointer', display:'flex', alignItems:'center', marginBottom:isC?0:10}} onClick={()=>toggleCollapse && toggleCollapse('ui','alerts')}>
            <span style={{marginRight:6}}>{isC?'▶':'▼'}</span>⚠ Бюджет-алерты · {ym} <span style={S.dimSpan}>{visibleAlerts.length}</span>
          </div>
          {!isC && visibleAlerts.map(a=>(
            <div key={a.cat} style={{marginBottom:9}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12.5,marginBottom:3,gap:8,alignItems:'center'}}>
                <span style={{minWidth:0,overflowWrap:'anywhere',flex:1}}>{a.over?'🔴':'🟡'} {a.cat}</span>
                <span style={{color:C.dim,fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>{mo(a.spent)} / {mo(a.plan)} · {Math.round(a.ratio*100)}%</span>
                <button className="icon-btn" title="скрыть этот алерт" style={{flexShrink:0}} onClick={()=>dismissAlert && dismissAlert(ym+'_'+a.cat)}>✕</button>
              </div>
              <div style={{height:4,background:C.panelAlt,borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,a.ratio*100)}%`,background:a.over?C.red:C.amber}}/></div>
              <div style={{fontSize:10.5,color:(!a.sparse && a.projected>a.plan)?C.red:C.dim,marginTop:3}}>
                {a.sparse
                  ? `прогноз: ${mo(a.projected)} — разовые траты (${a.cnt} оп.), без экстраполяции`
                  : `прогноз к концу месяца: ${mo(a.projected)}${a.projected>a.plan?` · превышение на ${mo(a.projected-a.plan)}`:''}`}
              </div>
            </div>
          ))}
        </div>
        );
      })()}

      {(() => {
        // Единая плашка планов с переключателем Расходы/Доходы прямо в заголовке (session 020).
        // Больше НЕ зависит от типа новой операции — своё независимое переключение.
        const showExp = vis('ops.planExpense'), showInc = vis('ops.planIncome');
        if(!showExp && !showInc) return null;
        const effKind = (planKind==='income' && showInc) ? 'income' : (showExp ? 'expense' : 'income');
        const isExp = effKind==='expense';
        const kindToggle = (
          <div style={{display:'flex',gap:6}}>
            {showExp && <div className="chip" onClick={(e)=>{e.stopPropagation(); setPlanKind('expense');}} style={{background:isExp?C.amber:C.panelAlt,color:isExp?'#1A1200':C.dim,borderColor:isExp?C.amber:C.border,padding:'3px 10px',fontSize:11}}>Расходы</div>}
            {showInc && <div className="chip" onClick={(e)=>{e.stopPropagation(); setPlanKind('income');}} style={{background:!isExp?C.amber:C.panelAlt,color:!isExp?'#1A1200':C.dim,borderColor:!isExp?C.amber:C.border,padding:'3px 10px',fontSize:11}}>Доходы</div>}
          </div>
        );
        return (
          <PlanPanel title="Планируемые" kindToggle={kindToggle} open={planOpen} setOpen={setPlanOpen} planSwitcher={monthSwitcher} resetKey={viewMonth+'_'+effKind} mask={finMask.ops}
            categories={isExp?categories.expense:categories.income}
            actualByCat={isExp?planExpenseByCat:planIncomeByCat}
            plans={isExp?monthBudgets:monthIncomePlans}
            onSaveBatch={patch=> isExp?setBudgetsBatch(viewMonth,patch):setIncomePlansBatch(viewMonth,patch)}
            onRemove={c=> isExp?removeBudget(viewMonth,c):removeIncomePlan(viewMonth,c)}
            barColor={isExp?C.green:C.cyan} spentWord={isExp?'потрачено':'получено'} />
        );
      })()}

      {vis('ops.bills') && (
      <div style={S.panel}>
        <div style={S.panelTitle}>Регулярные платежи</div>
        <div style={S.inputRow}>
          <input style={S.input} placeholder="Название" value={billName} onChange={e=>setBillName(e.target.value)} />
          <input style={{...S.input,maxWidth:100}} type="number" placeholder="сумма" value={billAmount} onChange={e=>setBillAmount(e.target.value)} />
          <input style={{...S.input,maxWidth:80}} type="number" min="1" max="31" placeholder="день" value={billDay} onChange={e=>setBillDay(e.target.value)} />
          <button style={S.iconBtnAmber} onClick={()=>{ const a=parseFloat(billAmount), d=parseInt(billDay,10); if(billName.trim()&&!isNaN(a)&&!isNaN(d)){ addBill(billName.trim(),a,d); setBillName(''); setBillAmount(''); setBillDay(''); } }}>+</button>
        </div>
        {bills.map(b=>(
          <div key={b.id} className="row-hover" style={S.taskRow}>
            <div style={{flex:1,fontSize:13}}>{b.name} · {b.dayOfMonth} числа</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12.5}}>{mo(b.amount)}</div>
            <button className="icon-btn" title={b.notify?'напоминание включено — выключить':'напоминать об этом платеже'}
              style={{color:b.notify?C.amber:C.dim}} onClick={()=>updateBill && updateBill(b.id,{notify:!b.notify})}>{b.notify?'🔔':'🔕'}</button>
            <button className="icon-btn" onClick={()=>deleteBill(b.id)}>✕</button>
          </div>
        ))}
        <div style={{...S.dimSpan,marginLeft:0,marginTop:8,display:'block',fontSize:11}}>🔔 — напоминать об этом платеже ежемесячно. Включить/настроить время: Настройки → «Уведомления и звук» → «Регулярные платежи».</div>
      </div>
      )}

      <div className="grid2" style={S.grid2}>
        {vis('ops.expensePie') && (
        <div style={S.panel}>
          <div style={{...S.panelTitle,textTransform:'capitalize'}}>Расходы по категориям · {monthLabelRu(viewMonth)}</div>
          {Object.keys(viewExpenseByCat).length===0 ? <div style={S.emptyState}>Нет расходов за месяц</div> :
            <ChartCanvas type="pie" data={pieData} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:C.dim,font:{size:11}}}}}} height={220} />}
        </div>
        )}
        {vis('ops.incomePie') && (
        <div style={S.panel}>
          <div style={{...S.panelTitle,textTransform:'capitalize'}}>Доходы по категориям · {monthLabelRu(viewMonth)}</div>
          {Object.keys(viewIncomeByCat).length===0 ? <div style={S.emptyState}>Нет доходов за месяц</div> :
            <ChartCanvas type="pie" data={incomePieData} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:C.dim,font:{size:11}}}}}} height={220} />}
        </div>
        )}
      </div>
      {vis('ops.expenseDaily') && (
      <div style={S.panel}>
        <div style={{...S.panelTitle,textTransform:'capitalize'}}>Расходы по дням · {monthLabelRu(viewMonth)}</div>
        <ChartCanvas type="bar" data={{labels:dailyExpense.labels, datasets:[{label:'Расход', data:dailyExpense.data, backgroundColor:C.red, borderRadius:3, maxBarThickness:14}]}} options={baseChartOpts()} height={220} />
      </div>
      )}

      <div style={S.panel}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap',marginBottom:10}}>
          <div style={{...S.panelTitle,marginBottom:0,textTransform:'capitalize'}}>Операции · {monthLabelRu(viewMonth)}</div>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <Select small style={{minWidth:150}} value={opsCat} onChange={setOpsCat}
              options={[{value:'',label:'все категории'}, ...opsCats.map(c=>({value:c,label:c}))]} />
            <div className="chip" onClick={()=>setOpsExcludeOnly(v=>!v)} title="показать только операции с флагом «не считать»"
              style={{background:opsExcludeOnly?C.amber:C.panelAlt,color:opsExcludeOnly?'#1A1200':C.dim,borderColor:opsExcludeOnly?C.amber:C.border}}>не считаемые</div>
            <div className="chip" onClick={()=>setOpsGroup(v=>!v)} title="сгруппировать по дням"
              style={{background:opsGroup?C.amber:C.panelAlt,color:opsGroup?'#1A1200':C.dim,borderColor:opsGroup?C.amber:C.border}}>📅 по дням</div>
          </div>
        </div>
        {finance.transactions.length===0 && <div style={S.emptyState}>Операций пока нет</div>}
        {finance.transactions.length>0 && filteredTx.length===0 && <div style={S.emptyState}>Нет операций за выбранный месяц</div>}
        {!opsGroup && filteredTx.slice(0,200).map(txRow)}
        {opsGroup && groupedTx.map(({date,rows,inc,exp})=>(
          <div key={date} style={{marginBottom:12}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'4px 0',borderBottom:`1px solid ${C.border}`,marginBottom:2}}>
              <span style={{fontSize:12,color:C.dim,fontFamily:"'JetBrains Mono',monospace"}}>{date}</span>
              <span style={{fontSize:11.5,fontFamily:"'JetBrains Mono',monospace"}}>
                {inc>0 && <span style={{color:C.green}}>+{mo(inc)}</span>}
                {inc>0 && exp>0 && <span style={{color:C.dim}}> · </span>}
                {exp>0 && <span style={{color:C.red}}>−{mo(exp)}</span>}
              </span>
            </div>
            {rows.map(txRow)}
          </div>
        ))}
      </div>
    </div>
  );
}

