// Дата/время-хелперы. ⚠️ toISOString() — ловушка (UTC-сдвиг); всегда через toLocalISODate.
export const toLocalISODate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const todayStr = () => toLocalISODate(new Date());
export const addDays = (ds,n) => { const d=new Date(ds+'T00:00:00'); d.setDate(d.getDate()+n); return toLocalISODate(d); };
export const daysAgoStr = (n) => addDays(todayStr(), -n);
export const isoWeek = (ds) => {
  const d=new Date(ds+'T00:00:00'); const t=new Date(d.valueOf());
  const dayNr=(d.getDay()+6)%7; t.setDate(t.getDate()-dayNr+3);
  const first=new Date(t.getFullYear(),0,4); const diff=t-first;
  return `${t.getFullYear()}-W${String(1+Math.round(diff/(7*864e5))).padStart(2,'0')}`;
};
export const daysBetween = (a,b) => Math.round((new Date(b+'T00:00:00') - new Date(a+'T00:00:00'))/864e5);
export const formatDateRu = (ds) => new Date(ds+'T00:00:00').toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'});
export const formatDateShort = (ds) => new Date(ds+'T00:00:00').toLocaleDateString('ru-RU',{weekday:'short',day:'numeric',month:'short'});
export const openDatePicker = (e) => { try{ e.target.showPicker && e.target.showPicker(); }catch(err){} };
export const shiftMonth = (ym,n) => { const [y,m]=ym.split('-').map(Number); const d=new Date(y, m-1+n, 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
export const monthLabelRu = (ym) => { const [y,m]=ym.split('-').map(Number); return new Date(y,m-1,1).toLocaleDateString('ru-RU',{month:'long',year:'numeric'}); };
// период цели по скоупу: неделя '2026-W29', месяц '2026-07', год '2026'
export const periodOf = (scope, ds=todayStr()) => scope==='week'?isoWeek(ds) : scope==='month'?ds.slice(0,7) : scope==='year'?ds.slice(0,4) : null;
