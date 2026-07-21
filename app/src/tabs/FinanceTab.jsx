// Вкладка/раздел: FinanceTab, PlanPanel, OpsSection, AssetsSection, DebtorsSection (вынесено из App.jsx, session: decompose phase 3)
import { useEffect, useMemo, useState } from 'react';
import { baseChartOpts } from '../lib/charts.js';
import { DEFAULT_ACCOUNTS } from '../lib/constants.js';
import { daysAgoStr, monthLabelRu, openDatePicker, shiftMonth, todayStr } from '../lib/dates.js';
import { accountBalanceNow, accountBalanceOn, unassignedNetOn } from '../lib/finance.js';
import { fmtMoney, maskMoney } from '../lib/format.js';
import { vis } from '../lib/storage.js';
import { S } from '../lib/styles.js';
import { C, PIE_COLORS } from '../lib/theme.js';
import { ChartCanvas } from '../ui/ChartCanvas.jsx';
import { Select } from '../ui/primitives.jsx';

export function FinanceTab(props){
  const {finance, categories, budgets, bills, finMask={}, setSettingFlag} = props;
  const mo = n => maskMoney(finMask.ops, n);   // операции/доходы-расходы
  const [sub,setSub] = useState('ops');
  const netWorth = useMemo(()=> finance.accounts.reduce((sum,a)=> sum + accountBalanceNow(a, finance.transactions), 0) + unassignedNetOn(finance.transactions, todayStr()), [finance.accounts, finance.transactions]);
  const today = todayStr();
  const monthTx = useMemo(()=> finance.transactions.filter(t=>t.date.slice(0,7)===today.slice(0,7)), [finance.transactions]);
  const monthIncome = monthTx.filter(t=>t.type==='income'&&!t.exclude).reduce((s,t)=>s+t.amount,0);
  const monthExpense = monthTx.filter(t=>t.type==='expense'&&!t.exclude).reduce((s,t)=>s+t.amount,0);

  return (
    <div>
      <div className="grid3" style={S.grid3}>
        <div style={S.statCard}><div style={S.statVal}>{mo(monthIncome)}</div><div style={S.dimSpan}>доход · месяц</div></div>
        <div style={S.statCard}><div style={S.statVal}>{mo(monthExpense)}</div><div style={S.dimSpan}>расход · месяц</div></div>
        <div style={S.statCard}><div style={S.statVal}>{maskMoney(finMask.net, netWorth)}</div><div style={S.dimSpan}>чистые активы</div></div>
      </div>
      <div style={{display:'flex',gap:6,marginTop:20,marginBottom:14,flexWrap:'wrap'}}>
        {[{id:'ops',label:'Операции'},{id:'assets',label:'Активы'},{id:'debtors',label:'Должники'}].map(({id,label})=>(
          <div key={id} className="chip" onClick={()=>setSub(id)} style={{background:sub===id?C.amber:C.panelAlt,color:sub===id?'#1A1200':C.dim,borderColor:sub===id?C.amber:C.border}}>{label}</div>
        ))}
      </div>
      {sub==='ops' && <OpsSection {...props} monthTx={monthTx} />}
      {sub==='assets' && <AssetsSection accounts={finance.accounts} transactions={finance.transactions} finMask={finMask} addAccount={props.addAccount} deleteAccount={props.deleteAccount} addSnapshot={props.addSnapshot} deleteSnapshot={props.deleteSnapshot} />}
      {sub==='debtors' && <DebtorsSection debtors={finance.debtors} mask={finMask.debts} addDebtor={props.addDebtor} updateDebtor={props.updateDebtor} deleteDebtor={props.deleteDebtor} />}
    </div>
  );
}

export function PlanPanel({title, open, setOpen, planSwitcher, kindToggle, categories, actualByCat, plans, onSaveBatch, onRemove, barColor, spentWord, resetKey, mask=false}){
  const mo = n => maskMoney(mask, n);   // приватность: планы — часть «операций» (finMask.ops)
  const [draft,setDraft] = useState({});
  useEffect(()=>{ setDraft({}); }, [resetKey]);
  const valOf = (c) => draft[c]!==undefined ? draft[c] : (plans[c]!=null ? String(plans[c]) : '');
  const planNum = (c) => { const raw = draft[c]!==undefined ? parseFloat(draft[c]) : plans[c]; return isNaN(raw)||raw==null ? 0 : raw; };
  const totalPlan = categories.reduce((s,c)=>s+planNum(c),0);
  const totalSpent = categories.reduce((s,c)=>s+(actualByCat[c]||0),0);
  const dirty = Object.keys(draft).length>0;
  const save = () => { const patch={}; Object.entries(draft).forEach(([c,v])=>{ const n=parseFloat(v); if(!isNaN(n)&&n>0) patch[c]=n; }); if(Object.keys(patch).length) onSaveBatch(patch); setDraft({}); };
  return (
    <div style={S.panel}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:open?12:0,gap:8,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}} onClick={()=>setOpen(o=>!o)}>
          <span style={{color:C.dim,fontSize:11,transform:open?'none':'rotate(-90deg)',transition:'transform .12s'}}>▾</span>
          <div style={{...S.panelTitle,marginBottom:0}}>{title}</div>
          {kindToggle}
        </div>
        {open && planSwitcher}
      </div>
      {open && (<>
        {categories.map(c=>{ const spent=actualByCat[c]||0; const plan=plans[c]; const pn=planNum(c);
          return (
            <div key={c} style={{marginBottom:10}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8,alignItems:'center'}}>
                <span style={{fontSize:12.5,overflowWrap:'anywhere',minWidth:0}}>{c}</span>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:11.5,color:C.dim,fontFamily:"'JetBrains Mono',monospace",minWidth:58,textAlign:'right'}}>{mo(spent)}</span>
                  <span style={{color:C.dim}}>/</span>
                  <input style={{...S.input,fontSize:12.5,padding:'7px 9px',width:120,minWidth:0,flex:'none'}} type="number" placeholder="план ₽"
                    value={valOf(c)} onChange={e=>setDraft({...draft,[c]:e.target.value})} onKeyDown={e=>e.key==='Enter'&&save()} />
                  {plan!=null ? <button className="icon-btn" title="сбросить план" onClick={()=>onRemove(c)}>✕</button> : <span style={{width:20}}/>}
                </div>
              </div>
              {pn>0 && (
                <div style={{height:4,background:C.panelAlt,borderRadius:2,overflow:'hidden',marginTop:5}}>
                  <div style={{height:'100%',width:`${Math.min(100,spent/pn*100)}%`,background: spent>pn?C.red : spent/pn>0.7?C.amber:barColor}}/>
                </div>
              )}
            </div>
          );
        })}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginTop:14,flexWrap:'wrap',borderTop:`1px solid ${C.border}`,paddingTop:12}}>
          <div style={{fontSize:12,color:C.dim}}>Итого план: <b style={{color:C.text}}>{mo(totalPlan)}</b> · {spentWord} {mo(totalSpent)}</div>
          <button style={{...S.iconBtnAmber,width:'auto',padding:'0 18px',height:36,fontWeight:700,opacity:dirty?1:0.55}} onClick={save}>Сохранить планы</button>
        </div>
      </>)}
    </div>
  );
}

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
  const cats = txType==='expense' ? categories.expense : categories.income;
  const managedCats = catKind==='expense' ? categories.expense : categories.income;
  const accountName = (id) => finance.accounts.find(a=>a.id===id)?.name;

  const submit = () => { const amount=parseFloat(txAmount); if(isNaN(amount)||amount<=0) return;
    addTransaction({type:txType, amount, category:txCat, note:txNote.trim(), exclude:txExclude, date:txDate, accountId:txAccountId||null});
    setTxAmount(''); setTxNote(''); setTxExclude(false); };

  const expenseByCat = useMemo(()=>{ const map={}; monthTx.filter(t=>t.type==='expense'&&!t.exclude).forEach(t=>{ map[t.category]=(map[t.category]||0)+t.amount; }); return map; }, [monthTx]);
  const expenseCountByCat = useMemo(()=>{ const m={}; monthTx.filter(t=>t.type==='expense'&&!t.exclude).forEach(t=>{ m[t.category]=(m[t.category]||0)+1; }); return m; }, [monthTx]);
  const pieData = { labels:Object.keys(expenseByCat), datasets:[{data:Object.values(expenseByCat), backgroundColor:PIE_COLORS}] };
  const incomeByCat = useMemo(()=>{ const map={}; monthTx.filter(t=>t.type==='income'&&!t.exclude).forEach(t=>{ map[t.category]=(map[t.category]||0)+t.amount; }); return map; }, [monthTx]);
  const incomePieData = { labels:Object.keys(incomeByCat), datasets:[{data:Object.values(incomeByCat), backgroundColor:PIE_COLORS}] };

  // помесячные планы: выбранный месяц + факт по нему (можно листать историю)
  const [planMonth,setPlanMonth] = useState(todayStr().slice(0,7));
  const planTx = useMemo(()=> finance.transactions.filter(t=>t.date.slice(0,7)===planMonth && !t.exclude), [finance.transactions, planMonth]);
  const planExpenseByCat = useMemo(()=>{ const m={}; planTx.filter(t=>t.type==='expense').forEach(t=>{ m[t.category]=(m[t.category]||0)+t.amount; }); return m; }, [planTx]);
  const planIncomeByCat  = useMemo(()=>{ const m={}; planTx.filter(t=>t.type==='income').forEach(t=>{ m[t.category]=(m[t.category]||0)+t.amount; }); return m; }, [planTx]);
  const monthBudgets = budgets[planMonth]||{};
  const monthIncomePlans = incomePlans[planMonth]||{};
  // 💸 «Свободно на сегодня»: (план месяца − потрачено) / оставшиеся дни. session 025.
  const safeToSpend = useMemo(()=>{
    const ym = todayStr().slice(0,7);
    const plan = Object.values(budgets[ym]||{}).reduce((s,v)=>s+(v||0),0);
    if(plan<=0) return null;
    const spent = monthTx.filter(t=>t.type==='expense'&&!t.exclude).reduce((s,t)=>s+t.amount,0);
    const [y,mm] = ym.split('-').map(Number);
    const daysInMonth = new Date(y,mm,0).getDate();
    const dayNum = new Date().getDate();
    const remainingDays = Math.max(1, daysInMonth - dayNum + 1);
    const remaining = plan - spent;
    const perDay = remaining/remainingDays;
    const spentToday = monthTx.filter(t=>t.type==='expense'&&!t.exclude&&t.date===todayStr()).reduce((s,t)=>s+t.amount,0);
    return {plan, spent, remaining, perDay:Math.round(perDay), remainingDays, spentToday, leftToday:Math.round(perDay-spentToday)};
  }, [budgets, monthTx]);
  const planSwitcher = (
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <button style={S.navArrow} onClick={()=>setPlanMonth(shiftMonth(planMonth,-1))}>◀</button>
      <span style={{fontSize:12,color:C.dim,minWidth:120,textAlign:'center',textTransform:'capitalize'}}>{monthLabelRu(planMonth)}</span>
      <button style={S.navArrow} onClick={()=>setPlanMonth(shiftMonth(planMonth,1))} disabled={planMonth>=todayStr().slice(0,7)} title="следующий месяц">▶</button>
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

  // расходы по каждому дню (гистограмма, НЕ накопительно) за 30 дней. session 015.
  const dailyExpense = useMemo(()=>{
    const byDate={};
    finance.transactions.forEach(t=>{ if(!t.exclude && t.type==='expense') byDate[t.date]=(byDate[t.date]||0)+t.amount; });
    const labels=[], data=[];
    for(let i=29;i>=0;i--){ const ds=daysAgoStr(i); labels.push(ds.slice(5)); data.push(byDate[ds]||0); }
    return {labels, data};
  }, [finance.transactions]);

  return (
    <div>
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
          <PlanPanel title="Планируемые" kindToggle={kindToggle} open={planOpen} setOpen={setPlanOpen} planSwitcher={planSwitcher} resetKey={planMonth+'_'+effKind} mask={finMask.ops}
            categories={isExp?categories.expense:categories.income}
            actualByCat={isExp?planExpenseByCat:planIncomeByCat}
            plans={isExp?monthBudgets:monthIncomePlans}
            onSaveBatch={patch=> isExp?setBudgetsBatch(planMonth,patch):setIncomePlansBatch(planMonth,patch)}
            onRemove={c=> isExp?removeBudget(planMonth,c):removeIncomePlan(planMonth,c)}
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
          <div style={S.panelTitle}>Расходы по категориям · месяц</div>
          {Object.keys(expenseByCat).length===0 ? <div style={S.emptyState}>Пока нет расходов</div> :
            <ChartCanvas type="pie" data={pieData} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:C.dim,font:{size:11}}}}}} height={220} />}
        </div>
        )}
        {vis('ops.incomePie') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Доходы по категориям · месяц</div>
          {Object.keys(incomeByCat).length===0 ? <div style={S.emptyState}>Пока нет доходов</div> :
            <ChartCanvas type="pie" data={incomePieData} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:C.dim,font:{size:11}}}}}} height={220} />}
        </div>
        )}
      </div>
      {vis('ops.expenseDaily') && (
      <div style={S.panel}>
        <div style={S.panelTitle}>Расходы по дням · 30 дней</div>
        <ChartCanvas type="bar" data={{labels:dailyExpense.labels, datasets:[{label:'Расход', data:dailyExpense.data, backgroundColor:C.red, borderRadius:3, maxBarThickness:14}]}} options={baseChartOpts()} height={220} />
      </div>
      )}

      <div style={S.panel}>
        <div style={S.panelTitle}>Последние операции</div>
        {finance.transactions.length===0 && <div style={S.emptyState}>Операций пока нет</div>}
        {finance.transactions.slice(0,25).map(t=>(
          <div key={t.id} className="row-hover" style={S.taskRow}>
            <div style={{width:8,height:8,borderRadius:4,background:t.type==='income'?C.green:C.red}} />
            <div style={{width:60,fontSize:12,color:C.dim,fontFamily:"'JetBrains Mono',monospace"}}>{t.date.slice(5)}</div>
            <div style={{flex:1,fontSize:13.5}}>{t.category}{t.accountId?` · ${accountName(t.accountId)||'?'}`:''}{t.note?` · ${t.note}`:''}{t.exclude?<span style={{...S.dimSpan,marginLeft:4}}>(не считается)</span>:null}</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:t.type==='income'?C.green:C.red}}>{t.type==='income'?'+':'−'}{mo(t.amount)}</div>
            <button className="icon-btn" onClick={()=>deleteTransaction(t.id)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

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
    transactions.forEach(t=>{ if(!t.exclude && (!start||t.date<start)) start=t.date; });
    if(!start) return [];
    const dateSet=new Set([today]);
    accounts.forEach(a=>a.snapshots.forEach(s=>dateSet.add(s.date)));
    transactions.forEach(t=>{ if(!t.exclude && t.date>=start && t.date<=today) dateSet.add(t.date); });
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

export function DebtorsSection({debtors, mask=false, addDebtor, updateDebtor, deleteDebtor}){
  const [name,setName] = useState(''); const [amount,setAmount] = useState('');
  return (
    <div style={S.panel}>
      <div style={S.panelTitle}>Кто должен</div>
      <div style={S.inputRow}>
        <input style={S.input} placeholder="Имя" value={name} onChange={e=>setName(e.target.value)} />
        <input style={{...S.input,maxWidth:120}} type="number" placeholder="сумма" value={amount} onChange={e=>setAmount(e.target.value)} />
        <button style={S.iconBtnAmber} onClick={()=>{ const a=parseFloat(amount); if(name.trim()&&!isNaN(a)){ addDebtor(name.trim(),a); setName(''); setAmount(''); } }}>+</button>
      </div>
      {debtors.length===0 && <div style={S.emptyState}>Долгов не зафиксировано</div>}
      {debtors.map(d=>(
        <div key={d.id} className="row-hover" style={S.taskRow}>
          <div style={{flex:1,fontSize:13.5}}>{d.name}</div>
          {mask
            ? <div style={{maxWidth:100,textAlign:'right',flex:'0 0 100px',color:C.dim,fontFamily:"'JetBrains Mono',monospace"}}>••••••</div>
            : <input style={{...S.input,maxWidth:100,textAlign:'right'}} type="number" defaultValue={d.amount} onBlur={e=>updateDebtor(d.id,parseFloat(e.target.value)||0)} />}
          <button className="icon-btn" onClick={()=>deleteDebtor(d.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}
