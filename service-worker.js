const CACHE_NAME = 'teleprompter-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json'
];

// Instalação do Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache aberto');
                return cache.addAll(urlsToCache);
            })
            .catch(err => {
                console.log('Erro ao cachear:', err);
            })
    );
    self.skipWaiting();
});

// Ativação do Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Removendo cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Estratégia: Network First, fallback para Cache
self.addEventListener('fetch', event => {
    // Ignorar requisições não-GET
    if (event.request.method !== 'GET') {
        return;
    }

    // Para requisições de rede (como API de letras)
    if (event.request.url.includes('api.lyrics.ovh')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Cache a resposta se for bem-sucedida
                    if (response && response.status === 200) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Se falhar, tenta o cache
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Para recursos locais, usar cache first
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }

                return fetch(event.request)
                    .then(response => {
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }

                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    });
            })
            .catch(() => {
                // Resposta offline genérica se necessário
                return new Response('Offline - não foi possível carregar este recurso', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: new Headers({
                        'Content-Type': 'text/plain'
                    })
                });
            })
    );
});

// Background sync para futuras funcionalidades
self.addEventListener('sync', event => {
    console.log('Background sync event:', event.tag);
});
