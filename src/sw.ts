/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

const sw = self as unknown as ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

const navigationHandler = createHandlerBoundToURL('/index.html');
registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/api\//],
  }),
);

sw.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void sw.skipWaiting();
  }
});
