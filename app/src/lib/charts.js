// Общие опции Chart.js (тёмная тема из токенов C).
import { C } from './theme.js';

export const axisColor = C.dim;
export const gridColor = C.border;
export const baseChartOpts = (extra={}) => ({
  responsive:true, maintainAspectRatio:false,
  plugins:{ legend:{display:false}, tooltip:{backgroundColor:C.panelAlt, borderColor:C.border, borderWidth:1} },
  scales:{ x:{ticks:{color:axisColor,font:{size:10}},grid:{color:gridColor}}, y:{ticks:{color:axisColor,font:{size:10}},grid:{color:gridColor}} },
  ...extra
});
