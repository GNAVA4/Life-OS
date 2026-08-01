// Вкладка «Финансы» — тонкий переключатель под-разделов. Сами разделы вынесены в tabs/finance/*
// (session 036: файл был 626 строк и держал 5 компонентов сразу).
import { useMemo, useState } from 'react';
import { todayStr } from '../lib/dates.js';
import { accountBalanceNow, unassignedNetOn } from '../lib/finance.js';
import { maskMoney } from '../lib/format.js';
import { S } from '../lib/styles.js';
import { C } from '../lib/theme.js';
import { AssetsSection } from './finance/AssetsSection.jsx';
import { DebtsSection } from './finance/DebtsSection.jsx';
import { OpsSection } from './finance/OpsSection.jsx';

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

