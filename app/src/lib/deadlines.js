// Просроченные дела: чистая логика текста напоминаний (планирование — в notifications.js).
// Вынесено в lib/, чтобы покрывалось node-тестом: до этого просрочка не напоминала о себе ВООБЩЕ
// (одноразовый `at` оказывался в прошлом и отбрасывался планировщиком).
import { daysBetween } from './dates.js';

const plural = (n, forms) => { const a=Math.abs(n)%100, b=a%10;
  return forms[(a>10&&a<20)||b===0||b>4 ? 2 : b===1 ? 0 : 1]; };
const dayWord = (n) => `${n} ${plural(n,['день','дня','дней'])}`;

// невыполненные дела с истёкшим дедлайном, самые старые первыми
export const overdueOf = (study, today) => (study||[])
  .filter(s => s.deadline && s.status!=='Выполнено' && s.deadline < today)
  .sort((a,b)=> a.deadline<b.deadline ? -1 : a.deadline>b.deadline ? 1 : 0);

// Одно тело уведомления на ВСЕ просроченные дела: их число ничем не ограничено, а лимит
// запланированных уведомлений у Android — ограничен (плюс 20 пушек подряд = шум, а не мотивация).
// Текст эскалирует: чем дольше просрочка, тем больше дней в сообщении.
export const overdueBody = (overdue, today) => {
  if(!overdue.length) return '';
  const late = (s) => daysBetween(s.deadline, today);
  if(overdue.length===1) return `${overdue[0].task} — просрочено на ${dayWord(late(overdue[0]))}!`;
  const head = overdue.slice(0,3).map(s=>`${s.task} (${dayWord(late(s))})`).join(', ');
  const rest = overdue.length>3 ? ` и ещё ${overdue.length-3}` : '';
  return `Просрочено ${overdue.length} ${plural(overdue.length,['дело','дела','дел'])}: ${head}${rest}`;
};
