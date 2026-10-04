// Короткие вибрации на телефоне (session 051, запрос пользователя): отметки, добавление — лёгкий щелчок;
// удаление и анти-тег — «предупреждение». Только в приложении (Capacitor), в браузере — ничего.
// Выключается в Настройках → Уведомления → «Вибрация» (settings.hapticsOff); App передаёт флаг через setHapticsEnabled.
// Плагин импортируется статически: ленивый import() Capacitor-плагинов виснет в WebView (s014).
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

let enabled = true;
export const setHapticsEnabled = (on) => { enabled = !!on; };

// Одно нажатие может вызвать haptic дважды: явно в обработчике и через общий слушатель переключателей (s053).
// Второй вызов в пределах HAPTIC_DEDUP_MS глушим. 60 мс — меньше любого реального повторного нажатия,
// но больше задержки между обработчиками одного клика.
const HAPTIC_DEDUP_MS = 60;
let lastAt = 0;

// Возвращает undefined, чтобы можно было писать `haptic('tap') || действие(...)` в однострочных обработчиках.
export function haptic(kind = 'tap'){
  if(!enabled || !Capacitor.isNativePlatform()) return undefined;
  const now = Date.now(); if(now - lastAt < HAPTIC_DEDUP_MS) return undefined; lastAt = now;
  try {
    const p = kind === 'warn' ? Haptics.notification({ type: NotificationType.Warning }) : Haptics.impact({ style: ImpactStyle.Light });
    if(p && p.catch) p.catch(()=>{});   // нет вибромотора или плагин в старом APK — молча пропускаем
  } catch(e){ /* то же */ }
  return undefined;
}

// Общий слушатель (s053, запрос пользователя «больше вибраций — переключения»): любой переключатель —
// кнопка с aria-pressed (сегменты, чипы-фильтры, дни недели, закрепить) или role="switch" (Toggle) — даёт лёгкий щелчок.
// Слушаем в фазе capture: Toggle делает stopPropagation. Новый переключатель получает вибрацию, если размечен aria-pressed.
export function installSwitchHaptics(){
  const onClick = (e) => {
    const el = e.target && e.target.closest && e.target.closest('[aria-pressed],[role="switch"]');
    if(el && !el.disabled) haptic('tap');
  };
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}
