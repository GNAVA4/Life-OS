// Цветовые токены темы — единственный источник палитры. Используются везде через C.*
// Редизайн «Тихий» (session 043, ADR-005): графитовый фон, один медовый акцент, смысловые цвета отдельно.
// Имена ключей сохранены (amber/cyan/…), чтобы весь код перекрасился без правок: amber = акцент,
// cyan = информационный синий, red/green = плохо/хорошо. panel/panelAlt = поверхности 1/2.
export const C = {
  bg:'#111214', panel:'#18191C', panelAlt:'#202226', border:'#26282C',
  text:'#ECEDEE', dim:'#8B8F97', faint:'#5C6068',
  amber:'#E3A24C', cyan:'#7EA6E0', red:'#E26D5F', green:'#6BC28F', purple:'#B48CD9',
};
// Полупрозрачная подложка смыслового цвета (чипы, плашки): tint(C.red, .14)
export const tint = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
export const PIE_COLORS = [C.amber,C.cyan,C.green,C.purple,C.red,'#D98E5C','#7FC4C0','#C9B26B'];
