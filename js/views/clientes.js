/* Cadastro, pesquisa e histórico de clientes. */
(function (A) {
    'use strict';
    const U = A.utils, UI = A.ui, S = A.storage;
    let busca = '';
    function render() { const lista = S.lista('clientes').filter(c => (c.nome + ' ' + c.telefone).toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR'))).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')); return `<div class="page-heading"><div><h1>Clientes</h1><p class="muted">${S.lista('clientes').length} cadastrados</p></div></div><div class="field search-wrap"><label for="buscar-clientes">Buscar cliente</label><input id="buscar-clientes" placeholder="Nome ou telefone" value="${U.escapar(busca)}"></div><div id="lista-clientes" class="stack">${listaHTML(lista)}</div>`; }
    function listaHTML(lista) { return lista.length ? lista.map(c => UI.card(`<div class="list-card"><div class="grow"><h3>${U.escapar(c.nome)}</h3><p class="item-meta">${U.escapar(c.telefone)}</p></div><button class="btn secundario compacto" data-detail="${U.escapar(c.id)}">Detalhes</button></div>`)).join('') : UI.vazio('Nenhum cliente encontrado', 'Cadastre seu primeiro cliente ou altere a busca.', 'Novo cliente', 'novoCliente'); }
    function bind(root) { root.querySelector('#buscar-clientes').oninput = e => { busca = e.target.value; const lista = S.lista('clientes').filter(c => (c.nome + ' ' + c.telefone).toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR'))).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')); root.querySelector('#lista-clientes').innerHTML = listaHTML(lista); }; root.addEventListener('click', e => { const detail = e.target.closest('[data-detail]'); if (detail)
        detalhar(detail.dataset.detail); if (e.target.closest('[data-action="novoCliente"]'))
        abrirForm(); }); }
    function abrirForm(id, aoSalvar) { const c = id ? S.porId('clientes', id) : null; UI.modal(c ? 'Editar cliente' : 'Novo cliente', `<form id="form-cliente" class="form-grid">${UI.campo('Nome', 'nome', c?.nome || '', { required: true })}${UI.campo('Telefone', 'telefone', c?.telefone || '', { required: true, attrs: 'inputmode="tel" data-mask="telefone"' })}${UI.campo('Endereço', 'endereco', c?.endereco || '')}${UI.campo('Observações', 'observacoes', c?.observacoes || '', { type: 'textarea' })}<button class="btn" type="submit">Salvar cliente</button></form>`, sheet => { const form = sheet.querySelector('form'); form.addEventListener('submit', e => { e.preventDefault(); if (!UI.validar(form))
        return; const salvar = form.querySelector('[type="submit"]'); salvar.disabled = true; UI.tratarErro(() => { const dados = Object.fromEntries(new FormData(form)); dados.nome = dados.nome.trim(); dados.telefone = U.mascaraTelefone(dados.telefone); const novoId = id || U.id(); if (id)
        S.atualizar('clientes', id, dados);
    else
        S.adicionar('clientes', { id: novoId, ...dados, criadoEm: U.dataHora() }); UI.fechar(); UI.toast('Cliente salvo com sucesso.'); if (aoSalvar)
        aoSalvar(novoId);
    else
        A.app.refresh(); }); if (form.isConnected) salvar.disabled = false; }); }); }
    function detalhar(id) { const c = S.porId('clientes', id); if (!c) {
        UI.toast('Cliente não encontrado.');
        return;
    } const servicos = S.lista('servicos').filter(s => s.clienteId === id).sort((a, b) => b.data.localeCompare(a.data)); const gasto = U.somarValores(servicos.flatMap(s => s.parcelas.filter(p => p.pago).map(p => p.valor))); const whatsapp = U.numeroWhatsapp(c.telefone); UI.modal(c.nome, `<div class="stack"><p>${U.escapar(c.telefone)}</p>${c.endereco ? `<p class="muted">${U.escapar(c.endereco)}</p>` : ''}${c.observacoes ? `<p>${U.escapar(c.observacoes)}</p>` : ''}<div class="inline-row"><a class="btn secundario compacto" href="tel:${U.digitos(c.telefone)}">${UI.icon('phone', true)} Ligar</a><a class="btn secundario compacto" href="https://wa.me/${whatsapp}" target="_blank" rel="noopener noreferrer">WhatsApp</a></div><div class="divider"></div><h3>Total recebido desse cliente</h3><strong class="resumo-valor">${U.dinheiro(gasto)}</strong><h3>Histórico de ${A.perfil.plural.toLowerCase()}</h3>${servicos.length ? servicos.map(s => `<a href="#/servicos/${encodeURIComponent(s.id)}" class="card" style="text-decoration:none;color:var(--texto)" data-navigate><div class="list-card"><div><strong>${U.escapar(s.titulo)}</strong><p class="item-meta">${U.exibirData(s.data)} · ${U.dinheiro(s.total)}</p></div>${UI.chip(s.status)}</div></a>`).join('') : '<p class="muted">Nenhum registro ainda.</p>'}<div class="actions"><button class="btn secundario" id="editar-cliente">Editar</button><button class="btn perigo" id="excluir-cliente">Excluir</button></div></div>`, sheet => { sheet.querySelector('#editar-cliente').onclick = () => abrirForm(id); sheet.querySelector('#excluir-cliente').onclick = () => { if (servicos.length) {
        UI.toast('Exclusão bloqueada: cliente possui serviços vinculados.');
        return;
    } UI.confirmar('Excluir cliente?', `Deseja excluir ${c.nome}?`, () => { S.excluir('clientes', id); A.app.refresh(); UI.toast('Cliente excluído.'); }); }; sheet.querySelectorAll('[data-navigate]').forEach(a => a.onclick = () => UI.fechar()); }); }
    A.views = A.views || {};
    A.views.clientes = { render, bind, abrirForm, detalhar };
})(window.AdmPro = window.AdmPro || {});
