importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAAeC7_aNrMBsaoBYNZs9jnQvpCc9x04kU",
  authDomain: "cocofy-f3cab.firebaseapp.com",
  projectId: "cocofy-f3cab",
  storageBucket: "cocofy-f3cab.firebasestorage.app",
  messagingSenderId: "33629571209",
  appId: "1:33629571209:web:c9b9e37aab0ba91bdd1e58"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'Cocofy Update';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new update.',
    icon: '/favicon.ico',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus if window is already open
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow('/dashboard');
      }
    })
  );
});
