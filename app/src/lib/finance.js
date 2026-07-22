// Финансы: расчётные балансы счетов по снапшотам+операциям, нераспределённый пул, миграция планов.
import { todayStr } from './dates.js';

const snapshotValueRub = (s) => s.currency==='USD' ? s.amount*(s.rate||90) : s.amount;
export { snapshotValueRub };
// расчётный баланс счёта на дату: последний замер ≤ даты + операции этого счёта после замера.
export const accountBalanceOn = (account, transactions, date) => {
  const past = account.snapshots.filter(s=>s.date<=date).sort((a,b)=> b.date.localeCompare(a.date) || (b.ts||0)-(a.ts||0));
  const anchor = past[0];
  const base = anchor ? snapshotValueRub(anchor) : 0;
  const countsAfterAnchor = (t) => {
    if(t.date!==anchor.date) return t.date>anchor.date;
    if(t.ts==null || anchor.ts==null) return true;
    return t.ts>=anchor.ts;
  };
  // debtFlow-операции (возврат/взятие долга) НЕ считаются доходом/расходом (exclude:true → выпадают из
  // всей P&L-статистики), но РЕАЛЬНО двигают баланс счёта → здесь учитываем их наравне с обычными. session 028c.
  const net = transactions
    .filter(t=>t.accountId===account.id && (!t.exclude || t.debtFlow) && t.date<=date && (!anchor || countsAfterAnchor(t)))
    .reduce((s,t)=> s + (t.type==='income'?t.amount:-t.amount), 0);
  return base + net;
};
// «текущий» баланс счёта: считаем на дату max(сегодня, самый свежий снапшот этого счёта).
export const accountBalanceNow = (account, transactions) => {
  const asOf = account.snapshots.reduce((m,s)=> s.date>m ? s.date : m, todayStr());
  return accountBalanceOn(account, transactions, asOf);
};
// «нераспределённый» пул: чистый поток операций БЕЗ счёта (доход +, расход −) на дату.
// debtFlow учитываем (реальное движение денег), хоть в доход/расход они и не идут (exclude:true). session 028c.
export const unassignedNetOn = (transactions, date) => transactions
  .filter(t=> !t.accountId && (!t.exclude || t.debtFlow) && t.date<=date)
  .reduce((s,t)=> s + (t.type==='income'?t.amount:-t.amount), 0);

// Планы (budgets/incomePlans) помесячные: {YYYY-MM:{cat:план}}. Миграция плоской формы -> текущий месяц.
export const migratePlans = (obj) => {
  if(!obj || typeof obj!=='object' || Array.isArray(obj)) return {};
  const vals=Object.values(obj); if(vals.length===0) return {};
  const nested = vals.every(v=> v && typeof v==='object' && !Array.isArray(v));
  return nested ? obj : { [todayStr().slice(0,7)]: obj };
};
