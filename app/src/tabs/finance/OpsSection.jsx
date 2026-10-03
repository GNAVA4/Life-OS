// Финансы → Операции и Обзор (редизайн «Тихий», session 043: Э6/Э6б). Расчёты прежние (session 015–036);
// раскладка разделена: part='ops' — быстрый ввод, «заполнить как раньше», свободно на сегодня, список операций с
// фильтрами, категории; part='overview' — бюджет-алерты, структура расходов/доходов, план/факт, расходы по дням,
// регулярные платежи. Месяц просмотра общий (держит FinanceTab).
import { useMemo, useState } from 'react';
import { baseChartOpts } from '../../lib/charts.js';
import { addDays, monthLabelRu, openDatePicker, shiftMonth, todayStr } from '../../lib/dates.js';
import { maskMoney } from '../../lib/format.js';
import { vis } from '../../lib/storage.js';
import { S } from '../../lib/styles.js';
import { C, PIE_COLORS, tint } from '../../lib/theme.js';
import { ChartCanvas } from '../../ui/ChartCanvas.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { ConfirmIconBtn, Select } from '../../ui/primitives.jsx';
import { PlanPanel } from './PlanPanel.jsx';

// «Заполнить как раньше»: сколько последних дней смотреть и сколько вариантов показывать.
// 60 дней — частые траты живут в пределах пары месяцев; 4 чипа помещаются в строку телефона.
const REPEAT_LOOKBACK_DAYS = 60, REPEAT_MAX = 4;

// чип-обёртка для системных select/date (счёт и дата операции, референс Э6)
const CHIPBOX = {position:'relative',display:'inline-flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:999,background:C.panelAlt,color:C.text,fontSize:13,cursor:'pointer'};

export function OpsSection({part='ops', viewMonth, setViewMonth, finance, categories, budgets, incomePlans, bills, monthTx, defaults={}, finMask={}, addTransaction, deleteTransaction, addCategory, removeCategory, setBudget, removeBudget, setIncomePlan, removeIncomePlan, setBudgetsBatch, setIncomePlansBatch, addBill, deleteBill, updateBill, collapse={}, toggleCollapse, dismissedAlerts={}, dismissAlert}){
  const mo = n => maskMoney(finMask.ops, n);   // приватность: скрытие сумм операций
  const [planKind,setPlanKind] = useState('expense');
  // категория по умолчанию: из настроек, если валидна, иначе первая в списке
  const defExpenseCat = categories.expense.includes(defaults.expenseCat) ? defaults.expenseCat : categories.expense[0];
  const defIncomeCat = categories.income.includes(defaults.incomeCat) ? defaults.incomeCat : categories.income[0];
  const defAccount = finance.accounts.some(a=>a.id===defaults.account) ? defaults.account : '';
  const [txAmount,setTxAmount] = useState(''); const [txType,setTxType] = useState('expense');
  const [txCat,setTxCat] = useState(defExpenseCat); const [txNote,setTxNote] = useState('');
  const [txDate,setTxDate] = useState(todayStr()); const [txExclude,setTxExclude] = useState(false);
  const [txAccountId,setTxAccountId] = useState(defAccount);
  const [showNote,setShowNote] = useState(false);
  const [addedMsg,setAddedMsg] = useState('');
  const [newCat,setNewCat] = useState(''); const [showCatManager,setShowCatManager] = useState(false);
  const [catKind,setCatKind] = useState('expense');
  const [billOpen,setBillOpen] = useState(false);
  const [billName,setBillName] = useState(''); const [billAmount,setBillAmount] = useState(''); const [billDay,setBillDay] = useState('');
  const [opsCat,setOpsCat] = useState('');
  const [opsGroup,setOpsGroup] = useState(true);
  const [opsExcludeOnly,setOpsExcludeOnly] = useState(false);
  const managedCats = catKind==='expense' ? categories.expense : categories.income;
  const accountName = (id) => finance.accounts.find(a=>a.id===id)?.name;
  const today = todayStr();

  // категории текущего типа: часто используемые — первыми (по последним 90 дням), остальные — в исходном порядке
  const catsSorted = useMemo(()=>{
    const list = txType==='expense' ? categories.expense : categories.income;
    const freq = {}; finance.transactions.forEach(t=>{ if(t.type===txType && !t.debtFlow) freq[t.category]=(freq[t.category]||0)+1; });
    return [...list].sort((a,b)=>(freq[b]||0)-(freq[a]||0));
  }, [finance.transactions, categories, txType]);

  // «Заполнить как раньше»: частые сочетания тип+категория+сумма(+комментарий, счёт) за последние дни
  const repeats = useMemo(()=>{
    const from = new Date(today+'T00:00:00'); from.setDate(from.getDate()-REPEAT_LOOKBACK_DAYS);
    const fromStr = `${from.getFullYear()}-${String(from.getMonth()+1).padStart(2,'0')}-${String(from.getDate()).padStart(2,'0')}`;
    const m = {};
    finance.transactions.forEach(t=>{ if(t.debtFlow || t.date<fromStr) return;
      const k = `${t.type}|${t.category}|${t.amount}|${t.note||''}`;
      if(!m[k]) m[k] = {t, n:0}; m[k].n++; });
    return Object.values(m).filter(x=>x.n>=2).sort((a,b)=>b.n-a.n).slice(0,REPEAT_MAX).map(x=>x.t);
  }, [finance.transactions, today]);
  const fillFrom = (t) => { setTxType(t.type); setTxCat(t.category); setTxAmount(String(t.amount)); setTxNote(t.note||''); setShowNote(!!t.note);
    if(t.accountId) setTxAccountId(t.accountId); setTxExclude(!!t.exclude); setTxDate(today); };

  const submit = () => { const amount=parseFloat(String(txAmount).replace(',','.')); if(isNaN(amount)||amount<=0) return;
    addTransaction({type:txType, amount, category:txCat, note:txNote.trim(), exclude:txExclude, date:txDate, accountId:txAccountId||null});
    setAddedMsg(`${txType==='income'?'+':'−'}${mo(amount)} · ${txCat}`); setTimeout(()=>setAddedMsg(''), 2200);
    setTxAmount(''); setTxNote(''); setTxExclude(false); setShowNote(false); };

  const viewTx = useMemo(()=> finance.transactions.filter(t=>!t.debtFlow && t.date.slice(0,7)===viewMonth), [finance.transactions, viewMonth]);
  const viewExpenseByCat = useMemo(()=>{ const m={}; viewTx.filter(t=>t.type==='expense'&&!t.exclude).forEach(t=>{ m[t.category]=(m[t.category]||0)+t.amount; }); return m; }, [viewTx]);
  const viewIncomeByCat  = useMemo(()=>{ const m={}; viewTx.filter(t=>t.type==='income'&&!t.exclude).forEach(t=>{ m[t.category]=(m[t.category]||0)+t.amount; }); return m; }, [viewTx]);
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

  const curYm = today.slice(0,7);
  const monthSwitcher = (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:16}}>
      <button style={S.navArrow} aria-label="Предыдущий месяц" onClick={()=>setViewMonth(shiftMonth(viewMonth,-1))}><Icon name="chevL"/></button>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
        <b style={{fontWeight:600,textTransform:'capitalize'}}>{monthLabelRu(viewMonth)}</b>
        {viewMonth!==curYm && <button onClick={()=>setViewMonth(curYm)} style={{background:'none',border:'none',color:C.cyan,fontSize:12,cursor:'pointer',fontFamily:'inherit',padding:0}}>к текущему месяцу</button>}
      </div>
      <button style={{...S.navArrow,opacity:viewMonth>=curYm?.3:1}} aria-label="Следующий месяц" onClick={()=>setViewMonth(shiftMonth(viewMonth,1))} disabled={viewMonth>=curYm}><Icon name="chevR"/></button>
    </div>
  );

  // бюджет-алерты + прогноз к концу месяца (текущий месяц). session 015; уточнено 016/017.
  // Прогноз = run-rate: факт/деньМесяца*днейВМесяце — честен ТОЛЬКО для частых трат.
  //   Для категорий с ≤5 операциями (разовые) НЕ экстраполируем (sparse). [user, 017]
  // Алерт показываем ТОЛЬКО если ФАКТ по категории ≥25% всех планируемых расходов месяца. [user, 017]
  const MIN_TX_FOR_FORECAST = 6;      // >5 операций → строим прогноз
  const MIN_SHARE_FOR_ALERT = 0.25;   // факт категории ≥25% от общих планируемых расходов
  const budgetAlerts = useMemo(()=>{
    const cur = todayStr().slice(0,7);
    const b = budgets[cur]||{};
    const totalPlan = Object.values(b).reduce((s,v)=>s+(v>0?v:0),0);
    if(totalPlan<=0) return [];
    const [Y,M,D] = todayStr().split('-').map(Number);
    const daysInMonth = new Date(Y, M, 0).getDate();
    const rows=[];
    Object.keys(b).forEach(c=>{ const plan=b[c]; if(!plan||plan<=0) return;
      const spent=expenseByCat[c]||0;
      if(spent/totalPlan < MIN_SHARE_FOR_ALERT) return;
      const ratio=spent/plan; const cnt=expenseCountByCat[c]||0;
      const sparse = cnt < MIN_TX_FOR_FORECAST;
      const projected = (sparse || D<=0) ? spent : Math.round(spent/D*daysInMonth);
      if(ratio>=0.8) rows.push({cat:c, spent, plan, ratio, projected, over:spent>plan, sparse, cnt});
    });
    return rows.sort((a,b)=>b.ratio-a.ratio);
  }, [budgets, expenseByCat, expenseCountByCat]);

  // расходы по каждому дню ВЫБРАННОГО месяца (гистограмма, НЕ накопительно). session 015/032.
  const dailyExpense = useMemo(()=>{
    const byDate={};
    viewTx.forEach(t=>{ if(!t.exclude && t.type==='expense') byDate[t.date]=(byDate[t.date]||0)+t.amount; });
    const [y,m]=viewMonth.split('-').map(Number); const dim=new Date(y,m,0).getDate();
    const labels=[], data=[];
    for(let d=1; d<=dim; d++){ const ds=`${viewMonth}-${String(d).padStart(2,'0')}`; labels.push(String(d)); data.push(byDate[ds]||0); }
    return {labels, data};
  }, [viewTx, viewMonth]);

  // список операций: фильтр по категории + группировка по дням. debtFlow — во вкладке «Долги».
  const opsCats = useMemo(()=>{ const set=new Set(); finance.transactions.forEach(t=>{ if(!t.debtFlow) set.add(t.category); }); return [...set].sort(); }, [finance.transactions]);
  const filteredTx = useMemo(()=> finance.transactions.filter(t=> !t.debtFlow && t.date.slice(0,7)===viewMonth && (!opsCat || t.category===opsCat) && (!opsExcludeOnly || t.exclude)), [finance.transactions, viewMonth, opsCat, opsExcludeOnly]);
  const groupedTx = useMemo(()=>{
    const map={}; filteredTx.slice(0,200).forEach(t=>{ (map[t.date]=map[t.date]||[]).push(t); });
    return Object.keys(map).sort((a,b)=>b<a?-1:1).map(date=>{ const rows=map[date];
      const inc=rows.filter(t=>t.type==='income'&&!t.exclude).reduce((s,t)=>s+t.amount,0);
      const exp=rows.filter(t=>t.type==='expense'&&!t.exclude).reduce((s,t)=>s+t.amount,0);
      return {date, rows, inc, exp}; });
  }, [filteredTx]);
  const dayLabel = (ds) => ds===today ? 'Сегодня' : new Date(ds+'T00:00:00').toLocaleDateString('ru-RU',{weekday:'short',day:'numeric',month:'long'});
  const txRow = (t, showDate) => (
    <div key={t.id} style={{...S.taskRow,gap:10}}>
      <span style={{width:6,height:6,borderRadius:3,background:t.type==='income'?C.green:C.red,flex:'none'}}/>
      <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:2}}>
        <span style={{fontSize:14,overflowWrap:'anywhere'}}>{t.note || t.category}</span>
        <span style={{fontSize:12,color:C.dim,overflowWrap:'anywhere'}}>{showDate?`${t.date.slice(8,10)}.${t.date.slice(5,7)} · `:''}{t.note?t.category:''}{t.note&&t.accountId?' · ':''}{t.accountId?(accountName(t.accountId)||'?'):''}{t.exclude?<span style={{color:C.amber}}> · не считается</span>:null}</span>
      </div>
      <span style={{fontVariantNumeric:'tabular-nums',fontSize:14,fontWeight:600,color:t.type==='income'?C.green:C.text,whiteSpace:'nowrap'}}>{t.type==='income'?'+':'−'}{mo(t.amount)}</span>
      <ConfirmIconBtn onConfirm={()=>deleteTransaction(t.id)} title="удалить операцию" confirmLabel="удалить?" />
    </div>
  );
  const chip = (on, onClick, children, key, tone=C.amber) => (
    <button key={key} type="button" className="chip" onClick={onClick} style={{fontFamily:'inherit',background:on?tint(tone,.16):C.panelAlt,color:on?tone:C.dim}}>{children}</button>
  );

  // ---------------- ОПЕРАЦИИ ----------------
  // широкий экран (≥1400px): слева ввод и сводка, справа список операций месяца [user, s049] — класс .fin-ops в index.css
  if(part==='ops') return (
    <div className="fin-ops"><div>
      {/* быстрый ввод: сумма → категория → «Добавить»; счёт и дата запоминаются, пока открыта вкладка */}
      <div style={{...S.plate,display:'flex',flexDirection:'column',gap:12,marginBottom:14}}>
        <div style={{...S.seg,background:C.bg,display:'flex'}}>
          {[{v:'expense',l:'Расход',c:C.red},{v:'income',l:'Доход',c:C.green}].map(o=>(
            <button key={o.v} onClick={()=>{ setTxType(o.v); setTxCat(o.v==='expense'?defExpenseCat:defIncomeCat); }}
              style={{...S.segBtn,flex:1,fontSize:13.5,padding:'8px',background:txType===o.v?C.panelAlt:'transparent',color:txType===o.v?o.c:C.dim}}>{o.v==='expense'?'− ':'+ '}{o.l}</button>))}
        </div>
        <div style={{display:'flex',alignItems:'baseline',gap:8,borderBottom:`1px solid ${C.border}`,paddingBottom:6}}>
          <input value={txAmount} onChange={e=>setTxAmount(e.target.value.replace(/[^\d.,]/g,''))} inputMode="decimal" placeholder="0" aria-label="Сумма"
            onKeyDown={e=>e.key==='Enter'&&submit()}
            style={{flex:1,minWidth:0,background:'transparent',border:'none',outline:'none',color:txType==='income'?C.green:C.text,fontSize:30,fontWeight:700,fontFamily:'inherit',fontVariantNumeric:'tabular-nums',padding:0}} />
          <span style={{fontSize:18,color:C.dim,fontWeight:600}}>₽</span>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {catsSorted.map(c=>chip(txCat===c, ()=>setTxCat(c), c, c, txType==='income'?C.green:C.amber))}
          <button type="button" className="chip" onClick={()=>{ setCatKind(txType); setShowCatManager(v=>!v); }} style={{fontFamily:'inherit',background:'transparent',border:`1px dashed ${C.faint}`,color:C.dim}}><Icon name="edit" size={12}/>категории</button>
        </div>
        {showCatManager && (
          <div className="anim-collapse" style={{background:C.bg,borderRadius:10,padding:10,display:'flex',flexDirection:'column',gap:8}}>
            <div style={{display:'flex',gap:6}}>{[{id:'expense',label:'Расходы'},{id:'income',label:'Доходы'}].map(({id,label})=>chip(catKind===id, ()=>setCatKind(id), label, id))}</div>
            <div style={{display:'flex',gap:6}}>
              <input style={{...S.input,padding:'7px 10px',fontSize:13}} placeholder="Новая категория" value={newCat} aria-label="Новая категория" onChange={e=>setNewCat(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'&&newCat.trim()){ addCategory(catKind,newCat.trim()); setNewCat(''); } }} />
              <button style={{...S.iconBtnAmber,width:36,height:36}} aria-label="Добавить категорию" onClick={()=>{ if(newCat.trim()){ addCategory(catKind,newCat.trim()); setNewCat(''); } }}><Icon name="plus" size={16}/></button>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {managedCats.map(c=>(
                <div key={c} className="chip" style={{background:C.panelAlt,color:C.dim,paddingRight:4}}>{c}
                  <ConfirmIconBtn onConfirm={()=>removeCategory(catKind,c)} title="удалить категорию" confirmLabel="удалить?" /></div>))}
            </div>
          </div>
        )}
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          {/* счёт и дата — чипами (референс Э6): нажатие открывает системный выбор */}
          <label style={CHIPBOX} title="счёт">
            <Icon name="finance" size={13}/>
            <select value={txAccountId} onChange={e=>setTxAccountId(e.target.value)} aria-label="Счёт операции"
              style={{appearance:'none',WebkitAppearance:'none',background:'none',border:'none',color:'inherit',font:'inherit',padding:0,cursor:'pointer',maxWidth:150,outline:'none'}}>
              <option value="">без счёта</option>
              {finance.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label style={CHIPBOX} title="дата операции">
            <Icon name="calendar" size={13}/>{txDate===today?'сегодня':txDate===addDays(today,-1)?'вчера':new Date(txDate+'T00:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}
            <input type="date" value={txDate} aria-label="Дата операции" onChange={e=>setTxDate(e.target.value||today)} onClick={openDatePicker}
              style={{position:'absolute',inset:0,opacity:0,cursor:'pointer',width:'100%'}} />
          </label>
          {chip(showNote||!!txNote, ()=>setShowNote(v=>!v), 'комментарий', 'note', C.text)}
          {chip(txExclude, ()=>setTxExclude(v=>!v), 'не считать', 'ex')}
        </div>
        {showNote && <input autoFocus style={{...S.input,background:C.bg}} placeholder="Комментарий" value={txNote} aria-label="Комментарий" onChange={e=>setTxNote(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />}
        {txExclude && <span style={{fontSize:12,color:C.dim,marginTop:-4}}>«Не считать» — операция не попадёт в доходы, расходы и статистику.</span>}
        <button style={{...S.btnPrimary,padding:'11px',opacity:parseFloat(String(txAmount).replace(',','.'))>0?1:.45}} onClick={submit}>
          {txType==='income'?'Добавить доход':'Добавить расход'}{txDate!==today?` · ${txDate.slice(8,10)}.${txDate.slice(5,7)}`:''}</button>
        {addedMsg && <span role="status" style={{fontSize:12.5,color:C.green,textAlign:'center',marginTop:-4}}>Добавлено: {addedMsg}</span>}
      </div>

      {repeats.length>0 && (
        <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:18}}>
          <span style={{fontSize:12,color:C.dim}}>Заполнить как раньше</span>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {repeats.map((t,i)=><button key={i} className="chip" onClick={()=>fillFrom(t)} style={{fontFamily:'inherit',background:C.panelAlt,color:C.text}}>
              {t.note||t.category} <span style={{color:t.type==='income'?C.green:C.dim}}>{t.type==='income'?'+':''}{mo(t.amount)}</span></button>)}
          </div>
        </div>
      )}

      {/* сводка месяца двумя плитками (референс Э6): «Свободно сегодня» (если есть план) и «Расход за месяц» */}
      {(() => {
        const st = (vis('ops.safeToSpend') && safeToSpend) ? safeToSpend : null;
        const monthExp = monthTx.filter(t=>t.type==='expense'&&!t.exclude).reduce((s,t)=>s+t.amount,0);
        const monthInc = monthTx.filter(t=>t.type==='income'&&!t.exclude).reduce((s,t)=>s+t.amount,0);
        const planSum = Object.values(budgets[today.slice(0,7)]||{}).reduce((s,v)=>s+(v||0),0);
        const tileBox = {background:C.panel,borderRadius:14,padding:'12px 14px',minWidth:0,display:'flex',flexDirection:'column',gap:4};
        const big = {fontSize:22,fontWeight:700,fontVariantNumeric:'tabular-nums',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'};
        const over = st && st.leftToday<0; const col = st ? (over?C.red:(st.leftToday< st.perDay*0.3?C.amber:C.green)) : C.green;
        return (
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,marginBottom:22}}>
            {st ? (
              <div style={tileBox} title={`до конца месяца ${mo(st.remaining)} на ${st.remainingDays} дн. · план ${mo(st.plan)}, потрачено ${mo(st.spent)}`}>
                <span style={{fontSize:12.5,color:C.dim}}>{over?'Лимит превышен на':'Свободно сегодня'}</span>
                <span style={{...big,color:col}}>{over?'−':''}{mo(Math.abs(st.leftToday))}</span>
                <span style={{fontSize:12,color:C.dim}}>~{mo(st.perDay)} в день · {st.remainingDays} дн.</span>
              </div>
            ) : (
              <div style={tileBox}>
                <span style={{fontSize:12.5,color:C.dim}}>Доход за месяц</span>
                <span style={{...big,color:C.green}}>{mo(monthInc)}</span>
                <span style={{fontSize:12,color:C.dim}}>план расходов — в «Обзоре»</span>
              </div>
            )}
            <div style={tileBox}>
              <span style={{fontSize:12.5,color:C.dim}}>Расход за месяц</span>
              <span style={big}>{mo(monthExp)}</span>
              <span style={{fontSize:12,color:C.dim}}>{planSum>0?`из плана ${mo(planSum)}`:`доход ${mo(monthInc)}`}</span>
            </div>
          </div>
        );
      })()}

      </div><div>
      {monthSwitcher}
      <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:8}}>
        <Select small style={{flex:'1 1 150px'}} value={opsCat} onChange={setOpsCat} options={[{value:'',label:'Все категории'}, ...opsCats.map(c=>({value:c,label:c}))]} />
        {chip(opsExcludeOnly, ()=>setOpsExcludeOnly(v=>!v), 'не считаемые', 'exo')}
        {chip(opsGroup, ()=>setOpsGroup(v=>!v), 'по дням', 'grp')}
      </div>
      {finance.transactions.length===0 && <div style={S.emptyState}>Операций пока нет — добавь первую формой выше.</div>}
      {finance.transactions.length>0 && filteredTx.length===0 && <div style={S.emptyState}>За этот месяц операций нет.</div>}
      {!opsGroup && filteredTx.slice(0,200).map(t=>txRow(t,true))}
      {opsGroup && groupedTx.map(({date,rows,inc,exp})=>(
        <div key={date} style={{marginBottom:10}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'10px 0 2px'}}>
            <span style={{...S.panelTitle,marginBottom:0}}>{dayLabel(date)}</span>
            <span style={{fontSize:12,fontVariantNumeric:'tabular-nums'}}>
              {inc>0 && <span style={{color:C.green}}>+{mo(inc)}</span>}{inc>0 && exp>0 && <span style={{color:C.dim}}> · </span>}{exp>0 && <span style={{color:C.dim}}>−{mo(exp)}</span>}
            </span>
          </div>
          {rows.map(t=>txRow(t,false))}
        </div>
      ))}
      </div>
    </div>
  );

  // ---------------- ОБЗОР ----------------
  const donut = (byCat, title, emptyTxt, visId) => {
    if(!vis(visId)) return null;
    const entries = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
    const total = entries.reduce((s,[,v])=>s+v,0);
    return (
      <div style={S.panel}>
        <div style={S.panelTitle}>{title}<span style={S.dimSpan}>{entries.length?mo(total):''}</span></div>
        {entries.length===0 ? <div style={S.emptyState}>{emptyTxt}</div> : (
          <div style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
            <div style={{width:130,height:130,flex:'none'}}>
              <ChartCanvas type="doughnut" height={130} data={{labels:entries.map(e=>e[0]), datasets:[{data:entries.map(e=>e[1]), backgroundColor:PIE_COLORS, borderWidth:0}]}}
                options={{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{display:false},tooltip:{enabled:!finMask.ops}}}} />
            </div>
            <div style={{flex:'1 1 160px',minWidth:0,display:'flex',flexDirection:'column',gap:6}}>
              {entries.map(([c,v],i)=>(
                <div key={c} style={{display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                  <span style={{width:9,height:9,borderRadius:3,background:PIE_COLORS[i%PIE_COLORS.length],flex:'none'}}/>
                  <span style={{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:C.dim}}>{c}</span>
                  <span style={{fontVariantNumeric:'tabular-nums'}}>{mo(v)}</span>
                  <span style={{fontSize:11.5,color:C.faint,width:34,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{Math.round(v/total*100)}%</span>
                </div>))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {monthSwitcher}

      {(() => {
        if(!vis('ops.budgetAlerts')) return null;
        const ym = todayStr().slice(0,7);
        const visibleAlerts = budgetAlerts.filter(a=>!dismissedAlerts[ym+'_'+a.cat]);
        if(!visibleAlerts.length) return null;
        const isC = !!(collapse.ui && collapse.ui.alerts);
        return (
          <div style={{...S.plate,background:tint(C.amber,.08),marginBottom:22}}>
            <button onClick={()=>toggleCollapse && toggleCollapse('ui','alerts')} aria-expanded={!isC}
              style={{display:'flex',alignItems:'center',gap:8,width:'100%',background:'none',border:'none',padding:0,color:C.amber,cursor:'pointer',fontFamily:'inherit',fontSize:13.5,fontWeight:600,marginBottom:isC?0:10}}>
              <Icon name="warn" size={15}/><span style={{flex:1,textAlign:'left'}}>Бюджет: {visibleAlerts.length} {visibleAlerts.length===1?'категория':'категории'} у предела · текущий месяц</span>
              <span style={{display:'flex',transform:isC?'none':'rotate(90deg)'}}><Icon name="chevR" size={14}/></span>
            </button>
            {!isC && visibleAlerts.map(a=>(
              <div key={a.cat} style={{marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4,gap:8,alignItems:'center'}}>
                  <span style={{minWidth:0,overflowWrap:'anywhere',flex:1,color:a.over?C.red:C.text}}>{a.cat}</span>
                  <span style={{color:C.dim,fontVariantNumeric:'tabular-nums'}}>{mo(a.spent)} / {mo(a.plan)} · {Math.round(a.ratio*100)}%</span>
                  <button className="icon-btn" title="скрыть этот алерт до следующего месяца" aria-label="Скрыть алерт" onClick={()=>dismissAlert && dismissAlert(ym+'_'+a.cat)}><Icon name="x" size={14}/></button>
                </div>
                <div style={{height:4,background:C.panelAlt,borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,a.ratio*100)}%`,background:a.over?C.red:C.amber}}/></div>
                <div style={{fontSize:12,color:(!a.sparse && a.projected>a.plan)?C.red:C.dim,marginTop:4}}>
                  {a.sparse ? `прогноз ${mo(a.projected)} — разовые траты (${a.cnt} оп.), без экстраполяции`
                    : `прогноз на месяц ${mo(a.projected)}${a.projected>a.plan?` · превышение на ${mo(a.projected-a.plan)}`:''}`}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      <div className="grid2" style={S.grid2}>
        {donut(viewExpenseByCat, 'Расходы по категориям', 'Расходов за месяц нет.', 'ops.expensePie')}
        {donut(viewIncomeByCat, 'Доходы по категориям', 'Доходов за месяц нет.', 'ops.incomePie')}
      </div>

      {(() => {
        // Плашка планов с переключателем Расходы/Доходы (session 020) — по ВЫБРАННОМУ месяцу.
        const showExp = vis('ops.planExpense'), showInc = vis('ops.planIncome');
        if(!showExp && !showInc) return null;
        const effKind = (planKind==='income' && showInc) ? 'income' : (showExp ? 'expense' : 'income');
        const isExp = effKind==='expense';
        const kindToggle = (
          <div style={{display:'flex',gap:6}}>
            {showExp && chip(isExp, (e)=>{ e&&e.stopPropagation&&e.stopPropagation(); setPlanKind('expense'); }, 'Расходы', 'pe')}
            {showInc && chip(!isExp, (e)=>{ e&&e.stopPropagation&&e.stopPropagation(); setPlanKind('income'); }, 'Доходы', 'pi')}
          </div>
        );
        return (
          <PlanPanel title="План / факт" kindToggle={kindToggle} kindWord={isExp?'расходов':'доходов'} resetKey={viewMonth+'_'+effKind} mask={finMask.ops}
            categories={isExp?categories.expense:categories.income}
            actualByCat={isExp?planExpenseByCat:planIncomeByCat}
            plans={isExp?monthBudgets:monthIncomePlans}
            onSaveBatch={patch=> isExp?setBudgetsBatch(viewMonth,patch):setIncomePlansBatch(viewMonth,patch)}
            onRemove={c=> isExp?removeBudget(viewMonth,c):removeIncomePlan(viewMonth,c)}
            barColor={isExp?C.green:C.cyan} spentWord={isExp?'потрачено':'получено'} />
        );
      })()}

      {vis('ops.expenseDaily') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Расходы по дням</div>
          <ChartCanvas type="bar" data={{labels:dailyExpense.labels, datasets:[{label:'Расход', data:dailyExpense.data, backgroundColor:C.amber, borderRadius:3, maxBarThickness:12}]}}
            options={baseChartOpts({plugins:{legend:{display:false},tooltip:{enabled:!finMask.ops}}, scales:{x:{ticks:{color:C.dim,font:{size:10},maxRotation:0,autoSkip:true,maxTicksLimit:10},grid:{display:false}}, y:{ticks:{color:C.dim,font:{size:10},display:!finMask.ops},grid:{color:C.border}}}})} height={200} />
        </div>
      )}

      {vis('ops.bills') && (
        <div style={S.panel}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
            <div style={{...S.panelTitle,marginBottom:0}}>Регулярные платежи</div>
            <button style={{background:'none',border:'none',color:billOpen?C.amber:C.dim,fontSize:12.5,cursor:'pointer',fontFamily:'inherit',display:'inline-flex',gap:4,alignItems:'center'}} onClick={()=>setBillOpen(o=>!o)}><Icon name="plus" size={14}/>Добавить</button>
          </div>
          {billOpen && (
            <div style={{display:'flex',gap:6,flexWrap:'wrap',margin:'8px 0'}}>
              <input style={{...S.input,flex:'1 1 140px'}} placeholder="Название" value={billName} aria-label="Название платежа" onChange={e=>setBillName(e.target.value)} />
              <input style={{...S.input,flex:'0 1 100px'}} inputMode="decimal" placeholder="Сумма" value={billAmount} aria-label="Сумма платежа" onChange={e=>setBillAmount(e.target.value)} />
              <input style={{...S.input,flex:'0 1 80px'}} type="number" min="1" max="31" placeholder="Число" value={billDay} aria-label="Число месяца" onChange={e=>setBillDay(e.target.value)} />
              <button style={S.iconBtnAmber} aria-label="Добавить платёж" onClick={()=>{ const a=parseFloat(String(billAmount).replace(',','.')), d=parseInt(billDay,10); if(billName.trim()&&!isNaN(a)&&!isNaN(d)){ addBill(billName.trim(),a,d); setBillName(''); setBillAmount(''); setBillDay(''); setBillOpen(false); } }}><Icon name="plus" size={18}/></button>
            </div>
          )}
          {bills.length===0 && !billOpen && <div style={S.emptyState}>Аренда, связь, подписки — добавь, и в нужный день придёт напоминание.</div>}
          {bills.map(b=>{ const dNow=parseInt(today.slice(8,10),10); const left=b.dayOfMonth>=dNow? b.dayOfMonth-dNow : null; return (
            <div key={b.id} style={S.taskRow}>
              <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:2}}>
                <span style={{fontSize:14}}>{b.name}</span>
                <span style={{fontSize:12,color:C.dim}}>каждое {b.dayOfMonth}-е{left===0?' · сегодня':left!=null?` · через ${left} дн.`:''}</span>
              </div>
              <span style={{fontVariantNumeric:'tabular-nums',fontWeight:600}}>{mo(b.amount)}</span>
              <button className="icon-btn" title={b.notify?'напоминание включено — выключить':'напоминать об этом платеже'} aria-label={b.notify?'Выключить напоминание':'Включить напоминание'} aria-pressed={!!b.notify}
                style={{color:b.notify?C.amber:C.faint}} onClick={()=>updateBill && updateBill(b.id,{notify:!b.notify})}><Icon name={b.notify?'bell':'bellOff'} size={17}/></button>
              <ConfirmIconBtn onConfirm={()=>deleteBill(b.id)} title="удалить платёж" confirmLabel="удалить?" />
            </div>); })}
          {bills.length>0 && <div style={{fontSize:12,color:C.dim,marginTop:8}}>Колокольчик — напоминать ежемесячно. Время — Настройки → Уведомления.</div>}
        </div>
      )}
    </div>
  );
}
