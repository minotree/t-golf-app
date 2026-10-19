import { build } from 'vite';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import './generate-icons.mjs';

const base = process.env.PWA_BASE_PATH || '/';
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw new Error('PWA_BASE_PATH must be a slash-delimited absolute path');
await build({ base });
await import('./generate-notices.mjs');
const directory = new URL('../dist/', import.meta.url);
const files = [];
async function collect(path = '') {
  for (const entry of await readdir(new URL(path, directory), { withFileTypes: true })) {
    if (entry.isDirectory()) await collect(`${path}${entry.name}/`);
    else files.push(`${path}${entry.name}`);
  }
}
await collect();
const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', directory), 'utf8'));
manifest.id = base; manifest.start_url = base; manifest.scope = base;
await writeFile(new URL('manifest.webmanifest', directory), JSON.stringify(manifest));
const hash = createHash('sha256');
for (const file of files.sort()) hash.update(await readFile(new URL(file, directory)));
const cache = `golf-shell-${hash.digest('hex').slice(0, 16)}`;
const urls = files.map(file => base + file);
// 사용자 영상·인증 응답·모델·외부 요청은 캐시 대상에 넣지 않는다.
await writeFile(new URL('sw.js', directory), `
const CACHE = ${JSON.stringify(cache)};
const URLS = ${JSON.stringify(urls)};
const BASE = ${JSON.stringify(base)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(URLS))));
self.addEventListener('message', event => { if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting(); });
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('golf-shell-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate' && url.pathname.startsWith(BASE)) {
    event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match(BASE + 'index.html'))));
  } else if (!url.search && URLS.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request, { ignoreVary: true })) || fetch(event.request)));
  }
});
`);
await writeFile(new URL('.nojekyll', directory), '');
console.log(`PWA shell generated: ${files.length} assets; ${cache}`);
