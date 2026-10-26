/* Preferências, logo, backup e remoção segura de dados. */
(function (A) {
    'use strict';
    const U = A.utils, UI = A.ui, S = A.storage;
    function render() { const c = S.obter('config'); return `<div class="page-heading"><div><h1>Configurações</h1><p class="muted">Dados do negócio, aparência e segurança.</p></div></div>${UI.card(`<form id="form-config" class="form-grid">${UI.campo('Nome do negócio', 'nomeNegocio', c.nomeNegocio, { required: true })}${UI.campo('Telefone', 'telefone', c.telefone, { required: true, attrs: 'data-mask="telefone" inputmode="tel"' })}${UI.campo('Perfil de negócio', 'tipoNegocio', c.tipoNegocio, { options: [{ value: 'rapido', label: 'Atendimento rápido' }, { value: 'projeto', label: 'Projetos' }] })}${UI.campo('Tema', 'tema', c.tema, { options: [{ value: 'claro', label: 'Claro' }, { value: 'escuro', label: 'Escuro' }, { value: 'auto', label: 'Automático (sistema)' }] })}<div class="form-grid duas">${UI.campo('Hora de início', 'horaInicio', c.horaInicio, { required: true, type: 'time' })}${UI.campo('Hora de término', 'horaFim', c.horaFim, { required: true, type: 'time' })}</div><div class="field"><span class="label">Dias de atendimento</span><div class="dias">${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => `<label><input type="checkbox" name="dias" value="${i}" ${c.diasAtendimento.includes(i) ? 'checked' : ''}>${d}</label>`).join('')}</div><div class="field-error" id="erro-dias"></div></div><div class="field"><label for="arquivo-logo">Logo (imagem até 256px)</label>${c.logoBase64 ? `<img src="${c.logoBase64}" alt="Logo atual" style="width:64px;height:64px;object-fit:contain">` : ''}<input id="arquivo-logo" type="file" accept="image/*"><button type="button" id="remover-logo" class="btn secundario compacto">Remover logo</button></div><button class="btn" type="submit">Salvar configurações</button></form>`)}<section class="section"><h2 style="margin-bottom:12px">Catálogo</h2>${UI.card(`<p class="muted">Gerencie serviços, produtos, preços e disponibilidade.</p><a class="btn secundario mobile-full" style="margin-top:12px" href="#/catalogo">Gerenciar catálogo</a>`)}</section><section class="section"><h2 style="margin-bottom:12px">Backup e dados</h2>${UI.card(`<div class="stack"><button type="button" class="btn secundario" id="exportar">Exportar backup (.json)</button><label class="btn secundario" for="importar" style="cursor:pointer">Importar backup (.json)</label><input type="file" id="importar" accept=".json,application/json" class="sr-only"><button type="button" class="btn perigo" id="apagar">Apagar todos os dados</button><p class="muted">Os dados ficam apenas neste navegador. Faça backups regularmente.</p></div>`)}</section>`; }
    function imagemReduzida(file) { return new Promise((resolve, reject) => { if (!file) {
        resolve(null);
        return;
    } if (!file.type.startsWith('image/')) {
        reject(Error('Selecione uma imagem válida.'));
        return;
    } const reader = new FileReader(); reader.onerror = () => reject(Error('Não foi possível ler a imagem.')); reader.onload = () => { const img = new Image(); img.onerror = () => reject(Error('Imagem inválida.')); img.onload = () => { const escala = Math.min(1, 256 / Math.max(img.width, img.height)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.width * escala)); canvas.height = Math.max(1, Math.round(img.height * escala)); canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/png')); }; img.src = reader.result; }; reader.readAsDataURL(file); }); }
    function baixarBackup() { const texto = JSON.stringify(S.exportar(), null, 2), url = URL.createObjectURL(new Blob([texto], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `admpro-backup-${U.hoje()}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); UI.toast('Backup exportado.'); }
    function bind(root) {
        let apagarLogo = false;
        const f = root.querySelector('#form-config');
        UI.mascara(f);
        root.querySelector('#remover-logo').onclick = () => { apagarLogo = true; root.querySelector('#arquivo-logo').value = ''; UI.toast('A logo será removida ao salvar.'); };
        f.onsubmit = async (e) => { e.preventDefault(); if (!UI.validar(f))
            return; const d = new FormData(f), dias = d.getAll('dias').map(Number); if (d.get('horaInicio') >= d.get('horaFim') || !dias.length) {
            root.querySelector('#erro-dias').textContent = 'Selecione dias e um horário final posterior ao inicial.';
            return;
        } try {
            const antigo = S.obter('config');
            const arquivo = root.querySelector('#arquivo-logo').files[0];
            const logo = arquivo ? await imagemReduzida(arquivo) : (apagarLogo ? '' : antigo.logoBase64);
            const novo = { ...antigo, nomeNegocio: d.get('nomeNegocio').trim(), telefone: U.mascaraTelefone(d.get('telefone')), tipoNegocio: d.get('tipoNegocio'), tema: d.get('tema'), horaInicio: d.get('horaInicio'), horaFim: d.get('horaFim'), diasAtendimento: dias, logoBase64: logo };
            S.gravar('config', novo);
            A.app.aplicarConfig();
            A.app.refresh();
            UI.toast('Configurações salvas.');
        }
        catch (erro) {
            UI.toast(erro.message);
        } };
        root.querySelector('#exportar').onclick = () => UI.tratarErro(baixarBackup);
        root.querySelector('#importar').onchange = async (e) => { const file = e.target.files?.[0]; e.target.value = ''; if (!file)
            return; try {
            const dados = JSON.parse(await file.text());
            S.validarBackup(dados);
            UI.confirmar('Importar backup?', 'Os dados atuais serão substituídos pelos dados do arquivo.', () => UI.tratarErro(() => { S.importar(dados); A.app.iniciar(); UI.toast('Backup restaurado.'); }), 'Importar');
        }
        catch (erro) {
            UI.toast(erro.message || 'JSON inválido.');
        } };
        root.querySelector('#apagar').onclick = () => UI.confirmar('Apagar todos os dados?', 'Esta ação elimina configurações, clientes, serviços e financeiro deste navegador.', () => { UI.modal('Confirmação final', `<p>Digite <strong>APAGAR</strong> para excluir definitivamente os dados.</p><form id="confirma-apagar" class="form-grid" style="margin-top:16px">${UI.campo('Confirmação', 'confirmacao', '', { required: true })}<button class="btn perigo" type="submit">Excluir definitivamente</button></form>`, sheet => { sheet.querySelector('form').onsubmit = e => { e.preventDefault(); if (sheet.querySelector('[name="confirmacao"]').value.trim() !== 'APAGAR') {
            UI.erro(sheet.querySelector('form'), 'confirmacao', 'Digite APAGAR exatamente.');
            return;
        } UI.tratarErro(() => { S.limpar(); UI.fechar(); A.app.iniciar(); UI.toast('Dados apagados.'); }); }; }); }, 'Continuar');
    }
    A.views = A.views || {};
    A.views.config = { render, bind };
})(window.AdmPro = window.AdmPro || {});
