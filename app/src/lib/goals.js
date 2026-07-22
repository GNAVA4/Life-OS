// Привязка «выполнил → вклад в цель»: опции пикера, поиск цели по ключу, нормализация ссылок.
import { GL_SCOPE } from './constants.js';

export const goalLinkOptions = (goals) => { const out=[{value:'',label:'— без привязки —'}];
  ['year','month','week','day'].forEach(sc=>(goals[sc]||[]).forEach(g=>out.push({value:`${sc}|${g.id}`,
    label:`${GL_SCOPE[sc]}: ${g.title}${goalMode(g)==='counter'&&g.counter?` (${g.counter.current||0}/${g.counter.target})`:''}`}))); return out; };
export const goalByKey = (goals, key) => { if(!key) return null; const [sc,gid]=key.split('|'); return (goals[sc]||[]).find(g=>g.id===gid)||null; };
// нормализация: новая модель goalLinks (массив) ИЛИ легаси goalLink (один) → всегда массив. session 015.
export const goalLinksOf = (item) => item && Array.isArray(item.goalLinks) ? item.goalLinks : (item && item.goalLink ? [item.goalLink] : []);
// активный режим цели: none | slider | subtasks | counter. legacy: undefined mode + counter/subtasks → выводим.
// ВАЖНО: с session 026 setGoalMode НЕ стирает counter/subtasks при смене типа, поэтому различать
// «штуки vs %» нужно по mode, а НЕ по наличию g.counter (иначе %-цель со старым counter считается в штуках).
export const goalMode = (g) => g && g.mode ? g.mode : (g && g.counter ? 'counter' : g && g.subtasks ? 'subtasks' : 'slider');
