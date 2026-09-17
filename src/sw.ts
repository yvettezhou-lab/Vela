/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Offline shell version bump: changing this source forces a new SW build and
// lets Workbox cleanupOutdatedCaches retire the previous precache generation.
const OFFLINE_SHELL_VERSION = '2026-09-17.2';
void OFFLINE_SHELL_VERSION;

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

// Final offline navigation fallback: if a navigation handler ever fails while
// the network is unavailable, serve the precached App Shell directly.
setCatchHandler(async ({ request }) => {
  if (request.mode === 'navigate') {
    return matchPrecache('/index.html');
  }
  return Response.error();
});

sw.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void sw.skipWaiting();
  }
});
