/* Resumo financeiro e prioridades conforme o perfil selecionado. */
(function (A) {
    'use strict';
    const U = A.utils, UI = A.ui, S = A.storage;
    function render() {
        const hoje = U.hoje(), mes = hoje.slice(0, 7), lanc = S.lista('lancamentos').filter(l => l.data.startsWith(mes));
        const soma = tipo => U.somarValores(lanc.filter(l => l.tipo === tipo).map(l => l.valor));
        const entradas = soma('entrada'), saidas = soma('saida');
        const servicos = S.lista('servicos'), abertas = servicos.filter(s => s.status !== 'cancelado').flatMap(s => s.parcelas.filter(p => !p.pago).map(p => ({ ...p, servico: s }))), receber = U.somarValores(abertas.map(p => p.valor));
        const atrasadas = abertas.filter(p => p.vencimento < hoje).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
        const destaque = A.perfil.destaque === 'orcamento' ? servicos.filter(s => s.status === 'orcamento') : servicos.filter(s => s.data === hoje && s.status !== 'cancelado');
        destaque.sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
        const resumo = [['Entradas do mês', entradas, 'success'], ['Saídas do mês', saidas, ''], ['Saldo', entradas - saidas, entradas - saidas < 0 ? 'danger' : ''], ['Total a receber', receber, '']];
        return `<div class="page-heading"><div><h1>Olá, ${U.escapar(S.obter('config').nomeNegocio)}!</h1><p class="muted">${U.formatarDia(hoje)}</p></div></div><div class="grid-resumo">${resumo.map(([rotulo, valor, classe]) => UI.card(`<p class="resumo-label">${rotulo}</p><p class="resumo-valor ${classe}">${U.dinheiro(valor)}</p>`)).join('')}</div><section class="section"><div class="section-heading"><h2>${A.perfil.destaque === 'orcamento' ? 'Orçamentos pendentes' : 'Agenda de hoje'}</h2><a href="${A.perfil.destaque === 'orcamento' ? '#/servicos' : '#/agenda'}">Ver todos</a></div><div class="stack">${destaque.length ? destaque.slice(0, 6).map(s => UI.card(`<div class="list-card"><div class="grow"><h3>${U.escapar(s.titulo)}</h3><p class="item-meta">${U.escapar(S.porId('clientes', s.clienteId)?.nome || 'Cliente removido')} · ${U.escapar(s.hora || U.exibirData(s.data))}</p></div>${UI.chip(s.status)}</div><a class="btn secundario compacto" style="margin-top:12px" href="#/servicos/${encodeURIComponent(s.id)}">Ver ${A.perfil.rotulo.toLowerCase()}</a>`)).join('') : UI.vazio('Tudo em ordem', A.perfil.destaque === 'orcamento' ? 'Não há orçamentos aguardando resposta.' : 'Nenhum compromisso para hoje.', 'Novo ' + A.perfil.rotulo.toLowerCase(), 'novoServico')}</div></section><section class="section"><div class="section-heading"><h2>Parcelas vencidas</h2><a href="#/financeiro">Financeiro</a></div><div class="stack">${atrasadas.length ? atrasadas.map(p => UI.card(`<div class="list-card"><div class="grow"><h3>${U.escapar(p.servico.titulo)}</h3><p class="item-meta">Venceu em ${U.exibirData(p.vencimento)}</p></div><strong class="danger numero">${U.dinheiro(p.valor)}</strong></div><a href="#/servicos/${encodeURIComponent(p.servico.id)}" class="btn secundario compacto" style="margin-top:12px">Ver parcela</a>`)).join('') : `<p class="muted">Nenhuma parcela vencida. ✓</p>`}</div></section>`;
    }
    function bind(root) { root.querySelector('[data-action="novoServico"]')?.addEventListener('click', () => A.views.servicos.abrirForm()); }
    A.views = A.views || {};
    A.views.inicio = { render, bind };
})(window.AdmPro = window.AdmPro || {});
