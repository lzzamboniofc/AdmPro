/* Manutenção do catálogo de serviços e produtos. */
(function (A) {
    'use strict';
    const U = A.utils, UI = A.ui, S = A.storage;
    function render() { const items = S.lista('catalogo').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')); return `<div class="page-heading"><div><h1>Catálogo</h1><p class="muted">Serviços e produtos disponíveis para orçamentos.</p></div></div><div class="stack">${items.length ? items.map(i => UI.card(`<div class="list-card"><div class="grow"><h3>${U.escapar(i.nome)}</h3><p class="item-meta">${i.categoria === 'produto' ? 'Produto' : 'Serviço'} · ${U.dinheiro(i.preco)} · ${i.ativo ? 'Ativo' : 'Inativo'}</p></div><div class="item-actions"><button class="icon-button" data-edit="${i.id}" aria-label="Editar ${U.escapar(i.nome)}">${UI.icon('edit')}</button><button class="icon-button" data-del="${i.id}" aria-label="Excluir ${U.escapar(i.nome)}">${UI.icon('trash')}</button></div></div><label class="check-row"><input type="checkbox" data-toggle="${i.id}" ${i.ativo ? 'checked' : ''}>Ativo no formulário</label>`)).join('') : UI.vazio('Catálogo vazio', 'Adicione serviços ou produtos com seus preços.', 'Adicionar item', 'novoItem')}</div>`; }
    function bind(root) { root.addEventListener('click', e => { const editar = e.target.closest('[data-edit]'), apagar = e.target.closest('[data-del]'); if (editar)
        abrirForm(editar.dataset.edit); if (e.target.closest('[data-action="novoItem"]'))
        abrirForm(); if (apagar) {
        const id = apagar.dataset.del, utilizado = S.lista('servicos').some(s => s.itens.some(i => i.catalogoId === id));
        if (utilizado) {
            UI.toast('Item já usado em serviços: desative-o em vez de excluir.');
            return;
        }
        UI.confirmar('Excluir item?', 'Esta ação não pode ser desfeita.', () => { S.excluir('catalogo', id); A.app.refresh(); UI.toast('Item excluído.'); });
    } }); root.querySelectorAll('[data-toggle]').forEach(el => el.onchange = () => UI.tratarErro(() => { S.atualizar('catalogo', el.dataset.toggle, { ativo: el.checked }); UI.toast('Disponibilidade atualizada.'); })); }
    function abrirForm(id) { const c = id ? S.porId('catalogo', id) : null; UI.modal(c ? 'Editar item' : 'Novo item', `<form id="form-catalogo" class="form-grid">${UI.campo('Nome', 'nome', c?.nome || '', { required: true })}${UI.campo('Categoria', 'categoria', c?.categoria || 'servico', { options: [{ value: 'servico', label: 'Serviço' }, { value: 'produto', label: 'Produto' }] })}${UI.campo('Preço (R$)', 'preco', U.numerico(c?.preco || 0), { required: true, attrs: 'inputmode="decimal" data-mask="moeda"' })}${UI.campo('Duração em minutos', 'duracaoMin', c?.duracaoMin ?? 60, { type: 'number', attrs: 'min="0" step="5" inputmode="numeric"' })}<label class="check-row"><input type="checkbox" name="ativo" ${c?.ativo !== false ? 'checked' : ''}>Ativo</label><button class="btn" type="submit">Salvar item</button></form>`, sheet => { sheet.querySelector('form').onsubmit = e => { e.preventDefault(); const f = e.currentTarget; if (!UI.validar(f))
        return; const d = new FormData(f); const preco = U.lerMoeda(d.get('preco')); if (preco <= 0) {
        UI.erro(f, 'preco', 'Informe um preço maior que zero.');
        return;
    } UI.tratarErro(() => { const dados = { nome: d.get('nome').trim(), categoria: d.get('categoria'), preco, duracaoMin: Math.max(0, Number(d.get('duracaoMin')) || 0), ativo: d.has('ativo') }; if (id)
        S.atualizar('catalogo', id, dados);
    else
        S.adicionar('catalogo', { id: U.id(), ...dados }); UI.fechar(); A.app.refresh(); UI.toast('Catálogo atualizado.'); }); }; }); }
    A.views = A.views || {};
    A.views.catalogo = { render, bind, abrirForm };
})(window.AdmPro = window.AdmPro || {});
