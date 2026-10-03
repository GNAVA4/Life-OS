// Безопасный вход в аккаунт (session 042). Чистая логика — под node-тестом.
//
// Раньше при входе облако молча побеждало по КАЖДОМУ ключу, который в нём уже есть. Если устройство
// пожило без входа (вышел / слетела авторизация) и успело накопить данные, они затирались. Теперь
// молча принимаем облако только когда устройство и так было в синке с ЭТИМ аккаунтом и ничего не
// писало мимо облака; иначе — если стороны расходятся — спрашиваем пользователя.

// Служебные ключи синка. Префикс НЕ 'lifeos:' нарочно: экспорт/импорт JSON берёт только 'lifeos:*',
// и бэкап не должен переносить «с каким аккаунтом это устройство синкалось».
export const SYNCED_UID_KEY = 'lifeos-sync:uid';   // uid, с которым устройство последний раз согласовано
export const DIRTY_KEY = 'lifeos-sync:dirty';      // ключи, записанные, пока входа не было

// Сколько ждать подтверждения сервера на запись снимка/данных. Нормальный ответ на мобильной сети — секунды;
// 20 с отделяет «нет связи» от «медленно». По таймауту записи НЕ отменяются (Firestore держит их в очереди),
// просто перестаём ждать.
export const SYNC_ACK_MS = 20000;
export function withTimeout(p, ms){
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

export function loadDirty(storage){
  try{ const a = JSON.parse(storage.getItem(DIRTY_KEY) || '[]'); return Array.isArray(a) ? a : []; }catch(e){ return []; }
}
export function markDirty(storage, key){
  const d = loadDirty(storage);
  if(d.includes(key)) return;
  try{ storage.setItem(DIRTY_KEY, JSON.stringify([...d, key])); }catch(e){}
}
export function markSynced(storage, uid){
  try{ storage.setItem(SYNCED_UID_KEY, uid); storage.removeItem(DIRTY_KEY); }catch(e){}
}
export function clearSynced(storage){
  try{ storage.removeItem(SYNCED_UID_KEY); }catch(e){}
}

// local/cloud: { 'lifeos:key': valueString } (отсутствующий ключ = нет данных на этой стороне)
export function diffSides(local, cloud, keys){
  const diff = [], localOnly = [], cloudOnly = [];
  for(const k of keys){
    const l = local[k], c = cloud[k];
    if(l == null && c == null) continue;
    if(c == null) localOnly.push(k);
    else if(l == null) cloudOnly.push(k);
    else if(l !== c) diff.push(k);
  }
  return { diff, localOnly, cloudOnly };
}

// mode 'adopt' — облако принимается по ключам, которые в нём есть, недостающие досеваются с устройства
//                (прежнее поведение; безопасно, когда устройство уже было в синке или стороны совпадают);
// mode 'ask'   — устройство «свежее» для этого аккаунта И стороны расходятся → решает пользователь.
export function planSync({ uid, syncedUid, dirty, local, cloud, keys }){
  const d = diffSides(local, cloud, keys);
  const fresh = syncedUid !== uid || (dirty && dirty.length > 0);
  return { mode: fresh && d.diff.length > 0 ? 'ask' : 'adopt', fresh, ...d };
}

// Что отправить в облако после выбора стороны. 'cloud' — только то, чего в облаке нет (досев);
// 'device' — всё, чем устройство отличается от облака.
export function keysToPush(local, cloud, keys, prefer){
  return keys.filter(k => local[k] != null && (prefer === 'device' ? cloud[k] !== local[k] : cloud[k] == null));
}

// Короткая сводка стороны для диалога: сколько дней записано и какой последний.
export function sideSummary(values){
  let days = 0, lastDay = null, ops = 0;
  try{
    const dd = JSON.parse(values['lifeos:days'] || '{}');
    const ks = Object.keys(dd || {}).sort();
    days = ks.length; lastDay = ks.length ? ks[ks.length - 1] : null;
  }catch(e){}
  try{
    const f = JSON.parse(values['lifeos:finance'] || '{}');
    ops = (f && Array.isArray(f.transactions)) ? f.transactions.length : 0;
  }catch(e){}
  return { days, lastDay, ops };
}

export const KEY_LABELS = {
  'lifeos:days':'Дни (задачи, оценки, заметки дня)', 'lifeos:dailyTasks':'Ежедневные', 'lifeos:ongoingTasks':'На несколько дней',
  'lifeos:tags':'Теги', 'lifeos:antiTags':'Анти-теги', 'lifeos:goals':'Цели', 'lifeos:goalsArchive':'Архив целей',
  'lifeos:study':'Дела', 'lifeos:studyArchive':'Архив дел', 'lifeos:notes':'Заметки', 'lifeos:categories':'Категории',
  'lifeos:budgets':'Планы расходов', 'lifeos:incomePlans':'Планы доходов', 'lifeos:recurringBills':'Регулярные платежи',
  'lifeos:finance':'Финансы', 'lifeos:meta':'XP и здоровье', 'lifeos:settings':'Настройки', 'lifeos:achievements':'Достижения',
  'lifeos:habits':'Привычки', 'lifeos:habitsArchive':'Архив привычек', 'lifeos:taskTemplates':'Шаблоны задач',
};
