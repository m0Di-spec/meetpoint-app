// ВАЖНО: Этот файл должен лежать строго в папке public/ (рядом с icon.jpeg)

importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// 🚨 ВСТАВЬТЕ СЮДА ВАШИ КЛЮЧИ ИЗ APP.JSX
const firebaseConfig = {
  apiKey: "AIzaSyAM1bfODGs8qCRfYxy906cuct0955Juda8",
  authDomain: "meet-point-73afa.firebaseapp.com",
  projectId: "meet-point-73afa",
  storageBucket: "meet-point-73afa.firebasestorage.app",
  messagingSenderId: "975617549003",
  appId: "1:975617549003:web:e0e2f7233c6fca0e26314e"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Позволяет принимать уведомления, когда веб-приложение свернуто
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Получено фоновое сообщение ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.jpeg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});