/* Componentes e convenções de interface compartilhados. */
(function (A) {
    'use strict';
    const U = A.utils, $ = s => document.querySelector(s);
    const icones = { inicio: '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>', agenda: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>', clientes: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M17 6a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/>', servicos: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="m8 13 3 3 5-6"/>', financeiro: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20m-5 5h2"/>', config: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1m0-14.2L17 7M7 17l-2.1 2.1"/>', plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="M18 6 6 18M6 6l12 12"/>', edit: '<path d="m4 20 4-1 12-12-3-3L5 16l-1 4Z"/>', trash: '<path d="M4 7h16M10 4h4m-8 3 1 14h10l1-14M10 11v6m4-6v6"/>', back: '<path d="m15 18-6-6 6-6"/>', next: '<path d="m9 18 6-6-6-6"/>', empty: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 9h8M8 13h5m-5 4h8"/>', phone: '<path d="M6 3h4l1 5-2 2c1 2 3 4 5 5l2-2 5 1v4c0 2-2 3-4 3C9 21 3 15 3 7c0-2 1-4 3-4"/>', check: '<path d="m4 12 5 5L20 6"/>' };
    const icon = (nome, small = false) => `<svg class="icone${small ? ' small' : ''}" viewBox="0 0 24 24" aria-hidden="true">${icones[nome] || icones.empty}</svg>`;
    const chip = status => `<span class="chip ${U.escapar(status)}">${({ orcamento: 'Orçamento', agendado: 'Agendado', andamento: 'Em andamento', concluido: 'Concluído', pago: 'Pago', cancelado: 'Cancelado' })[status] || U.escapar(status)}</span>`;
    const card = (conteudo, extra = '') => `<article class="card ${extra}">${conteudo}</article>`;
    const vazio = (titulo, descricao, botao = '', acao = '') => `<div class="empty"><svg viewBox="0 0 24 24" aria-hidden="true">${icones.empty}</svg><h3>${U.escapar(titulo)}</h3><p>${U.escapar(descricao)}</p>${botao ? `<button class="btn compacto" data-action="${U.escapar(acao)}">${U.escapar(botao)}</button>` : ''}</div>`;
    const campo = (label, nome, valor = '', opts = {}) => { const required = opts.required ? 'data-required="true"' : ''; const extras = opts.attrs || ''; const tipo = opts.type || 'text'; const elemento = opts.options ? `<select id="f_${nome}" name="${nome}" ${required} ${extras}>${opts.options.map(o => `<option value="${U.escapar(o.value)}" ${String(o.value) === String(valor) ? 'selected' : ''}>${U.escapar(o.label)}</option>`).join('')}</select>` : tipo === 'textarea' ? `<textarea id="f_${nome}" name="${nome}" ${required} ${extras}>${U.escapar(valor)}</textarea>` : `<input id="f_${nome}" type="${tipo}" name="${nome}" value="${U.escapar(valor)}" ${required} ${extras}>`; return `<div class="field"><label for="f_${nome}">${U.escapar(label)}${opts.required ? ' *' : ''}</label>${elemento}<div class="field-error" data-error-for="${nome}" aria-live="polite"></div></div>`; };
    function validar(form) { let ok = true; form.querySelectorAll('[data-required="true"]').forEach(c => { let msg = ''; if (!String(c.value || '').trim())
        msg = 'Este campo é obrigatório.';
    else if (c.name === 'telefone' && U.digitos(c.value).length < 10)
        msg = 'Informe um telefone com DDD.';
    else if (c.name === 'nomeNegocio' && c.value.trim().length < 2)
        msg = 'Informe pelo menos 2 caracteres.'; if (c.name === 'valor' && (!Number.isFinite(U.lerMoeda(c.value)) || U.lerMoeda(c.value) <= 0))
        msg = 'Informe um valor maior que zero.'; erro(form, c.name, msg); if (msg)
        ok = false; }); if (!ok)
        form.querySelector('[aria-invalid="true"]')?.focus(); return ok; }
    function erro(form, nome, mensagem) { const entrada = form.querySelector(`[name="${nome}"]`), saida = form.querySelector(`[data-error-for="${nome}"]`); if (entrada) {
        if (mensagem)
            entrada.setAttribute('aria-invalid', 'true');
        else
            entrada.removeAttribute('aria-invalid');
    } if (saida)
        saida.textContent = mensagem || ''; }
    function mascara(container) { container.querySelectorAll('[data-mask="telefone"]').forEach(e => e.addEventListener('input', () => e.value = U.mascaraTelefone(e.value))); container.querySelectorAll('[data-mask="moeda"]').forEach(e => e.addEventListener('input', () => e.value = U.mascaraMoeda(e.value))); }
    let timerToast;
    function toast(texto) { const root = $('#toast-root'); root.textContent = ''; const div = document.createElement('div'); div.className = 'toast'; div.textContent = texto; root.append(div); clearTimeout(timerToast); timerToast = setTimeout(() => root.replaceChildren(), 3500); }
    function fechar() { const root = $('#modal-root'); root.replaceChildren(); document.body.style.overflow = ''; }
    function modal(titulo, conteudo, aoAbrir) { fechar(); const root = $('#modal-root'); root.innerHTML = `<div class="modal-layer"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><header class="sheet-header"><h2 id="sheet-title">${U.escapar(titulo)}</h2><button type="button" class="icon-button" data-close aria-label="Fechar">${icon('close')}</button></header>${conteudo}</section></div>`; document.body.style.overflow = 'hidden'; root.querySelector('[data-close]').addEventListener('click', fechar); root.querySelector('.modal-layer').addEventListener('click', e => { if (e.target.classList.contains('modal-layer'))
        fechar(); }); mascara(root); root.querySelector('input,select,button')?.focus(); if (aoAbrir)
        aoAbrir(root.querySelector('.sheet')); }
    function confirmar(titulo, mensagem, acao, rotulo = 'Excluir') { modal(titulo, `<p>${U.escapar(mensagem)}</p><div class="actions"><button type="button" class="btn secundario" data-close2>Cancelar</button><button type="button" class="btn perigo" id="confirmar">${U.escapar(rotulo)}</button></div>`, sheet => { sheet.querySelector('[data-close2]').onclick = fechar; sheet.querySelector('#confirmar').onclick = () => { fechar(); try {
        acao();
    }
    catch (e) {
        toast(e.message);
    } }; }); }
    function tratarErro(acao) { try {
        acao();
    }
    catch (e) {
        console.error(e);
        toast(e.message || 'Ocorreu um erro.');
    } }
    A.ui = { icon, chip, card, vazio, campo, validar, erro, mascara, toast, modal, fechar, confirmar, tratarErro };
})(window.AdmPro = window.AdmPro || {});
