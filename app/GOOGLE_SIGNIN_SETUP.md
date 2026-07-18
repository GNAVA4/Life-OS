# Google-вход (синхронизация) на Android — настройка

Нативный вход добавлен в код (`@capacitor-firebase/authentication`). Чтобы он заработал и чтобы APK
не падал при запуске, нужно один раз настроить Android-приложение в Firebase (проект `life-os-52e35`).

⚠️ **Пока не добавлен `google-services.json`, новый APK будет вылетать на старте** — это ожидаемо.
(Старый APK без firebase-плагина работал; новый требует конфиг Firebase.)

## Шаги в консоли Firebase
1. https://console.firebase.google.com → проект **life-os-52e35** → ⚙ **Project settings**.
2. Раздел **Your apps** → **Add app** → значок **Android**.
3. **Android package name:** `com.lifeos.app` (ровно так). Ник: Life OS.
4. **Debug signing certificate SHA-1** — вставь:
   ```
   49:0A:7A:F2:B2:D5:58:3A:9C:03:75:8A:AD:F0:57:28:FE:2A:3C:10
   ```
5. **Register app** → **Download google-services.json**.
6. Положи файл сюда:
   ```
   app/android/app/google-services.json
   ```
7. Проверь: **Authentication → Sign-in method → Google = Enabled** (уже должно быть, раз web-синк работает).

## Пересобрать APK
```bash
cd app
npm run android:sync
npm run android:apk
```
Готовый файл: `app/android/app/build/outputs/apk/debug/app-debug.apk`.

## Проверка
Установи APK → нажми **☁ Войти** (в шторке «Ещё» на телефоне) → откроется НАТИВНОЕ окно выбора Google-аккаунта →
после входа Firestore синкается так же, как в браузере.

## Если позже соберёшь RELEASE-APK (для Play Store / подписанный)
У release-сборки ДРУГОЙ ключ → добавь в Firebase ещё и его SHA-1
(`keytool -list -v -keystore <твой-release.keystore> -alias <alias>`), иначе вход не пройдёт.
