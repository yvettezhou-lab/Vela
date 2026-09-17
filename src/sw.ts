/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Bump this when the offline shell logic changes so a new SW is generated.
const OFFLINE_SHELL_VERSION = '2026-09-17.3';
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

// If an offline navigation cannot be resolved through the normal navigation
// route, serve the precached app shell instead of letting Safari show a
// network/offline error page.
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
