const CACHE_NAME = 'busca-cep-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json'
];

// Instalação do Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url))
      );
    })
  );
  self.skipWaiting();
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceção de requisições
self.addEventListener('fetch', event => {
  // Trata apenas requisições HTTP/HTTPS
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      // Tenta buscar na rede e trata falhas graciosamente
      return fetch(event.request).catch(error => {
        console.warn('Falha de rede ao procurar:', event.request.url);
        // Retorna uma resposta vazia com status 503 para não quebrar a Promise do FetchEvent
        return new Response('', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      });
    })
  );
});