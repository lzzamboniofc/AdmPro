/* Componentes e convenções de interface compartilhados. */
(function (A) {
    'use strict';
    const U = A.utils, $ = s => document.querySelector(s);
    const icones = { inicio: '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>', agenda: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>', clientes: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M17 6a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/>', servicos: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="m8 13 3 3 5-6"/>', financeiro: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20m-5 5h2"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 3-8 8-8s8 3 8 8"/>', logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', config: '<path d="M10.2 3.4h3.6l.6 2.2 1.8 1 2.2-.6 1.8 3.1-1.6 1.6v2.1l1.6 1.6-1.8 3.1-2.2-.6-1.8 1-.6 2.2h-3.6l-.6-2.2-1.8-1-2.2.6-1.8-3.1 1.6-1.6v-2.1L3.8 9.1l1.8-3.1 2.2.6 1.8-1 .6-2.2Z"/><circle cx="12" cy="12" r="3"/>', plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="M18 6 6 18M6 6l12 12"/>', edit: '<path d="m4 20 4-1 12-12-3-3L5 16l-1 4Z"/>', trash: '<path d="M4 7h16M10 4h4m-8 3 1 14h10l1-14M10 11v6m4-6v6"/>', back: '<path d="m15 18-6-6 6-6"/>', next: '<path d="m9 18 6-6-6-6"/>', empty: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 9h8M8 13h5m-5 4h8"/>', phone: '<path d="M6 3h4l1 5-2 2c1 2 3 4 5 5l2-2 5 1v4c0 2-2 3-4 3C9 21 3 15 3 7c0-2 1-4 3-4"/>', check: '<path d="m4 12 5 5L20 6"/>', sino: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>', repetir: '<path d="M3 11V7h15l-3-3m3 9v4H3l3 3"/>' };
    const icon = (nome, small = false) => `<svg class="icone${small ? ' small' : ''}" viewBox="0 0 24 24" aria-hidden="true">${icones[nome] || icones.empty}</svg>`;
    const chip = status => `<span class="chip ${['orcamento','agendado','andamento','concluido','pago','cancelado'].includes(status) ? status : 'cancelado'}">${({ orcamento: 'Orçamento', agendado: 'Agendado', andamento: 'Em andamento', concluido: 'Concluído', pago: 'Pago', cancelado: 'Cancelado' })[status] && (A.perfil?.status?.[status] || ({ orcamento: 'Orçamento', agendado: 'Agendado', andamento: 'Em andamento', concluido: 'Concluído', pago: 'Pago', cancelado: 'Cancelado' })[status]) || U.escapar(status)}</span>`;
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
    function mostrarToast(texto, rotulo, acao) {
        const root = $('#toast-root'); root.replaceChildren(); clearTimeout(timerToast);
        const div = document.createElement('div'); div.className = 'toast' + (acao ? ' toast-acao' : '');
        const label = document.createElement('span'); label.textContent = texto;
        div.append(label);
        if (acao) {
            const botao = document.createElement('button'); botao.type = 'button';
            botao.textContent = rotulo; botao.onclick = () => { root.replaceChildren(); acao(); };
            div.append(botao);
        }
        const fecharAviso = document.createElement('button'); fecharAviso.type = 'button';
        fecharAviso.className = 'toast-fechar'; fecharAviso.setAttribute('aria-label', 'Fechar aviso');
        fecharAviso.textContent = '×'; fecharAviso.onclick = () => { clearTimeout(timerToast); root.replaceChildren(); };
        div.append(fecharAviso); root.append(div);
        if (!acao) timerToast = setTimeout(() => root.replaceChildren(), 5000);
    }
    function toast(texto) { mostrarToast(texto); }
    let focoAnterior = null, yAnterior = 0;
    function fechar() {
        const root = $('#modal-root');
        if (!root.firstElementChild) return;
        root.replaceChildren();
        document.body.classList.remove('modal-aberto');
        document.documentElement.classList.remove('modal-scroll-lock');
        window.scrollTo(0, yAnterior);
        focoAnterior?.isConnected && focoAnterior.focus({ preventScroll:true });
        focoAnterior = null;
    }
    function confirmarDescarte(folha) {
        if ($('#modal-root .descarte-layer')) return;
        const overlay = document.createElement('div'); overlay.className = 'descarte-layer';
        overlay.innerHTML = `<section class="descarte-card" role="alertdialog" aria-modal="true" aria-labelledby="descarte-titulo" aria-describedby="descarte-texto"><h2 id="descarte-titulo">Descartar alterações?</h2><p id="descarte-texto">As informações não salvas serão perdidas.</p><div class="actions"><button type="button" class="btn secundario" data-manter>Continuar editando</button><button type="button" class="btn perigo" data-descartar>Descartar</button></div></section>`;
        $('#modal-root').append(overlay);
        const anterior = document.activeElement;
        const manter = () => { overlay.remove(); anterior?.isConnected && anterior.focus(); };
        overlay.querySelector('[data-manter]').onclick = manter;
        overlay.querySelector('[data-descartar]').onclick = () => { overlay.remove(); fechar(); };
        overlay.onkeydown = e => { e.stopPropagation(); if(e.key==='Escape'){e.preventDefault();manter();} };
        overlay.querySelector('[data-manter]').focus();
    }
    function fecharPeloUsuario() {
        const folha = $('#modal-root .sheet');
        if (folha?.dataset.alterado === 'true') { confirmarDescarte(folha); return; }
        fechar();
    }
    function modal(titulo, conteudo, aoAbrir) { fechar(); focoAnterior = document.activeElement; yAnterior = window.scrollY; const root = $('#modal-root'); root.innerHTML = `<div class="modal-layer"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><header class="sheet-header"><h2 id="sheet-title">${U.escapar(titulo)}</h2><button type="button" class="icon-button" data-close aria-label="Fechar">${icon('close')}</button></header>${conteudo}</section></div>`; document.body.classList.add('modal-aberto'); document.documentElement.classList.add('modal-scroll-lock'); root.querySelector('[data-close]').addEventListener('click', fecharPeloUsuario); root.querySelector('.modal-layer').addEventListener('click', e => { if (e.target.classList.contains('modal-layer'))
        fecharPeloUsuario(); }); mascara(root);
        const sheet = root.querySelector('.sheet');
        sheet.addEventListener('keydown', e => {
            if (e.key === 'Escape') { e.stopPropagation(); fecharPeloUsuario(); return; }
            if (e.key !== 'Tab') return;
            const focaveis = [...sheet.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')].filter(n => n.getClientRects().length);
            if (!focaveis.length) return;
            if (e.shiftKey && document.activeElement === focaveis[0]) { e.preventDefault(); focaveis.at(-1).focus(); }
            else if (!e.shiftKey && document.activeElement === focaveis.at(-1)) { e.preventDefault(); focaveis[0].focus(); }
        });
        sheet.addEventListener('focusin', e => { if (e.target.matches('input,select,textarea')) setTimeout(() => e.target.scrollIntoView({block:'nearest',behavior:'instant'}), 100); });
        root.querySelector('input,select,button')?.focus(); if (aoAbrir)
        aoAbrir(root.querySelector('.sheet')); }
    function confirmar(titulo, mensagem, acao, rotulo = 'Excluir') { modal(titulo, `<p>${U.escapar(mensagem)}</p><div class="actions"><button type="button" class="btn secundario" data-close2>Cancelar</button><button type="button" class="btn perigo" id="confirmar">${U.escapar(rotulo)}</button></div>`, sheet => { sheet.querySelector('[data-close2]').onclick = fechar; sheet.querySelector('#confirmar').onclick = (e) => { e.currentTarget.disabled = true; fechar(); try {
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
    function toastAcao(texto, rotulo, acao) { mostrarToast(texto, rotulo, acao); }
    const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    function editorHorarios(config) {
        const semana = A.regras.horariosSemana(config);
        const turno=(i,t,n)=>`<div class="horario-turno" data-turno><span>Período ${n+1}</span><input aria-label="Início do período ${n+1} de ${DIAS[i]}" type="time" data-inicio value="${t.inicio}" required><span>até</span><input aria-label="Fim do período ${n+1} de ${DIAS[i]}" type="time" data-fim value="${t.fim}" required><button type="button" class="icon-button" data-remover-turno aria-label="Remover período">${icon('trash')}</button></div>`;
        return `<fieldset class="horarios-editor"><legend>Horários por dia</legend><p class="muted">Crie quantos períodos precisar para representar almoço, pausas e jornadas diferentes.</p>${semana.map((d,i) => {
            const turnos=d.turnos?.length?d.turnos:[{inicio:'08:00',fim:'12:00'},{inicio:'13:00',fim:'18:00'}];
            return `<div class="horario-dia" data-dia="${i}"><label class="horario-toggle"><input type="checkbox" name="diaAtivo${i}" ${d.ativo?'checked':''}><strong>${DIAS[i]}</strong><span class="horario-estado">${d.ativo?'Aberto':'Fechado'}</span></label><div class="horario-turnos" ${d.ativo?'':'hidden'}><div class="horario-turnos-list">${turnos.map((t,n)=>turno(i,t,n)).join('')}</div><button type="button" class="btn secundario compacto" data-adicionar-turno>+ Adicionar período</button></div></div>`;
        }).join('')}<p class="field-error" data-erro-horarios role="alert"></p></fieldset>`;
    }
    function ativarEditorHorarios(root) {
        root.querySelectorAll('.horario-dia').forEach(dia => {
            const ativo=dia.querySelector('[name^="diaAtivo"]'),lista=dia.querySelector('.horario-turnos-list'),i=Number(dia.dataset.dia);
            const renumerar=()=>lista.querySelectorAll('[data-turno]').forEach((row,n)=>{
                row.querySelector('span').textContent='Período '+(n+1);
                row.querySelector('[data-inicio]').setAttribute('aria-label','Início do período '+(n+1)+' de '+DIAS[i]);
                row.querySelector('[data-fim]').setAttribute('aria-label','Fim do período '+(n+1)+' de '+DIAS[i]);
                row.querySelector('[data-remover-turno]').hidden=lista.querySelectorAll('[data-turno]').length===1;
            });
            const atualizar=()=>{
                dia.querySelector('.horario-turnos').hidden=!ativo.checked;
                dia.querySelector('.horario-estado').textContent=ativo.checked?'Aberto':'Fechado';
                dia.querySelectorAll('input[type="time"]').forEach(input=>input.disabled=!ativo.checked);
                dia.querySelector('[data-adicionar-turno]').disabled=!ativo.checked;
                renumerar();
            };
            ativo.addEventListener('change',atualizar);
            dia.querySelector('[data-adicionar-turno]').addEventListener('click',()=>{
                const rows=[...lista.querySelectorAll('[data-turno]')],ultimo=rows.at(-1);
                const inicio=ultimo?.querySelector('[data-fim]')?.value||'13:00';
                let fim='18:00';
                const m=A.utils.horaMinutos(inicio)+240;
                if(m<24*60)fim=A.utils.dois(Math.floor(m/60))+':'+A.utils.dois(m%60);
                lista.insertAdjacentHTML('beforeend',`<div class="horario-turno" data-turno><span>Período</span><input type="time" data-inicio value="${inicio}" required><span>até</span><input type="time" data-fim value="${fim}" required><button type="button" class="icon-button" data-remover-turno aria-label="Remover período">${icon('trash')}</button></div>`);
                atualizar();
            });
            lista.addEventListener('click',e=>{
                const b=e.target.closest('[data-remover-turno]');if(!b)return;
                if(lista.querySelectorAll('[data-turno]').length<=1)return;
                b.closest('[data-turno]').remove();renumerar();
            });
            atualizar();
        });
    }
    function lerEditorHorarios(form) {
        const semana=[];
        for(let i=0;i<7;i++) {
            const dia=form.querySelector(`.horario-dia[data-dia="${i}"]`),ativo=dia.querySelector('[name^="diaAtivo"]').checked;
            let turnos=[];
            if(ativo) {
                turnos=[...dia.querySelectorAll('[data-turno]')].map(row=>({inicio:row.querySelector('[data-inicio]').value,fim:row.querySelector('[data-fim]').value}));
                if(!turnos.length||turnos.some(t=>!t.inicio||!t.fim||t.inicio>=t.fim))
                    throw Error(`Revise os horários de ${DIAS[i]}; cada período precisa ter início e fim válidos.`);
                turnos.sort((a,b)=>a.inicio.localeCompare(b.inicio));
                for(let n=1;n<turnos.length;n++)if(turnos[n-1].fim>turnos[n].inicio)
                    throw Error(`Revise os horários de ${DIAS[i]}; períodos não podem se cruzar.`);
            }
            semana.push({ativo,turnos});
        }
        if(!semana.some(x=>x.ativo)) throw Error('Escolha pelo menos um dia de atendimento.');
        return semana;
    }
    A.ui = { editorHorarios, ativarEditorHorarios, lerEditorHorarios, toastAcao, icon, chip, card, vazio, campo, validar, erro, mascara, toast, modal, fechar, confirmar, tratarErro };
})(window.AdmPro = window.AdmPro || {});
