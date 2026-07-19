// Мост к нативному Android-виджету «Задачи на сегодня» (session 023).
// Нативный плагин WidgetBridge (Java) пишет done/total/date в SharedPreferences и обновляет виджет.
// На вебе / не-Android — no-op.
import { Capacitor, registerPlugin } from '@capacitor/core';

const WidgetBridge = registerPlugin('WidgetBridge');

export function updateTodayWidget(done, total, date) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const p = WidgetBridge.update({ done, total, date });
    if (p && p.catch) p.catch(() => {}); // старый APK без плагина — тихо игнорируем
  } catch (e) { /* no-op */ }
}
