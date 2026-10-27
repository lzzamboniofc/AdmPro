/* Inicialização e roteador hash: arquivos locais, sem servidor ou módulos ES. */
(function (A) {
    'use strict';
    const U = A.utils, UI = A.ui, S = A.storage;
    const perfis = {
        rapido: { rotulo: 'Atendimento', plural: 'Atendimentos', statusInicial: 'agendado', mostraEtapas: false, parcelasMultiplas: false, botaoCard: 'Concluir e receber', acaoPrincipal: 'receber', destaque: 'agenda' },
        projeto: { rotulo: 'Projeto', plural: 'Projetos', statusInicial: 'orcamento', mostraEtapas: true, parcelasMultiplas: true, botaoCard: 'Avançar status', acaoPrincipal: 'avancar', destaque: 'orcamento' }
    };
    const menu = [['inicio', 'Início'], ['agenda', 'Agenda'], ['clientes', 'Clientes'], ['servicos', 'Serviços'], ['financeiro', 'Financeiro']];
    const temaSistema = window.matchMedia('(prefers-color-scheme: dark)');
    function aplicarConfig() {
        const c = S.obter('config'); if (!c) return;
        const modelo = A.modelos[c.modeloNegocio] || A.modelos.outro;
        A.perfil = { ...(perfis[c.tipoNegocio] || perfis.rapido), ...(c.modeloNegocio && c.modeloNegocio !== 'outro' ? {rotulo:modelo.rotulo,plural:modelo.plural,status:modelo.status || {}} : {}), tipo:c.tipoNegocio };
        document.documentElement.dataset.theme = ({ claro:'light', escuro:'dark', auto:'auto' })[c.tema] || 'auto';
        A.marcaHeader = c.tema === 'escuro' || (c.tema === 'auto' && temaSistema.matches) ? 'img/logo/svg/logo-horizontal-negativo.svg' : 'img/logo/svg/logo-horizontal.svg';
        document.getElementById('admpro-header-logo')?.setAttribute('src', A.marcaHeader);
        document.title = c.nomeNegocio + ' — AdmPro';
    }
    function ir(hash) { if (location.hash === hash)
        refresh();
    else
        location.hash = hash; }
    function rota() { const config = S.obter('config'); if (!config)
        return { nome: 'onboarding' }; const partes = (location.hash.replace(/^#\/?/, '') || 'inicio').split('/'); const nome = partes[0] || 'inicio'; if (nome === 'gestao' && ['meta','estoque','profissionais','despesas'].includes(partes[1])) return {nome:'gestao',tipo:partes[1],id:partes[2] || null}; if (nome === 'servicos' && partes[1])
        { try { return { nome: 'detalhe', id: decodeURIComponent(partes[1]) }; } catch (_) { return { nome: 'naoEncontrado' }; } } return { nome: menu.some(x => x[0] === nome) || ['config','catalogo'].includes(nome) ? nome : 'naoEncontrado' }; }
    function refresh() {
        const r = rota(), main = document.getElementById('conteudo'), topo = document.getElementById('topbar'), nav = document.getElementById('navegacao'), fab = document.getElementById('fab');
        if (r.nome === 'onboarding' || (S.obter('config') && (!S.obter('config').pinHash || !S.sessaoAtiva()))) {
            const c = S.obter('config');
            const estado = !c ? 'onboarding' : !c.pinHash ? 'cadastro' : 'bloqueio';
            topo.hidden = true;
            nav.hidden = true;
            fab.hidden = true;
            main.innerHTML = estado === 'onboarding' ? A.views.onboarding.render() : estado === 'cadastro' ? A.views.seguranca.renderCadastro() : A.views.seguranca.renderBloqueio();
            if (estado === 'onboarding') A.views.onboarding.bind(main);
            else if (estado === 'cadastro') A.views.seguranca.bindCadastro(main);
            else A.views.seguranca.bindBloqueio(main);
            return;
        }
        topo.hidden = false;
        nav.hidden = false;
        const c = S.obter('config');
        topo.innerHTML = `<div class="topbar-identidade"><a class="admpro-marca" href="#/inicio" aria-label="AdmPro: ir ao início"><img id="admpro-header-logo" src="${A.marcaHeader}" alt="AdmPro" width="107" height="28"></a><div class="topbar-nome">${/^data:image\/(png|jpeg|webp);base64,/.test(c.logoBase64 || '') ? `<img class="logo" src="${U.escapar(c.logoBase64)}" alt="Logo do negócio">` : ''}<span title="${U.escapar(c.nomeNegocio)}">${U.escapar(c.nomeNegocio)}</span></div></div>${navigator.onLine===false ? '<span class="offline-badge" role="status">Offline</span>' : ''}<div class="user-menu"><button type="button" class="avatar-button" id="abrir-menu-user" aria-label="Menu do usuário" aria-expanded="false" aria-controls="menu-user">${U.escapar((c.nomeNegocio || 'A').trim().charAt(0).toUpperCase())}</button><div id="menu-user" class="user-dropdown" hidden><a href="#/config">${UI.icon('config',true)} Configurações</a><button type="button" class="danger" id="sair-menu">${UI.icon('logout',true)} Sair</button></div></div>`;
        topo.querySelector('#abrir-menu-user').onclick = () => { const el = topo.querySelector('#menu-user'); el.hidden = !el.hidden; topo.querySelector('#abrir-menu-user').setAttribute('aria-expanded', String(!el.hidden)); };
        topo.querySelector('#sair-menu').onclick = sair;
        nav.innerHTML = menu.map(([id, label]) => `<a href="#/${id}" class="nav-item ${r.nome === id || (r.nome === 'detalhe' && id === 'servicos') ? 'ativo' : ''}" ${r.nome === id ? 'aria-current="page"' : ''}>${UI.icon(id)}<span>${label}</span></a>`).join('') + `<button type="button" class="sair-sidebar" id="sair-sidebar">${UI.icon('logout')} Sair</button>`;
        nav.querySelector('#sair-sidebar').onclick = sair;
        const view = r.nome === 'detalhe' ? A.views.servicos : A.views[r.nome];
        main.innerHTML = r.nome === 'naoEncontrado' ? UI.vazio('Não encontrado', 'Esta página não existe.') + '<a class="btn secundario" href="#/inicio">Voltar ao Início</a>' : r.nome === 'detalhe' ? view.detalheHTML(r.id) : r.nome === 'gestao' ? view.render(r.tipo,r.id) : view.render();
        if (r.nome === 'detalhe')
            view.bindDetalhe(main, r.id);
        else if (view)
            view.bind?.(main,r.tipo,r.id);
        const acoes = { inicio: () => A.views.servicos.abrirForm(), agenda: () => A.views.servicos.abrirForm(null, { data: U.hoje() }), clientes: () => A.views.clientes.abrirForm(), servicos: () => A.views.servicos.abrirForm(), financeiro: () => A.views.financeiro.abrirForm(), catalogo: () => A.views.catalogo.abrirForm() };
        fab.hidden = !acoes[r.nome];
        fab.innerHTML = UI.icon('plus');
        fab.setAttribute('aria-label', r.nome === 'financeiro' ? 'Novo lançamento' : r.nome === 'clientes' ? 'Novo cliente' : `Novo ${A.perfil.rotulo.toLowerCase()}`);
        fab.onclick = acoes[r.nome] || null;
    }
    function sair() {
        UI.confirmar('Sair do AdmPro?', 'Deseja sair do AdmPro? Seus dados serão mantidos neste navegador.', () => {
            S.encerrarSessao(); UI.fechar(); refresh(); UI.toast('Sessão encerrada.');
        }, 'Sair');
    }
    function iniciar() { S.migrarDados(); if (S.obter('config')) {
        S.gerarDespesasFixas();
        aplicarConfig();
        if (!location.hash || location.hash === '#/')
            location.hash = '#/inicio';
    }
    else {
        location.hash = '#/inicio';
        document.documentElement.dataset.theme = 'auto';
    } refresh(); }
    // PWA apenas em HTTP(S); file:// sempre funciona sem service worker.
    let instalacao = null;
    let workerNovo = null;
    const instalada = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); instalacao=e; if(location.hash==='#/config')refresh(); });
    window.addEventListener('appinstalled', () => { instalacao=null; UI.toast('AdmPro instalado.'); if(location.hash==='#/config')refresh(); });
    function instalar() { if(!instalacao)return; instalacao.prompt(); instalacao.userChoice.then(()=>{instalacao=null;}); }
    function podeInstalar() { return !!instalacao && !instalada(); }
    function atualizarPWA() { if(workerNovo)workerNovo.postMessage({tipo:'SKIP_WAITING'}); }
    function iniciarPWA() {
        if (!['http:','https:'].includes(location.protocol) || !('serviceWorker' in navigator)) return;
        navigator.serviceWorker.addEventListener('controllerchange', () => { if (window.__atualizandoAdmpro) return; window.__atualizandoAdmpro=true; location.reload(); });
        navigator.serviceWorker.register('sw.js').then(reg => {
            function verificar() {
                if(reg.waiting && navigator.serviceWorker.controller) {
                    workerNovo=reg.waiting;
                    UI.toastAcao('Nova versão disponível','Atualizar',atualizarPWA);
                }
            }
            verificar();
            reg.addEventListener('updatefound',()=>{const w=reg.installing;w?.addEventListener('statechange',()=>{if(w.state==='installed')verificar();});});
        }).catch(err => console.warn('PWA indisponível:',err.message));
    }
    window.addEventListener('online',refresh);
    window.addEventListener('offline',refresh);
    A.app = { iniciar, refresh, ir, aplicarConfig, sair, instalar, podeInstalar, instalada, atualizarPWA };
    window.addEventListener('hashchange', () => { UI.fechar(); refresh(); document.getElementById('conteudo').focus({ preventScroll: true }); window.scrollTo(0, 0); });
    window.addEventListener('keydown', e => { if (e.key === 'Escape')
        UI.fechar(); });
    temaSistema.addEventListener?.('change', () => { if (S.obter('config')?.tema === 'auto') aplicarConfig(); });
    iniciar();
    iniciarPWA();
})(window.AdmPro = window.AdmPro || {});
