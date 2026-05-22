// Native service worker installation and activation lifecycle
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install event fired.');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate event fired.');
  event.waitUntil(self.clients.claim());
});

// Native push listener (registered first, runs synchronously on push events)
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Native Push Event Received:', event);

  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      console.warn('[Service Worker] Push data is not JSON, parsing as text:', e);
      try {
        payload = { notification: { title: 'Cocofy Update', body: event.data.text() } };
      } catch (err) {
        payload = {};
      }
    }
  }

  console.log('[Service Worker] Parsed payload:', payload);

  // Extract title and body from various possible locations in the JSON payload
  const title = payload.notification?.title || 
                payload.data?.title || 
                payload.data?.['gcm.notification.title'] || 
                payload.title || 
                'Cocofy Notification';

  const body = payload.notification?.body || 
               payload.data?.body || 
               payload.data?.['gcm.notification.body'] || 
               payload.body || 
               'You have a new update.';

  const icon = payload.notification?.icon || payload.data?.icon || '/favicon.ico';
  const badge = payload.notification?.badge || payload.data?.badge || '/favicon.ico';
  const vibrate = payload.notification?.vibrate || [200, 100, 200];
  
  // Extract custom click-action link or fallback to dashboard
  const link = payload.fcmOptions?.link || 
               payload.notification?.click_action || 
               payload.data?.link || 
               payload.data?.click_action || 
               '/dashboard';

  const options = {
    body: body,
    icon: icon,
    badge: badge,
    vibrate: vibrate,
    data: {
      link: link,
      ...(payload.data || {})
    },
    tag: payload.data?.tag || 'cocofy-notification-tag',
    renotify: true,
    requireInteraction: false
  };

  // We are handling the notification natively. Stop propagation so Firebase doesn't trigger
  // a duplicate or raise an error inside the background message handler.
  event.stopImmediatePropagation();

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Native notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event);
  event.notification.close();

  const clickAction = event.notification.data?.link || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus the window if it's already open
      for (const client of clientList) {
        if (client.url.includes(clickAction) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(clickAction);
      }
    })
  );
});

// Try to initialize Firebase compat SDK in a try-catch block so that:
// 1. getToken() on the client-side can successfully retrieve FCM tokens.
// 2. Network failures or startup delays in background contexts don't crash the service worker.
try {
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

  // Register background messaging handler for compatibility (though native push listener handles display)
  messaging.onBackgroundMessage((payload) => {
    console.log('[Service Worker] Firebase SDK onBackgroundMessage invoked (should be blocked by stopImmediatePropagation):', payload);
  });
} catch (error) {
  console.warn('[Service Worker] Firebase initialization error (service worker still running):', error);
}
