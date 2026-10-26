/* Inicialização e roteador hash: arquivos locais, sem servidor ou módulos ES. */
(function (A) {
    'use strict';
    const U = A.utils, UI = A.ui, S = A.storage;
    const perfis = {
        rapido: { rotulo: 'Atendimento', plural: 'Atendimentos', statusInicial: 'agendado', mostraEtapas: false, parcelasMultiplas: false, botaoCard: 'Concluir e receber', acaoPrincipal: 'receber', destaque: 'agenda' },
        projeto: { rotulo: 'Projeto', plural: 'Projetos', statusInicial: 'orcamento', mostraEtapas: true, parcelasMultiplas: true, botaoCard: 'Avançar status', acaoPrincipal: 'avancar', destaque: 'orcamento' }
    };
    const menu = [['inicio', 'Início'], ['agenda', 'Agenda'], ['clientes', 'Clientes'], ['servicos', 'Serviços'], ['financeiro', 'Financeiro']];
    function aplicarConfig() { const c = S.obter('config'); if (!c)
        return; A.perfil = { ...perfis[c.tipoNegocio], tipo: c.tipoNegocio }; document.documentElement.dataset.theme = ({ claro: 'light', escuro: 'dark', auto: 'auto' })[c.tema] || 'auto'; document.title = c.nomeNegocio + ' — AdmPro'; }
    function ir(hash) { if (location.hash === hash)
        refresh();
    else
        location.hash = hash; }
    function rota() { const config = S.obter('config'); if (!config)
        return { nome: 'onboarding' }; const partes = (location.hash.replace(/^#\/?/, '') || 'inicio').split('/'); const nome = partes[0] || 'inicio'; if (nome === 'servicos' && partes[1])
        return { nome: 'detalhe', id: decodeURIComponent(partes[1]) }; return { nome: A.views[nome] ? nome : 'inicio' }; }
    function refresh() {
        const r = rota(), main = document.getElementById('conteudo'), topo = document.getElementById('topbar'), nav = document.getElementById('navegacao'), fab = document.getElementById('fab');
        if (r.nome === 'onboarding') {
            topo.hidden = true;
            nav.hidden = true;
            fab.hidden = true;
            main.innerHTML = A.views.onboarding.render();
            A.views.onboarding.bind(main);
            return;
        }
        topo.hidden = false;
        nav.hidden = false;
        const c = S.obter('config');
        topo.innerHTML = `<div class="topbar-nome">${c.logoBase64 ? `<img class="logo" src="${c.logoBase64}" alt="Logo do negócio">` : ''}<span>${U.escapar(c.nomeNegocio)}</span></div><a href="#/config" class="icon-button" aria-label="Configurações">${UI.icon('config')}</a>`;
        nav.innerHTML = menu.map(([id, label]) => `<a href="#/${id}" class="nav-item ${r.nome === id || (r.nome === 'detalhe' && id === 'servicos') ? 'ativo' : ''}" ${r.nome === id ? 'aria-current="page"' : ''}>${UI.icon(id)}<span>${label}</span></a>`).join('');
        const view = r.nome === 'detalhe' ? A.views.servicos : A.views[r.nome];
        main.innerHTML = r.nome === 'detalhe' ? view.detalheHTML(r.id) : view.render();
        if (r.nome === 'detalhe')
            view.bindDetalhe(main, r.id);
        else
            view.bind?.(main);
        const acoes = { inicio: () => A.views.servicos.abrirForm(), agenda: () => A.views.servicos.abrirForm(null, { data: U.hoje() }), clientes: () => A.views.clientes.abrirForm(), servicos: () => A.views.servicos.abrirForm(), detalhe: () => A.views.servicos.abrirForm(), financeiro: () => A.views.financeiro.abrirForm(), catalogo: () => A.views.catalogo.abrirForm() };
        fab.hidden = !acoes[r.nome];
        fab.innerHTML = UI.icon('plus');
        fab.setAttribute('aria-label', r.nome === 'financeiro' ? 'Novo lançamento' : r.nome === 'clientes' ? 'Novo cliente' : `Novo ${A.perfil.rotulo.toLowerCase()}`);
        fab.onclick = acoes[r.nome] || null;
    }
    function iniciar() { if (S.obter('config')) {
        aplicarConfig();
        if (!location.hash || location.hash === '#/')
            location.hash = '#/inicio';
    }
    else {
        location.hash = '#/inicio';
        document.documentElement.dataset.theme = 'auto';
    } refresh(); }
    A.app = { iniciar, refresh, ir, aplicarConfig };
    window.addEventListener('hashchange', () => { UI.fechar(); refresh(); document.getElementById('conteudo').focus({ preventScroll: true }); window.scrollTo(0, 0); });
    window.addEventListener('keydown', e => { if (e.key === 'Escape')
        UI.fechar(); });
    iniciar();
})(window.AdmPro = window.AdmPro || {});
