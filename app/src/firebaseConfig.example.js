// Шаблон конфигурации Firebase. Скопируй этот файл в firebaseConfig.js и впиши свои значения.
// firebaseConfig.js в .gitignore и НЕ попадает в репозиторий.
// Значения берутся из консоли Firebase: Project settings → Your apps → SDK setup and configuration (Config).
// Примечание: эти значения web-конфига не являются секретом сами по себе (они уходят в клиентский бандл),
// но проект держит их вне репозитория. Безопасность данных обеспечивают правила Firestore.
export const firebaseConfig = {
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};
