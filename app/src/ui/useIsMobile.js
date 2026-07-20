// Реактивное определение мобильного экрана (по ресайзу/повороту).
import { useState, useEffect } from 'react';

export function useIsMobile(bp=720){
  const [m,setM] = useState(typeof window!=='undefined' && window.innerWidth<=bp);
  useEffect(()=>{ const mq=window.matchMedia(`(max-width:${bp}px)`); const on=()=>setM(mq.matches); on();
    mq.addEventListener('change',on); return ()=>mq.removeEventListener('change',on); }, [bp]);
  return m;
}
