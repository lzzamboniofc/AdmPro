/* Fluxo inicial de três etapas e escolha de dados de exemplo. */
(function (A) {
    'use strict';
    const U = A.utils, UI = A.ui;
    let passo = 1;
    let rascunho = { nomeNegocio: '', telefone: '', tipoNegocio: 'rapido', horaInicio: '08:00', horaFim: '18:00', diasAtendimento: [1, 2, 3, 4, 5, 6] };
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    function render() {
        let interior = '';
        if (passo === 1)
            interior = `<h1>Boas-vindas ao AdmPro</h1><p class="muted" style="margin:12px 0 24px">Vamos configurar o seu negócio.</p><form id="onboard-form" class="form-grid">${UI.campo('Nome do negócio', 'nomeNegocio', rascunho.nomeNegocio, { required: true })}${UI.campo('Telefone com DDD', 'telefone', rascunho.telefone, { required: true, attrs: 'inputmode="tel" data-mask="telefone"' })}<button class="btn" type="submit">Continuar</button></form>`;
        if (passo === 2)
            interior = `<h1>Qual é o seu tipo de trabalho?</h1><p class="muted" style="margin:12px 0 24px">As telas e dados são os mesmos. Só muda a experiência.</p><div class="option-cards"><button class="option-card" data-tipo="rapido" aria-pressed="${rascunho.tipoNegocio === 'rapido'}">${UI.icon('agenda')}<strong>Atendimento rápido</strong><small>Manicure, barbearia, personal, estética e similares.</small></button><button class="option-card" data-tipo="projeto" aria-pressed="${rascunho.tipoNegocio === 'projeto'}">${UI.icon('servicos')}<strong>Projetos</strong><small>Energia solar, obras, instalações e reformas.</small></button></div><div class="actions"><button class="btn secundario" data-prev>Voltar</button><button class="btn" data-next>Continuar</button></div>`;
        if (passo === 3)
            interior = `<h1>Horário de atendimento</h1><p class="muted" style="margin:12px 0 24px">Escolha seus dias e seu horário habitual.</p><form id="horario-form" class="form-grid"><div class="form-grid duas">${UI.campo('Início', 'horaInicio', rascunho.horaInicio, { type: 'time', required: true })}${UI.campo('Fim', 'horaFim', rascunho.horaFim, { type: 'time', required: true })}</div><div class="field"><span class="label">Dias de atendimento</span><div class="dias">${dias.map((d, i) => `<label><input type="checkbox" name="dia" value="${i}" ${rascunho.diasAtendimento.includes(i) ? 'checked' : ''}>${d}</label>`).join('')}</div><div class="field-error" id="dias-erro"></div></div><div class="actions"><button class="btn secundario" data-prev type="button">Voltar</button><button class="btn" type="submit">Continuar</button></div></form>`;
        if (passo === 4)
            interior = `<h1>Pronto para começar!</h1><p class="muted" style="margin:12px 0 24px">Escolha se prefere explorar exemplos ou cadastrar tudo do zero.</p><div class="stack"><button class="btn" data-finish="exemplo">Começar com dados de exemplo</button><button class="btn secundario" data-finish="vazio">Começar vazio</button><button class="btn ghost" data-prev>Voltar</button></div>`;
        return `<div class="onboarding"><div class="onboarding-marca"><img class="marca-tema-claro" src="img/logo/svg/logo-vertical.svg" alt="AdmPro — Gestão simples" width="176" height="176"><img class="marca-tema-escuro" src="img/logo/svg/logo-horizontal-negativo.svg" alt="AdmPro — Gestão simples" width="176" height="47"></div><div class="progress">Etapa ${Math.min(passo, 3)} de 3</div>${UI.card(interior)}</div>`;
    }
    function bind(root) {
        UI.mascara(root);
        root.querySelector('[data-prev]')?.addEventListener('click', () => { passo--; A.app.refresh(); });
        root.querySelectorAll('[data-tipo]').forEach(b => b.onclick = () => { rascunho.tipoNegocio = b.dataset.tipo; A.app.refresh(); });
        root.querySelector('[data-next]')?.addEventListener('click', () => { passo++; A.app.refresh(); });
        root.querySelector('#onboard-form')?.addEventListener('submit', e => { e.preventDefault(); if (!UI.validar(e.currentTarget))
            return; const d = new FormData(e.currentTarget); rascunho.nomeNegocio = d.get('nomeNegocio').trim(); rascunho.telefone = U.mascaraTelefone(d.get('telefone')); passo = 2; A.app.refresh(); });
        root.querySelector('#horario-form')?.addEventListener('submit', e => { e.preventDefault(); const f = e.currentTarget; const dias = Array.from(f.querySelectorAll('[name="dia"]:checked'), c => Number(c.value)); const valido = UI.validar(f) && f.elements.namedItem('horaInicio').value < f.elements.namedItem('horaFim').value && dias.length > 0; if (!valido) {
            root.querySelector('#dias-erro').textContent = 'Selecione dias e informe um horário final posterior ao inicial.';
            return;
        } rascunho.horaInicio = f.elements.namedItem('horaInicio').value; rascunho.horaFim = f.elements.namedItem('horaFim').value; rascunho.diasAtendimento = dias; passo = 4; A.app.refresh(); });
        root.querySelectorAll('[data-finish]').forEach(b => b.onclick = () => UI.tratarErro(() => { A.storage.gravar('config', { ...rascunho, logoBase64: '', tema: 'auto' }); if (b.dataset.finish === 'exemplo')
            A.storage.exemplo(rascunho.tipoNegocio); passo = 1; A.app.iniciar(); UI.toast('Seu negócio está pronto!'); }));
    }
    A.views = A.views || {};
    A.views.onboarding = { render, bind };
})(window.AdmPro = window.AdmPro || {});
