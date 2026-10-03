// Короткие вибрации на телефоне (session 051, запрос пользователя): отметки, добавление — лёгкий щелчок;
// удаление и анти-тег — «предупреждение». Только в приложении (Capacitor), в браузере — ничего.
// Выключается в Настройках → Уведомления → «Вибрация» (settings.hapticsOff); App передаёт флаг через setHapticsEnabled.
// Плагин импортируется статически: ленивый import() Capacitor-плагинов виснет в WebView (s014).
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

let enabled = true;
export const setHapticsEnabled = (on) => { enabled = !!on; };

// Возвращает undefined, чтобы можно было писать `haptic('tap') || действие(...)` в однострочных обработчиках.
export function haptic(kind = 'tap'){
  if(!enabled || !Capacitor.isNativePlatform()) return undefined;
  try {
    const p = kind === 'warn' ? Haptics.notification({ type: NotificationType.Warning }) : Haptics.impact({ style: ImpactStyle.Light });
    if(p && p.catch) p.catch(()=>{});   // нет вибромотора или плагин в старом APK — молча пропускаем
  } catch(e){ /* то же */ }
  return undefined;
}
