// Вкладка «Финансы» — переключатель под-разделов (session 036). Редизайн «Тихий» — session 043 (Э6–Э6г):
// Операции (быстрый ввод + список) · Обзор (алерты, графики, планы, платежи) · Счета · Долги.
// Месяц просмотра общий для Операций и Обзора. Глаз — быстро скрыть/показать все суммы (maskAllFinance);
// тонкие флаги приватности по-прежнему в Настройках.
import { useMemo, useState } from 'react';
import { todayStr } from '../lib/dates.js';
import { accountBalanceNow, unassignedNetOn } from '../lib/finance.js';
import { maskMoney } from '../lib/format.js';
import { S } from '../lib/styles.js';
import { C } from '../lib/theme.js';
import { Icon } from '../ui/Icon.jsx';
import { AssetsSection } from './finance/AssetsSection.jsx';
import { DebtsSection } from './finance/DebtsSection.jsx';
import { OpsSection } from './finance/OpsSection.jsx';

const SUBS = [{id:'ops',label:'Операции'},{id:'overview',label:'Обзор'},{id:'assets',label:'Счета'},{id:'debtors',label:'Долги'}];

export function FinanceTab(props){
  const {finance, finMask={}, setSettingFlag, maskAll=false} = props;
  const mo = n => maskMoney(finMask.ops, n);
  const [sub,setSub] = useState('ops');
  const today = todayStr();
  const [viewMonth,setViewMonth] = useState(today.slice(0,7));
  const netWorth = useMemo(()=> finance.accounts.reduce((sum,a)=> sum + accountBalanceNow(a, finance.transactions), 0) + unassignedNetOn(finance.transactions, todayStr()), [finance.accounts, finance.transactions]);
  const monthTx = useMemo(()=> finance.transactions.filter(t=>t.date.slice(0,7)===today.slice(0,7)), [finance.transactions]);
  const monthIncome = monthTx.filter(t=>t.type==='income'&&!t.exclude).reduce((s,t)=>s+t.amount,0);
  const monthExpense = monthTx.filter(t=>t.type==='expense'&&!t.exclude).reduce((s,t)=>s+t.amount,0);
  const tile = (label, val, color) => (
    <div style={{...S.statCard,padding:'10px 12px',minWidth:0}}>
      <div style={{fontSize:11.5,color:C.dim}}>{label}</div>
      <div style={{fontSize:16,fontWeight:700,fontVariantNumeric:'tabular-nums',color:color||C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{val}</div>
    </div>
  );

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8,marginBottom:14}}>
        {tile('Доход · месяц', mo(monthIncome), C.green)}
        {tile('Расход · месяц', mo(monthExpense))}
        {tile('Чистые активы', maskMoney(finMask.net, netWorth))}
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:18}}>
        <div style={{...S.seg,flex:1}}>
          {SUBS.map(({id,label})=>(
            <button key={id} onClick={()=>setSub(id)} aria-pressed={sub===id}
              style={{...S.segBtn,flex:1,padding:'7px 4px',background:sub===id?C.panelAlt:'transparent',color:sub===id?C.text:C.dim}}>{label}</button>))}
        </div>
        {setSettingFlag && (
          <button className="icon-btn" onClick={()=>setSettingFlag('maskAllFinance', !maskAll)} aria-pressed={maskAll}
            title={maskAll?'Показать суммы':'Скрыть все суммы'} aria-label={maskAll?'Показать суммы':'Скрыть все суммы'}
            style={{width:38,height:38,borderRadius:10,background:C.panel,justifyContent:'center',alignItems:'center',color:maskAll?C.amber:C.dim}}>
            <Icon name={maskAll?'eyeOff':'eye'} size={18}/></button>
        )}
      </div>
      {(sub==='ops' || sub==='overview') && <OpsSection {...props} part={sub} viewMonth={viewMonth} setViewMonth={setViewMonth} monthTx={monthTx} />}
      {sub==='assets' && <AssetsSection accounts={finance.accounts} transactions={finance.transactions} finMask={finMask} netWorth={netWorth} addAccount={props.addAccount} deleteAccount={props.deleteAccount} addSnapshot={props.addSnapshot} deleteSnapshot={props.deleteSnapshot} />}
      {sub==='debtors' && <DebtsSection debtors={finance.debtors} transactions={finance.transactions} accounts={finance.accounts} mask={finMask.debts} addDebt={props.addDebt} updateDebt={props.updateDebt} deleteDebt={props.deleteDebt} debtMovement={props.debtMovement} />}
    </div>
  );
}
