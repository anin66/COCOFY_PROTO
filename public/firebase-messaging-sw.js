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

  event.waitUntil((async () => {
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

    await self.registration.showNotification(title, options);
  })());
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

// Native Service Worker handles push messages entirely without external SDK dependencies for peak reliability
