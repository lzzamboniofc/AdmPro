/* Testes isolados do service worker, sem navegador ou dependências externas.
   Executar: node --test tests/pwa.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const raiz = path.resolve(__dirname, '..');
const escopo = 'http://localhost:5500/AdmPro/';

function ambiente() {
    const ouvintes = new Map();
    const caixas = new Map();
    let online = true;
    let pulouEspera = false;
    let assumiuControle = false;

    function arquivoParaUrl(url) {
        const relativo = decodeURIComponent(new URL(url).pathname)
            .replace('/AdmPro/', '');
        const destino = path.resolve(raiz, relativo);
        if (!destino.startsWith(raiz + path.sep)) throw Error('URL fora do projeto');
        return destino;
    }

    function chave(request, ignorarBusca = false) {
        const url = new URL(typeof request === 'string' ? request : request.url);
        if (ignorarBusca) url.search = '';
        return url.href;
    }

    const caches = {
        async open(nome) {
            if (!caixas.has(nome)) caixas.set(nome, new Map());
            const itens = caixas.get(nome);
            return {
                async addAll(lista) {
                    const preparados = lista.map(relativo => {
                        const url = new URL(relativo, escopo).href;
                        const bytes = fs.readFileSync(arquivoParaUrl(url));
                        return [url, new Response(bytes)];
                    });
                    preparados.forEach(([url, resposta]) => itens.set(url, resposta));
                },
                async match(request, options = {}) {
                    const url = chave(request, options.ignoreSearch);
                    return [...itens].find(([urlGuardada]) =>
                        chave(urlGuardada, options.ignoreSearch) === url)?.[1]?.clone();
                },
                async put(request, resposta) {
                    itens.set(chave(request), resposta);
                }
            };
        },
        async keys() { return [...caixas.keys()]; },
        async delete(nome) { return caixas.delete(nome); }
    };
    const self = {
        location: { origin: new URL(escopo).origin },
        registration: { scope: escopo },
        clients: { async claim() { assumiuControle = true; } },
        skipWaiting() { pulouEspera = true; },
        addEventListener(nome, fn) { ouvintes.set(nome, fn); }
    };
    const fetch = async requisicao => {
        if (!online) throw new TypeError('Sem conexão');
        const caminho = arquivoParaUrl(chave(requisicao));
        return new Response(fs.readFileSync(caminho));
    };
    vm.runInNewContext(fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8'),
        { self, caches, fetch, URL, Response, Promise }, { filename: 'sw.js' });

    async function eventoAssincrono(nome, extras = {}) {
        const pendentes = [];
        const evento = { ...extras, waitUntil: promessa => pendentes.push(promessa) };
        ouvintes.get(nome)(evento);
        await Promise.all(pendentes);
    }
    async function requisitar(url, mode = 'cors') {
        const pendentes = [];
        let resposta;
        const evento = {
            request: { url, method: 'GET', mode },
            respondWith: promessa => { resposta = promessa; },
            waitUntil: promessa => pendentes.push(promessa)
        };
        ouvintes.get('fetch')(evento);
        if (!resposta) return null;
        const resultado = await resposta;
        await Promise.all(pendentes);
        return resultado;
    }
    return {
        caixas, caches, self,
        instalar: () => eventoAssincrono('install'),
        ativar: () => eventoAssincrono('activate'),
        requisitar,
        offline: () => { online = false; },
        info: () => ({ pulouEspera, assumiuControle }),
        mensagem: dados => ouvintes.get('message')({ data: dados })
    };
}

test('instala e guarda todos os recursos declarados, mesmo em subpasta', async () => {
    const e = ambiente();
    await e.instalar();
    assert.equal(e.caixas.size, 1);
    const itens = [...e.caixas.values()][0];
    assert.ok(itens.size >= 40);
    assert.ok(itens.has(escopo + 'index.html'));
    assert.ok(itens.has(escopo + 'js/app.js'));
});

test('navegar pela raiz offline usa index.html mesmo sem cache da raiz', async () => {
    const e = ambiente();
    await e.instalar();
    await e.ativar();
    e.offline();
    const pagina = await e.requisitar(escopo, 'navigate');
    const html = await pagina.text();
    assert.match(html, /<title>AdmPro/);
    assert.match(html, /js\/app\.js/);
});

test('scripts e CSS permanecem disponíveis offline com cache-first', async () => {
    const e = ambiente();
    await e.instalar();
    e.offline();
    for (const caminho of ['css/style.css', 'js/storage.js', 'js/views/gestao.js']) {
        const resposta = await e.requisitar(escopo + caminho);
        assert.ok((await resposta.text()).length > 100, caminho);
    }
});

test('ativação remove cache antigo, mantém outros e assume controle', async () => {
    const e = ambiente();
    await e.instalar();
    await e.caches.open('admpro-estaticos-v3-2');
    await e.caches.open('outro-aplicativo');
    await e.ativar();
    const chaves = await e.caches.keys();
    assert.ok(chaves.includes('outro-aplicativo'));
    assert.ok(!chaves.includes('admpro-estaticos-v3-2'));
    assert.ok(chaves.includes('admpro-estaticos-v3-3'));
    assert.equal(e.info().assumiuControle, true);
});

test('aviso de atualização usa SKIP_WAITING e mantém recursos de outro domínio fora do escopo', async () => {
    const e = ambiente();
    e.mensagem({ tipo: 'SKIP_WAITING' });
    assert.equal(e.info().pulouEspera, true);
    assert.equal(await e.requisitar('https://site-externo.test/arquivo.js'), null);
});
