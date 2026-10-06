// Строка со свайпом в стороны (s055, запрос пользователя для «Дел»: вправо — в архив, влево — удалить).
// Свайп только ВЗВОДИТ действие: строка отъезжает и открывает кнопку («В архив» / «Удалить»), выполняется оно
// нажатием на эту кнопку — то же двухшаговое подтверждение, что у ConfirmIconBtn. Нажатие на саму строку — отмена.
// Только палец/стилус: мышью на ПК остаются прежние кнопки в форме правки.
// touch-action: pan-y — вертикальную прокрутку страницы ведёт браузер, горизонтальный ход достаётся нам.
import { useRef, useState } from 'react';
import { haptic } from '../lib/haptics.js';
import { C, tint } from '../lib/theme.js';
import { Icon } from './Icon.jsx';

// LOCK_PX — после какого хода решаем, что это свайп, а не нажатие/прокрутка (больше дрожания пальца при тапе).
// ARM_PX — насколько дотянуть, чтобы действие взвелось (~пятая часть ширины телефона: случайно не дотянешь).
// OPEN_PX — ширина открытой кнопки (влезает иконка + «В архив»).
// SWALLOW_MS — сколько после отпускания гасить клик, который браузер может прислать за сам жест. Свой клик
// он шлёт сразу (единицы мс); 100 мс короче любого осознанного повторного нажатия.
const LOCK_PX = 10, ARM_PX = 72, OPEN_PX = 112, SWALLOW_MS = 100;

export function SwipeRow({ open, onOpen, onClose, right, left, children }){
  // right/left — действия свайпа ВПРАВО / ВЛЕВО: {label, icon, color, onConfirm}
  const [dx,setDx] = useState(0);   // только для отрисовки во время хода
  const g = useRef(null);            // {x, y, locked, id}
  const upAt = useRef(0);            // когда закончился последний свайп (погасить его «хвостовой» клик)
  const shown = g.current?.locked ? dx : open === 'right' ? OPEN_PX : open === 'left' ? -OPEN_PX : 0;

  const down = (e) => { if(e.pointerType === 'mouse') return; g.current = { x:e.clientX, y:e.clientY, locked:false, id:e.pointerId, base:shown }; };
  const move = (e) => { const s = g.current; if(!s) return;
    const mx = e.clientX - s.x, my = e.clientY - s.y;
    if(!s.locked){
      if(Math.abs(my) > LOCK_PX && Math.abs(my) >= Math.abs(mx)){ g.current = null; return; }   // это прокрутка
      if(Math.abs(mx) < LOCK_PX) return;
      s.locked = true; try { e.currentTarget.setPointerCapture(s.id); } catch(_) {}
    }
    let v = s.base + mx;
    if(!right) v = Math.min(0, v); if(!left) v = Math.max(0, v);
    s.cur = Math.max(-OPEN_PX*1.4, Math.min(OPEN_PX*1.4, v));
    setDx(s.cur);
  };
  // при отпускании берём ход из ref: последний pointermove мог ещё не дойти до state (React копит такие события)
  const up = () => { const s = g.current; g.current = null; if(!s || !s.locked) return; const dx = s.cur ?? s.base;
    upAt.current = Date.now();
    if(dx >= ARM_PX && right){ if(open !== 'right') haptic('tap'); onOpen('right'); }
    else if(dx <= -ARM_PX && left){ if(open !== 'left') haptic('warn'); onOpen('left'); }
    else onClose();
    setDx(0);
  };
  const clickCapture = (e) => {
    const tail = Date.now() - upAt.current < SWALLOW_MS;
    if(tail || open){ e.preventDefault(); e.stopPropagation(); if(!tail) onClose(); }   // открыта — нажатие по строке = отмена
  };

  const act = shown > 0 ? right : shown < 0 ? left : null;
  const armed = act && (Math.abs(shown) >= ARM_PX);
  return (
    <div style={{ position:'relative', overflow:'hidden' }}>
      {act && (
        <div style={{ position:'absolute', inset:0, display:'flex', justifyContent: shown > 0 ? 'flex-start' : 'flex-end', background: armed ? tint(act.color,.22) : tint(act.color,.1) }}>
          <button aria-label={act.label} onClick={()=>{ onClose(); act.onConfirm(); }} disabled={!open}
            style={{ width:OPEN_PX, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, background:'none', border:'none',
              color:act.color, fontFamily:'inherit', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            <Icon name={act.icon} size={18}/>{act.label}
          </button>
        </div>
      )}
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClickCapture={clickCapture}
        style={{ position:'relative', background:C.bg, touchAction:'pan-y', transform:`translateX(${shown}px)`,
          transition: g.current?.locked ? 'none' : 'transform .18s ease' }}>
        {children}
      </div>
    </div>
  );
}
