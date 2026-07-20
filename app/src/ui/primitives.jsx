// Переиспользуемые UI-примитивы (WebView-safe): Select, Modal, ConfirmIconBtn, разделы настроек, статус-сегмент.
import { useState, useEffect, useRef } from 'react';
import { C } from '../lib/theme.js';
import { S } from '../lib/styles.js';
import { STUDY_STATUSES, STATUS_COLOR } from '../lib/constants.js';

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
  const pad = small ? '5px 8px' : '9px 10px';
  const fs = small ? 12 : 13.5;
  return (
    <div ref={ref} style={{position:'relative', minWidth:0, ...(style||{})}}>
      <button type="button" disabled={disabled} onClick={()=>!disabled&&setOpen(o=>!o)}
        style={{width:'100%',display:'flex',alignItems:'center',gap:8,justifyContent:'space-between',background:C.panelAlt,
          border:`1px solid ${open?C.amber:C.border}`,borderRadius:6,padding:pad,color:cur?C.text:C.dim,fontSize:fs,
          cursor:disabled?'default':'pointer',opacity:disabled?.5:1,textAlign:'left',minWidth:0}}>
        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:7,minWidth:0}}>
          {cur&&cur.dotColor&&<span style={{width:8,height:8,borderRadius:4,background:cur.dotColor,flexShrink:0}}/>}
          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cur?cur.label:placeholder}</span>
        </span>
        <span style={{color:C.dim,fontSize:10,transform:open?'rotate(180deg)':'none',transition:'transform .12s'}}>▾</span>
      </button>
      {open && (
        <div className="sel-pop" style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:80,background:C.panel,
          border:`1px solid ${C.border}`,borderRadius:8,boxShadow:'0 10px 30px rgba(0,0,0,.5)',maxHeight:260,overflowY:'auto',padding:4}}>
          {opts.map(o=>(
            <div key={String(o.value)} onClick={()=>{ onChange(o.value); setOpen(false); }}
              style={{display:'flex',alignItems:'center',gap:8,padding:'9px 10px',borderRadius:6,cursor:'pointer',fontSize:fs,
                background:o.value===value?C.panelAlt:'transparent',color:o.value===value?C.amber:C.text}}
              onMouseEnter={e=>{ if(o.value!==value) e.currentTarget.style.background=C.panelAlt; }}
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
  return (
    <div className="anim-fade" style={S.modalOverlay} onClick={onClose}>
      <div className={(compact?'':'modal-card-mobile ')+'anim-pop'} style={compact?{...S.modalCard, maxWidth:360}:S.modalCard} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:16,fontWeight:700}}>{title}</div>
          <button className="icon-btn" style={{fontSize:20}} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Двухшаговое подтверждение (window.confirm НЕ рисуется в Android WebView). Клик «вооружает», второй — выполняет.
export function ConfirmIconBtn({onConfirm, title='удалить', icon='✕', confirmLabel='точно?'}){
  const [armed,setArmed] = useState(false);
  useEffect(()=>{ if(!armed) return; const t=setTimeout(()=>setArmed(false),3000); return ()=>clearTimeout(t); },[armed]);
  if(armed) return <button className="icon-btn" style={{color:C.red,fontSize:11,fontWeight:700,whiteSpace:'nowrap'}} onClick={(e)=>{ e.stopPropagation(); setArmed(false); onConfirm(); }}>{confirmLabel}</button>;
  return <button className="icon-btn" title={title} onClick={(e)=>{ e.stopPropagation(); setArmed(true); }}>{icon}</button>;
}

// Сворачиваемый раздел настроек + под-заголовок + разделитель.
export function SettingsSection({title, icon, defaultOpen=false, children}){
  const [open,setOpen] = useState(defaultOpen);
  return (
    <div style={S.panel}>
      <div onClick={()=>setOpen(o=>!o)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',userSelect:'none'}}>
        <div style={{...S.panelTitle,marginBottom:0}}>{icon} {title}</div>
        <span style={{color:C.dim,fontSize:12,transition:'transform .2s ease',transform:open?'rotate(180deg)':'none'}}>▾</span>
      </div>
      {open && <div className="anim-collapse" style={{marginTop:14}}>{children}</div>}
    </div>
  );
}
export const SubHead = ({children}) => <div style={{fontSize:12.5,fontWeight:700,color:C.cyan,margin:'2px 0 8px',letterSpacing:'.02em'}}>{children}</div>;
export const SettingsDivider = () => <div style={{height:1,background:C.border,margin:'18px 0'}}/>;

// Статус-переключатель «Дел»: Не начато (серый) / В процессе (янтарь) / Выполнено (зелёный).
export function StatusSeg({value, onChange}){
  return (
    <div style={S.seg}>
      {STUDY_STATUSES.map(s=>{ const active=value===s; const col=STATUS_COLOR[s];
        return <button key={s} onClick={()=>onChange(s)}
          style={{...S.segBtn, background:active?col:'transparent', color:active?(s==='В процессе'?'#1A1200':'#0B0E13'):C.dim}}>{s}</button>; })}
    </div>
  );
}
