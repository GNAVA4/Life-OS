// Форматирование чисел/денег + генератор id.
export const fmtMoney = (n) => (Math.round(n)||0).toLocaleString('ru-RU')+' ₽';
// приватность: если hidden — показываем ••••••, иначе сумму. session 022.
export const maskMoney = (hidden, n) => hidden ? '••••••' : fmtMoney(n);
export const uid = () => Math.random().toString(36).slice(2,10);
// Компактное число для заголовков (1000000 -> «1 млн», 3500 -> «3.5к»).
export const compactNum = (n) => n>=1e6 ? String(n/1e6).replace(/\.0$/,'')+' млн' : n>=1e3 ? String(n/1e3).replace(/\.0$/,'')+'к' : String(n);
