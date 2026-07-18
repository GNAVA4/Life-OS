# Сборка Android APK (Life OS)

Проект настроен под **Capacitor 8** — нативный Android-проект в `app/android/`,
`appId = com.lifeos.app`, веб-сборка из `app/dist`.

## ✅ На этой машине уже собирается
- Android Studio установлен (даёт SDK + JDK 21 «JBR»).
- Android SDK: `C:\Users\rusla\AppData\Local\Android\Sdk` (прописан в `android/local.properties`).
- В `android/gradle.properties` закреплено `org.gradle.java.home=C:/Program Files/Android/Android Studio/jbr`
  (иначе Gradle берёт системную Java 8, которой мало для Android Gradle Plugin).

### Собрать APK из командной строки
```bash
cd app
npm run android:sync      # vite build + cap sync android (залить свежий web-код)
npm run android:apk       # = cd android && gradlew.bat assembleDebug
```
Готовый файл:
```
app/android/app/build/outputs/apk/debug/app-debug.apk
```
Скинь его на телефон и установи (включив «Установка из неизвестных источников»).

### Или через Android Studio
```bash
cd app && npm run android:sync && npm run android:open
```
В студии: **Build → Build Bundle(s)/APK(s) → Build APK(s)**.

## После КАЖДОГО изменения кода приложения
```bash
npm run android:sync      # пересобрать web и скопировать в android/
npm run android:apk       # пересобрать APK
```

## Если переустановишь/обновишь Android Studio
Проверь путь JDK в `android/gradle.properties` (`org.gradle.java.home`) — он машинно-специфичный.

## Известные ограничения
- **Вход через Google (синхронизация)** использует `signInWithPopup` — в WebView Android НЕ работает.
  Приложение полностью работает офлайн (localStorage). Для синка на телефоне нужен нативный плагин
  `@capacitor-firebase/authentication` — отдельный шаг (Phase 2 follow-up).
- Это **debug**-APK (для установки себе). Для Play Store нужен подписанный **release** AAB (keystore) — отдельно.
