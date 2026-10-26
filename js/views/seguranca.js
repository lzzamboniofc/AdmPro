/* PIN local: não substitui autenticação no servidor nem criptografa os dados. */
(function (A) {
    'use strict';
    const S = A.storage, U = A.utils, UI = A.ui;
    let entrada = '';
    let timer;
    function marca() { return '<img class="marca-vertical" src="img/logo/svg/logo-vertical.svg" alt="AdmPro — Gestão simples" width="168" height="168">'; }
    function renderCadastro() {
        return `<section class="tela-seguranca">${marca()}<h1>Crie um PIN de 4 dígitos</h1><p class="muted">Proteja o acesso neste navegador. Esta é uma proteção local simples.</p>${UI.card(`<form id="form-criar-pin" class="form-grid"><div class="field"><label for="novo-pin">Novo PIN</label><input id="novo-pin" name="pin" type="password" pattern="[0-9]{4}" maxlength="4" autocomplete="new-password" inputmode="numeric" required></div><div class="field"><label for="confirma-pin">Confirme o PIN</label><input id="confirma-pin" name="confirmacao" type="password" pattern="[0-9]{4}" maxlength="4" autocomplete="new-password" inputmode="numeric" required></div><p class="pin-erro" id="erro-pin" role="alert"></p><button class="btn" type="submit">Salvar PIN e entrar</button></form>`)}</section>`;
    }
    function bindCadastro(root) {
        const f = root.querySelector('#form-criar-pin');
        f.onsubmit = async e => {
            e.preventDefault();
            const pin = f.elements.pin.value, confirmar = f.elements.confirmacao.value;
            if (!/^\d{4}$/.test(pin) || pin !== confirmar) { root.querySelector('#erro-pin').textContent = 'Os dois PINs devem ser iguais e conter 4 dígitos.'; return; }
            const btn = f.querySelector('[type="submit"]'); btn.disabled = true;
            try { await S.definirPin(pin); A.app.iniciar(); UI.toast('PIN criado com sucesso.'); }
            catch (erro) { root.querySelector('#erro-pin').textContent = erro.message; btn.disabled = false; }
        };
    }
    function renderBloqueio() {
        return `<section class="tela-seguranca">${marca()}<h1>${U.escapar(S.obter('config')?.nomeNegocio || 'AdmPro')}</h1><p class="muted">Informe seu PIN para acessar os dados.</p>${UI.card(`<form id="form-desbloquear"><label class="pin-label" for="pin-entrada">PIN de 4 dígitos</label><input class="pin-input" id="pin-entrada" type="password" inputmode="numeric" autocomplete="off" maxlength="4" pattern="[0-9]{4}" aria-describedby="pin-erro"><div class="teclado-pin" aria-label="Teclado numérico">${[1,2,3,4,5,6,7,8,9,'limpar',0,'apagar'].map(n => `<button type="button" data-tecla="${n}" aria-label="${n === 'apagar' ? 'Apagar último dígito' : n === 'limpar' ? 'Limpar PIN' : n}">${n === 'apagar' ? '⌫' : n === 'limpar' ? 'C' : n}</button>`).join('')}</div><div class="pin-erro" id="pin-erro" role="alert" aria-live="polite"></div><button class="btn" type="submit">Entrar</button></form><p class="muted" style="margin-top:12px">Esqueceu o PIN? A recuperação exige apagar os dados locais. Consulte seu backup.</p>`)}</section>`;
    }
    function bindBloqueio(root) {
        clearTimeout(timer); entrada = '';
        const form = root.querySelector('#form-desbloquear');
        const input = form.querySelector('#pin-entrada');
        const botoes = [...form.querySelectorAll('button')];
        const aviso = form.querySelector('#pin-erro');
        const atualizar = () => { input.value = entrada; const restante = S.bloqueioRestante(); botoes.forEach(b => b.disabled = restante > 0); if (restante) aviso.textContent = `Muitas tentativas. Aguarde ${restante} segundo(s).`; };
        const verificarBloqueio = () => { atualizar(); if (S.bloqueioRestante() && root.isConnected) timer = setTimeout(verificarBloqueio, 1000); else if (!S.bloqueioRestante()) aviso.textContent = ''; };
        input.oninput = () => { entrada = U.digitos(input.value).slice(0, 4); atualizar(); };
        form.querySelectorAll('[data-tecla]').forEach(b => b.onclick = () => {
            if (S.bloqueioRestante()) return;
            const tecla = b.dataset.tecla;
            entrada = tecla === 'limpar' ? '' : tecla === 'apagar' ? entrada.slice(0, -1) : (entrada + tecla).slice(0, 4);
            aviso.textContent = ''; atualizar();
        });
        form.onsubmit = async e => {
            e.preventDefault();
            if (S.bloqueioRestante()) { verificarBloqueio(); return; }
            if (!/^\d{4}$/.test(entrada)) { aviso.textContent = 'Digite os 4 números do PIN.'; return; }
            botoes.forEach(b => b.disabled = true);
            try {
                if (await S.verificarPin(entrada)) { S.abrirSessao(); entrada = ''; clearTimeout(timer); A.app.iniciar(); }
                else {
                    entrada = ''; input.value = '';
                    const bloqueio = S.registrarErroPin();
                    aviso.textContent = bloqueio ? 'PIN bloqueado por 30 segundos.' : 'PIN incorreto. Tente novamente.';
                    if (bloqueio) verificarBloqueio();
                    else botoes.forEach(b => b.disabled = false);
                }
            } catch (erro) { aviso.textContent = erro.message; botoes.forEach(b => b.disabled = false); }
        };
        atualizar(); if (S.bloqueioRestante()) verificarBloqueio();
    }
    A.views = A.views || {};
    A.views.seguranca = { renderCadastro, bindCadastro, renderBloqueio, bindBloqueio };
})(window.AdmPro = window.AdmPro || {});
