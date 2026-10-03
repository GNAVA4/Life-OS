// Переиспользуемые UI-примитивы (WebView-safe): Select, Modal, ConfirmIconBtn, разделы настроек, статус-сегмент.
// Редизайн «Тихий» (session 043): иконки из ui/Icon вместо символов ✕ ▾, мягкие поверхности без рамок.
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { C, tint } from '../lib/theme.js';
import { S } from '../lib/styles.js';
import { STUDY_STATUSES } from '../lib/constants.js';
import { Icon } from './Icon.jsx';

// Замена нативному <select>: единый вид на десктопе и телефоне (нативный особенно уродлив в WebView).
// options: массив строк ИЛИ {value,label}. onChange(value). Поддерживает точечную подсветку (dotColor).
export function Select({value, onChange, options, placeholder='—', style, disabled, small}){
  const [open,setOpen] = useState(false);
  const ref = useRef(null);
  const opts = options.map(o=> typeof o==='object' ? o : {value:o, label:o});
  const cur = opts.find(o=>o.value===value);
  useEffect(()=>{ if(!open) return;
    const on = (e)=>{ if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown',on); return ()=>document.removeEventListener('mousedown',on);
  }, [open]);
  const pad = small ? '6px 9px' : '10px 12px';
  const fs = small ? 12.5 : 14;
  return (
    <div ref={ref} style={{position:'relative', minWidth:0, ...(style||{})}}>
      <button type="button" disabled={disabled} onClick={()=>!disabled&&setOpen(o=>!o)}
        style={{width:'100%',display:'flex',alignItems:'center',gap:8,justifyContent:'space-between',background:C.panel,
          border:`1px solid ${open?C.amber:C.border}`,borderRadius:small?8:10,padding:pad,color:cur?C.text:C.dim,fontSize:fs,
          cursor:disabled?'default':'pointer',opacity:disabled?.5:1,textAlign:'left',minWidth:0}}>
        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:7,minWidth:0}}>
          {cur&&cur.dotColor&&<span style={{width:8,height:8,borderRadius:4,background:cur.dotColor,flexShrink:0}}/>}
          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cur?cur.label:placeholder}</span>
        </span>
        <span style={{color:C.dim,display:'flex',transform:open?'rotate(180deg)':'none',transition:'transform .12s'}}><Icon name="chevD" size={14}/></span>
      </button>
      {open && (
        <div className="sel-pop" style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:80,background:C.panelAlt,
          borderRadius:12,boxShadow:'0 12px 32px rgba(0,0,0,.5)',maxHeight:260,overflowY:'auto',padding:4,minWidth:160}}>
          {opts.map(o=>(
            <div key={String(o.value)} onClick={()=>{ onChange(o.value); setOpen(false); }}
              style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',borderRadius:8,cursor:'pointer',fontSize:fs,
                background:o.value===value?tint(C.amber,.12):'transparent',color:o.value===value?C.amber:C.text}}
              onMouseEnter={e=>{ if(o.value!==value) e.currentTarget.style.background=C.border; }}
              onMouseLeave={e=>{ if(o.value!==value) e.currentTarget.style.background='transparent'; }}>
              {o.dotColor&&<span style={{width:8,height:8,borderRadius:4,background:o.dotColor,flexShrink:0}}/>}
              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Модалка (полноэкранная на телефоне, карточка на десктопе). compact — небольшая карточка для подтверждений.
export function Modal({onClose, children, title, compact}){
  useEffect(()=>{ const on=(e)=>{ if(e.key==='Escape') onClose(); }; document.addEventListener('keydown',on);
    return ()=>document.removeEventListener('keydown',on); }, [onClose]);
  // Портал в body: вкладка рисуется в анимированном контейнере (.anim-tab), а transform создаёт свой слой —
  // без портала окно оказывалось ПОД нижним меню (session 046).
  return createPortal(
    <div className="anim-fade modal-overlay" style={S.modalOverlay} onClick={onClose}>
      <div className={(compact?'':'modal-card-mobile ')+'anim-pop'} style={compact?{...S.modalCard, maxWidth:380}:S.modalCard} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:14}}>
          <div style={{fontSize:17,fontWeight:700,letterSpacing:'-.01em'}}>{title}</div>
          <button className="icon-btn" aria-label="Закрыть" onClick={onClose}><Icon name="x" size={20}/></button>
        </div>
        {children}
      </div>
    </div>, document.body
  );
}

// Двухшаговое подтверждение (window.confirm НЕ рисуется в Android WebView). Клик «вооружает», второй — выполняет.
// icon: имя иконки из набора ('archive', 'trash'…) или готовый элемент; по умолчанию — крестик.
export function ConfirmIconBtn({onConfirm, title='удалить', icon, confirmLabel='точно?'}){
  const [armed,setArmed] = useState(false);
  useEffect(()=>{ if(!armed) return; const t=setTimeout(()=>setArmed(false),3000); return ()=>clearTimeout(t); },[armed]);
  if(armed) return <button className="icon-btn" style={{color:C.red,fontSize:12,fontWeight:600,whiteSpace:'nowrap',background:tint(C.red,.12),borderRadius:8,padding:'4px 9px'}} onClick={(e)=>{ e.stopPropagation(); setArmed(false); onConfirm(); }}>{confirmLabel}</button>;
  const ic = (!icon || icon==='✕') ? <Icon name="x" size={15}/>
    : (typeof icon==='string' && /^[a-zA-Z]+$/.test(icon)) ? <Icon name={icon} size={15}/> : icon;
  return <button className="icon-btn" title={title} aria-label={title} onClick={(e)=>{ e.stopPropagation(); setArmed(true); }}>{ic}</button>;
}

// Сворачиваемый раздел настроек (сгруппированный список, Э9) + под-заголовок + разделитель.
export function SettingsSection({title, defaultOpen=false, children}){
  const [open,setOpen] = useState(defaultOpen);
  return (
    <div style={{background:C.panel,borderRadius:12,padding:'0 14px',marginBottom:8}}>
      <div onClick={()=>setOpen(o=>!o)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,cursor:'pointer',userSelect:'none',padding:'14px 0'}}>
        <div style={{fontSize:14.5,fontWeight:500}}>{title}</div>
        <span style={{color:C.dim,display:'flex',transition:'transform .2s ease',transform:open?'rotate(90deg)':'none'}}><Icon name="chevR"/></span>
      </div>
      {open && <div className="anim-collapse" style={{paddingBottom:16}}>{children}</div>}
    </div>
  );
}
export const SubHead = ({children}) => <div style={{fontSize:11.5,fontWeight:600,color:C.dim,margin:'4px 0 8px',letterSpacing:'.05em',textTransform:'uppercase'}}>{children}</div>;
export const SettingsDivider = () => <div style={{height:1,background:C.border,margin:'16px 0'}}/>;

// Статус «Дел» меняется прямо в строке одним нажатием (Э4).
// Не начато — нейтральный, В процессе — синий, Выполнено — зелёный. Значения в данных прежние.
const STATUS_TONE = {'Не начато':C.text,'В процессе':C.cyan,'Выполнено':C.green};
const STATUS_SHORT = {'Не начато':'Не начато','В процессе':'В работе','Выполнено':'Готово'};
export function StatusSeg({value, onChange}){
  return (
    <div style={{display:'inline-flex',background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:2,gap:2,flexWrap:'nowrap'}}>
      {STUDY_STATUSES.map(s=>{ const active=value===s; const col=STATUS_TONE[s];
        return <button key={s} onClick={()=>onChange(s)}
          style={{border:'none',cursor:'pointer',padding:'4px 9px',borderRadius:7,fontSize:11.5,fontWeight:active?600:500,whiteSpace:'nowrap',
            background:active?(s==='Не начато'?C.panelAlt:tint(col,.16)):'transparent',color:active?col:C.dim}}>{STATUS_SHORT[s]}</button>; })}
    </div>
  );
}
