// Ползунок оценки дня (s055, запрос пользователя: «оценку легко случайно сдвинуть»).
// Отличия от <input type=range>: нажатие на дорожку НИЧЕГО не меняет — двигать можно только взявшись за бегунок,
// и он идёт от того места, где стоял (смещение пальца, а не прыжок под палец). Лёгкая вибрация при переходе
// через каждое целое число. Клавиатура: стрелки ±0,1, Home/End — 1/10; запись — по отпусканию (onCommit).
import { useRef } from 'react';
import { haptic } from '../lib/haptics.js';
import { C } from '../lib/theme.js';

const MIN = 1, MAX = 10, STEP = 0.1;
const clampRound = (v) => Math.round(Math.min(MAX, Math.max(MIN, v)) / STEP) * STEP;
const norm = (v) => Math.round(v * 10) / 10;   // убрать хвосты плавающей точки (7.000000001)
// Где стоит бегунок, пока день не оценён (посередине шкалы, полупрозрачный) — как было у прежнего ползунка.
const EMPTY_AT = 5;

export function RatingSlider({ value, onChange, onCommit, label = 'Оценка дня от 1 до 10' }){
  const trackRef = useRef(null);
  const drag = useRef(null);           // {startX, startV, width, last}
  const cur = value ?? EMPTY_AT;
  const pct = (cur - MIN) / (MAX - MIN) * 100;

  const set = (v) => { const n = norm(clampRound(v));
    if(drag.current){ if(Math.floor(n) !== Math.floor(drag.current.last)) haptic('tap'); drag.current.last = n; }
    onChange(n); return n; };

  const down = (e) => {
    const el = trackRef.current; if(!el) return;
    e.preventDefault(); e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch(_) {}
    drag.current = { startX: e.clientX, startV: cur, width: el.getBoundingClientRect().width || 1, last: cur };
    haptic('tap');
    if(value == null) onChange(cur);   // взялся за «пустой» бегунок — оценка стала 5, дальше ведём
  };
  const move = (e) => { const d = drag.current; if(!d) return;
    set(d.startV + (e.clientX - d.startX) / d.width * (MAX - MIN)); };
  const up = () => { const d = drag.current; if(!d) return; drag.current = null; onCommit(d.last); };

  const key = (e) => {
    const map = { ArrowRight: STEP, ArrowUp: STEP, ArrowLeft: -STEP, ArrowDown: -STEP };
    if(map[e.key] != null){ e.preventDefault(); set(cur + map[e.key]); }
    else if(e.key === 'Home'){ e.preventDefault(); set(MIN); }
    else if(e.key === 'End'){ e.preventDefault(); set(MAX); }
  };

  return (
    <div ref={trackRef} style={{ position:'relative', height:28, margin:'0 10px', opacity: value == null ? .45 : 1 }}>
      <div style={{ position:'absolute', left:0, right:0, top:12, height:4, borderRadius:4, background:C.panelAlt }}/>
      <div style={{ position:'absolute', left:0, top:12, height:4, borderRadius:4, background:C.amber, width:`${pct}%` }}/>
      {/* видимый бегунок 20px, область захвата 44px — чтобы было за что взяться пальцем */}
      <div role="slider" tabIndex={0} aria-label={label} aria-valuemin={MIN} aria-valuemax={MAX}
        aria-valuenow={value ?? undefined} aria-valuetext={value == null ? 'не оценён' : String(value).replace('.', ',')}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onKeyDown={key} onKeyUp={() => value != null && onCommit(value)}
        style={{ position:'absolute', left:`${pct}%`, top:-8, width:44, height:44, marginLeft:-22, display:'grid', placeItems:'center',
          cursor:'grab', touchAction:'none', outline:'none' }}>
        <span style={{ width:20, height:20, borderRadius:'50%', background:C.text, boxShadow:'0 0 0 4px rgba(227,162,76,.35)' }}/>
      </div>
    </div>
  );
}
