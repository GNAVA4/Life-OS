// Круглая отметка выполнения (редизайн «Тихий», session 043) — замена нативному чекбоксу во всех вкладках.
import { C } from '../lib/theme.js';
import { Icon } from './Icon.jsx';
import { haptic } from '../lib/haptics.js';

export function Check({checked, onChange, label, color=C.amber, size=22}){
  return (
    <button type="button" role="checkbox" aria-checked={!!checked} aria-label={label} onClick={(e)=>{ haptic('tap'); onChange && onChange(e); }}
      style={{width:size,height:size,borderRadius:'50%',flex:'none',cursor:'pointer',padding:0,display:'grid',placeItems:'center',
        border:`1.6px solid ${checked?color:'#4A4E55'}`,background:checked?color:'transparent',color:C.bg}}>
      {checked && <Icon name="check" size={Math.round(size*.6)} stroke={3}/>}
    </button>
  );
}
