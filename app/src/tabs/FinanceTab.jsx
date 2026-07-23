// Вкладка/раздел: FinanceTab, PlanPanel, OpsSection, AssetsSection, DebtorsSection (вынесено из App.jsx, session: decompose phase 3)
import { useEffect, useMemo, useState } from 'react';
import { baseChartOpts } from '../lib/charts.js';
import { DEFAULT_ACCOUNTS } from '../lib/constants.js';
import { monthLabelRu, openDatePicker, shiftMonth, todayStr } from '../lib/dates.js';
import { accountBalanceNow, accountBalanceOn, unassignedNetOn } from '../lib/finance.js';
import { fmtMoney, maskMoney } from '../lib/format.js';
import { vis } from '../lib/storage.js';
import { S } from '../lib/styles.js';
import { C, PIE_COLORS } from '../lib/theme.js';
import { ChartCanvas } from '../ui/ChartCanvas.jsx';
import { ConfirmIconBtn, Select } from '../ui/primitives.jsx';

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
        {[{id:'ops',label:'Операции'},{id:'assets',label:'Активы'},{id:'debtors',label:'Долги'}].map(({id,label})=>(
          <div key={id} className="chip" onClick={()=>setSub(id)} style={{background:sub===id?C.amber:C.panelAlt,color:sub===id?'#1A1200':C.dim,borderColor:sub===id?C.amber:C.border}}>{label}</div>
        ))}
      </div>
      {sub==='ops' && <OpsSection {...props} monthTx={monthTx} />}
      {sub==='assets' && <AssetsSection accounts={finance.accounts} transactions={finance.transactions} finMask={finMask} addAccount={props.addAccount} deleteAccount={props.deleteAccount} addSnapshot={props.addSnapshot} deleteSnapshot={props.deleteSnapshot} />}
      {sub==='debtors' && <DebtsSection debtors={finance.debtors} transactions={finance.transactions} accounts={finance.accounts} mask={finMask.debts} addDebt={props.addDebt} updateDebt={props.updateDebt} deleteDebt={props.deleteDebt} debtMovement={props.debtMovement} />}
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
