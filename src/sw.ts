/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
try { registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'))) } catch { /* dev */ }

self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()) })

self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string; tag?: string } = {}
  try { data = event.data?.json() ?? {} } catch { data = { body: event.data?.text() } }
  event.waitUntil(
    self.registration.showNotification(data.title || 'דבר אליי', {
      body: data.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: data.tag,
      data: { url: data.url || './' },
      dir: 'rtl',
      lang: 'he'
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data?.url as string) || './', self.registration.scope).href
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if ('focus' in c) { await (c as WindowClient).focus(); try { await (c as WindowClient).navigate(url) } catch { /* */ } return }
    }
    await self.clients.openWindow(url)
  })())
})
