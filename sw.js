/* PWA: cache-first de arquivos estáticos do mesmo escopo. Sem acesso a dados privados. */
const CACHE = 'admpro-estaticos-v3';
const ARQUIVOS = [
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/modelos.js",
  "./js/regras.js",
  "./js/storage.js",
  "./js/ui.js",
  "./js/utils.js",
  "./js/views/agenda.js",
  "./js/views/catalogo.js",
  "./js/views/clientes.js",
  "./js/views/config.js",
  "./js/views/financeiro.js",
  "./js/views/gestao.js",
  "./js/views/inicio.js",
  "./js/views/onboarding.js",
  "./js/views/seguranca.js",
  "./js/views/servicos.js",
  "./img/logo/favicon/apple-touch-icon.png",
  "./img/logo/favicon/favicon-16.png",
  "./img/logo/favicon/favicon-32.png",
  "./img/logo/favicon/favicon-48.png",
  "./img/logo/favicon/favicon.ico",
  "./img/logo/favicon/favicon.svg",
  "./img/logo/favicon/icon-192.png",
  "./img/logo/favicon/icon-512.png",
  "./img/logo/favicon/icon-maskable-512.png",
  "./img/logo/favicon/site.webmanifest",
  "./img/logo/png/logo-branca-1200w.png",
  "./img/logo/png/logo-branca-600w.png",
  "./img/logo/png/logo-horizontal-1200w.png",
  "./img/logo/png/logo-horizontal-600w.png",
  "./img/logo/png/logo-horizontal-negativo-1200w.png",
  "./img/logo/png/logo-horizontal-negativo-600w.png",
  "./img/logo/png/logo-monocromatica-1200w.png",
  "./img/logo/png/logo-monocromatica-600w.png",
  "./img/logo/png/logo-vertical-400w.png",
  "./img/logo/png/logo-vertical-800w.png",
  "./img/logo/png/simbolo-128.png",
  "./img/logo/png/simbolo-256.png",
  "./img/logo/png/simbolo-512.png",
  "./img/logo/svg/logo-branca.svg",
  "./img/logo/svg/logo-horizontal-negativo.svg",
  "./img/logo/svg/logo-horizontal.svg",
  "./img/logo/svg/logo-monocromatica.svg",
  "./img/logo/svg/logo-vertical.svg",
  "./img/logo/svg/simbolo.svg"
];
self.addEventListener('install', evento => {
    evento.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ARQUIVOS)));
});
self.addEventListener('activate', evento => {
    evento.waitUntil(Promise.all([
        caches.keys().then(chaves => Promise.all(chaves.filter(chave => chave.startsWith('admpro-estaticos-') && chave !== CACHE).map(chave => caches.delete(chave)))),
        self.clients.claim()
    ]));
});
self.addEventListener('message', evento => {
    if (evento.data?.tipo === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', evento => {
    if (evento.request.method !== 'GET' || new URL(evento.request.url).origin !== self.location.origin) return;
    evento.respondWith(caches.match(evento.request,{ignoreSearch:true}).then(cached => cached || fetch(evento.request).then(resposta => {
        if (resposta.ok) { const copia = resposta.clone(); caches.open(CACHE).then(c => c.put(evento.request,copia)); }
        return resposta;
    })));
});
