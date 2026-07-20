// Нативные локальные уведомления (Android через Capacitor). На вебе — no-op.
import { Capacitor } from '@capacitor/core';
// СТАТИЧЕСКИЙ импорт (раньше был ленивый import() — грузил отдельный чанк в WebView
// и мог вечно зависать; session 013→014 симптом «плашка висит на ⏳»).
// На вебе импорт безопасен: методы плагина просто бросают "not implemented" (мы это ловим).
import { LocalNotifications } from '@capacitor/local-notifications';

// синхронный доступ к плагину: сам плагин на нативе, иначе null
function ln(){ return Capacitor.isNativePlatform() ? LocalNotifications : null; }

// НИ ОДИН нативный вызов не должен висеть вечно — гонка с таймаутом.
function withTimeout(p, ms, label){
  return Promise.race([
    Promise.resolve(p),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout: «'+label+'» не ответил за '+ms+' мс (нативный мост молчит)')), ms)),
  ]);
}

const CHANNEL_ID = 'lifeos-reminders';
// Явный канал с высокой важностью — иначе на части устройств уведомления «тихие» или не всплывают.
async function ensureChannel(l){
  try{ await withTimeout(l.createChannel({ id:CHANNEL_ID, name:'Напоминания Life OS', description:'Привычки и напоминания', importance:5, visibility:1, vibration:true }), 4000, 'createChannel'); }catch(e){}
}
const isNotImpl = (e) => /not implemented|unimplemented/i.test((e && e.message) || String(e));

// диагностика для UI: нативность, загружен ли плагин, статус разрешения, число запланированных
export async function notifDiagnostics(){
  if(!Capacitor.isNativePlatform()) return { native:false };
  const l = ln(); if(!l) return { native:true, pluginLoaded:false };
  const out = { native:true, pluginLoaded:true };
  try{ const p = await withTimeout(l.checkPermissions(), 4000, 'checkPermissions'); out.permission = p.display; }
  catch(e){ out.error = isNotImpl(e) ? 'plugin-not-implemented (старый APK?)' : ((e&&e.message)||String(e)); return out; }
  try{ const pend = await withTimeout(l.getPending(), 4000, 'getPending'); out.pending = (pend.notifications||[]).length; }
  catch(e){ out.pendingError = (e&&e.message)||String(e); }
  return out;
}

// запрос разрешения (+создание канала). Возвращает {ok, display|reason, message?}
export async function requestNotif(){
  const l = ln(); if(!l) return { ok:false, reason:'web' };
  try{ const r = await withTimeout(l.requestPermissions(), 8000, 'requestPermissions'); await ensureChannel(l); return { ok: r.display==='granted', display:r.display }; }
  catch(e){ return { ok:false, reason: isNotImpl(e)?'not-implemented':'error', message:(e&&e.message)||String(e) }; }
}

// тест: запросить разрешение, запланировать уведомление через 5 секунд.
export async function testNotification(){
  const l = ln(); if(!l) return { ok:false, reason:'web' };
  try{
    const perm = await withTimeout(l.requestPermissions(), 8000, 'requestPermissions'); await ensureChannel(l);
    if(perm.display!=='granted') return { ok:false, reason:'denied', display:perm.display };
    await withTimeout(l.schedule({ notifications:[{ id:999001, title:'Life OS ✅', body:'Тест: уведомления работают! (через 5 сек)', channelId:CHANNEL_ID, schedule:{ at: new Date(Date.now()+5000), allowWhileIdle:true } }] }), 4000, 'schedule');
    return { ok:true };
  }catch(e){ return { ok:false, reason: isNotImpl(e)?'not-implemented':'error', message:(e&&e.message)||String(e) }; }
}

// ---- расчёт следующего срабатывания ----
// Используем ТОЛЬКО at (+ every) — на устройстве доказанно работает, в отличие от календарного on.
const HM = (s) => { const [h,m] = String(s||'').split(':').map(Number); return (isNaN(h)||isNaN(m)) ? null : [h,m]; };
function nextDaily(hh, mm){ const d=new Date(); d.setHours(hh,mm,0,0); if(d.getTime()<=Date.now()) d.setDate(d.getDate()+1); return d; }
function nextWeekly(weekday, hh, mm){ const d=new Date(); d.setHours(hh,mm,0,0); let diff=(weekday-d.getDay()+7)%7; if(diff===0 && d.getTime()<=Date.now()) diff=7; d.setDate(d.getDate()+diff); return d; }
function nextMonthly(dom, hh, mm){ const d=new Date(); d.setHours(hh,mm,0,0); d.setDate(dom); if(d.getTime()<=Date.now()){ d.setMonth(d.getMonth()+1); d.setDate(dom); } return d; }
// JS getDay(): 0=Вс..6=Сб

// Разнообразные тексты уведомлений привычек. Тело фиксируется на момент планирования и
// живёт до следующей пересборки расписания (каждый запуск приложения) — так фразы меняются со временем.
const pick = (a) => a[Math.floor(Math.random()*a.length)];
const HABIT_TITLES = ['Привычка 🔁', 'Не забудь 💪', 'Пора! ⏰', 'Life OS 🎯'];
function habitBody(h){
  const s = h.streak || 0;
  const generic = [
    `Не забудь сегодня: ${h.name}`,
    `${h.name} — сделай это сегодня!`,
    `Время привычки: ${h.name}`,
    `Не пропусти: ${h.name} 💪`,
    `Отметь сегодня: ${h.name}`,
  ];
  // «умные» варианты — только если стрик значимый (≥7)
  const streaky = s>=7 ? [
    `🔥 ${s} дней подряд! Не оборви стрик: ${h.name}`,
    `Рискуешь потерять стрик ${s} дн. — ${h.name}`,
    `${s} дней стрика на кону: ${h.name}`,
    `Держишь ${s} дней! Продолжай: ${h.name}`,
  ] : [];
  return (streaky.length && Math.random()<0.6) ? pick(streaky) : pick(generic);
}

function habitNotifs(habits){
  const out = [];
  habits.forEach((h, hi) => {
    const hm = HM(h.reminderTime); if(!hm) return;
    const [hh,mm] = hm;
    if(h.schedule && h.schedule.type==='weekdays'){
      (h.schedule.days||[]).forEach((d, di) => {
        out.push({ id: 100000 + hi*10 + di, title:pick(HABIT_TITLES), body:habitBody(h), channelId:CHANNEL_ID,
          schedule:{ at: nextWeekly(d,hh,mm), every:'week', allowWhileIdle:true } });
      });
    } else {
      out.push({ id: 100000 + hi*10, title:pick(HABIT_TITLES), body:habitBody(h), channelId:CHANNEL_ID,
        schedule:{ at: nextDaily(hh,mm), every:'day', allowWhileIdle:true } });
    }
  });
  return out;
}

function noteNotifs(notes){
  const out = [];
  notes.filter(n => n.type==='Напоминание').forEach((n, ni) => {
    const hm = HM(n.remindTime || '09:00'); if(!hm) return;
    const [hh,mm] = hm;
    const rep = n.repeat || 'none';
    const body = (n.title && n.title.trim()) || (n.body||'').slice(0,80) || 'Напоминание';
    const base = { id: 200000 + ni, title:'Напоминание ⏰', body, channelId:CHANNEL_ID };
    if(rep==='daily'){
      out.push({ ...base, schedule:{ at: nextDaily(hh,mm), every:'day', allowWhileIdle:true } });
    } else if(rep==='weekly'){
      const wd = (typeof n.remindWeekday==='number') ? n.remindWeekday
               : (n.remindDate ? new Date(n.remindDate+'T00:00:00').getDay() : null);
      if(wd==null) return;
      out.push({ ...base, schedule:{ at: nextWeekly(wd,hh,mm), every:'week', allowWhileIdle:true } });
    } else if(rep==='monthly'){
      const dom = (typeof n.remindDay==='number' && n.remindDay>=1) ? n.remindDay
                : (n.remindDate ? new Date(n.remindDate+'T00:00:00').getDate() : null);
      if(dom==null) return;
      out.push({ ...base, schedule:{ at: nextMonthly(dom,hh,mm), every:'month', allowWhileIdle:true } });
    } else {
      if(!n.remindDate) return;
      const at = new Date(n.remindDate+'T00:00:00'); at.setHours(hh,mm,0,0);
      if(at.getTime() <= Date.now()) return; // прошедшее одноразовое — не планируем
      out.push({ ...base, schedule:{ at, allowWhileIdle:true } });
    }
  });
  return out;
}

// Дедлайны дел: за N дней до + в день дедлайна, в указанное время. Одноразовые at (прошедшие — скип).
function deadlineNotifs(study, cfg){
  if(!cfg || cfg.off) return [];
  const hm = HM(cfg.time || '09:00'); if(!hm) return [];
  const [hh,mm] = hm;
  const days = (cfg.days && cfg.days.length) ? cfg.days : [3,1];
  const offsets = Array.from(new Set([0, ...days])).sort((a,b)=>a-b); // 0 = день дедлайна
  const out = [];
  study.filter(s => s.deadline && s.status!=='Выполнено').forEach((s, si) => {
    offsets.forEach((off, oi) => {
      const at = new Date(s.deadline+'T00:00:00'); at.setHours(hh,mm,0,0); at.setDate(at.getDate()-off);
      if(at.getTime() <= Date.now()) return;
      const when = off===0 ? 'сегодня дедлайн' : `дедлайн через ${off} дн.`;
      out.push({ id: 300000 + si*10 + oi, title:'Дедлайн ⏰', body:`${s.task} — ${when}`, channelId:CHANNEL_ID,
        schedule:{ at, allowWhileIdle:true } });
    });
  });
  return out;
}

// 💸 Регулярные платежи: ежемесячное напоминание для платежей с notify, за leadDays дней до dayOfMonth.
function billNotifs(bills, cfg){
  if(!cfg || cfg.off) return [];
  const hm = HM(cfg.time || '09:00'); if(!hm) return [];
  const [hh,mm] = hm;
  const lead = (cfg.leadDays!=null && cfg.leadDays>=0) ? cfg.leadDays : 1;
  const out = [];
  (bills||[]).filter(b=>b.notify).forEach((b, bi) => {
    const dom = parseInt(b.dayOfMonth,10); if(isNaN(dom)||dom<1) return;
    const at = nextMonthly(dom, hh, mm);
    if(lead>0) at.setDate(at.getDate()-lead);
    if(at.getTime() <= Date.now()) at.setMonth(at.getMonth()+1); // сдвинули в прошлое — планируем на следующий месяц
    const when = lead>0 ? `через ${lead} дн. (${dom} числа)` : `сегодня (${dom} числа)`;
    out.push({ id: 500000 + bi, title:'💸 Платёж', body:`${b.name} — ${when}`, channelId:CHANNEL_ID,
      schedule:{ at, every:'month', allowWhileIdle:true } });
  });
  return out;
}

// 🌅 Утренняя сводка: одно ежедневное уведомление в заданное время с краткой сводкой дня.
// Тело (body) считается в App (сколько привычек/дедлайнов/напоминаний сегодня) и фиксируется на момент
// планирования — обновляется при каждом запуске приложения (пересборка расписания).
function morningSummaryNotif(cfg, body){
  if(!cfg || cfg.off) return [];
  const hm = HM(cfg.time || '08:00'); if(!hm) return [];
  const [hh,mm] = hm;
  return [{ id:400000, title:'🌅 План на день', body: body || 'Загляни в Life OS — спланируй день', channelId:CHANNEL_ID,
    schedule:{ at: nextDaily(hh,mm), every:'day', allowWhileIdle:true } }];
}

// пересобрать ВСЕ уведомления (снять запланированные, потом запланировать заново). Возвращает число запланированных (-1 при ошибке планирования).
export async function syncNotifications({ habits=[], notes=[], study=[], bills=[], deadlineCfg=null, morningCfg=null, billsCfg=null, morningBody='', enabled=true }){
  const l = ln(); if(!l) return 0;
  await ensureChannel(l);
  try{ const pend = await withTimeout(l.getPending(), 4000, 'getPending'); if(pend.notifications && pend.notifications.length) await withTimeout(l.cancel({ notifications: pend.notifications.map(n=>({id:n.id})) }), 4000, 'cancel'); }catch(e){}
  if(!enabled) return 0;
  const list = [...habitNotifs(habits), ...noteNotifs(notes), ...deadlineNotifs(study, deadlineCfg), ...billNotifs(bills, billsCfg), ...morningSummaryNotif(morningCfg, morningBody)];
  if(list.length){ try{ await withTimeout(l.schedule({ notifications: list }), 4000, 'schedule'); }catch(e){ return -1; } }
  return list.length;
}
