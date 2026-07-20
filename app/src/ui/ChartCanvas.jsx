// Императивная обёртка Chart.js: пересоздаёт инстанс при смене data/options/type. Регистрация Chart — в App.jsx.
import { useRef, useEffect } from 'react';
import { Chart } from 'chart.js';

export function ChartCanvas({type, data, options, height=210}){
  const ref = useRef(null); const chartRef = useRef(null);
  useEffect(() => {
    if(!ref.current) return;
    if(chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(ref.current.getContext('2d'), { type, data, options });
    return () => { if(chartRef.current) chartRef.current.destroy(); };
  }, [JSON.stringify(data), JSON.stringify(options), type]);
  return <div style={{width:'100%',height}}><canvas ref={ref}></canvas></div>;
}
