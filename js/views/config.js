/* Preferências, logo, backup e remoção segura de dados. */
(function (A) {
    'use strict';
    const U = A.utils, UI = A.ui, S = A.storage;
    function render() { const c = S.obter('config'); return `<div class="page-heading"><div><h1>Configurações</h1><p class="muted">Dados do negócio, aparência e segurança.</p></div></div>${UI.card(`<form id="form-config" class="form-grid">${UI.campo('Nome do negócio', 'nomeNegocio', c.nomeNegocio, { required: true })}${UI.campo('Telefone', 'telefone', c.telefone, { required: true, attrs: 'data-mask="telefone" inputmode="tel"' })}${UI.campo('Modelo de negócio','modeloNegocio',c.modeloNegocio || 'outro',{options:Object.entries(A.modelos).map(([id,m])=>({value:id,label:m.nome}))})}${UI.campo('Perfil de negócio', 'tipoNegocio', c.tipoNegocio, { options: [{ value: 'rapido', label: 'Atendimento rápido' }, { value: 'projeto', label: 'Projetos' }] })}${UI.campo('Tema', 'tema', c.tema, { options: [{ value: 'claro', label: 'Claro' }, { value: 'escuro', label: 'Escuro' }, { value: 'auto', label: 'Automático (sistema)' }] })}<div class="form-grid duas">${UI.campo('Hora de início', 'horaInicio', c.horaInicio, { required: true, type: 'time' })}${UI.campo('Hora de término', 'horaFim', c.horaFim, { required: true, type: 'time' })}</div><div class="field"><span class="label">Dias de atendimento</span><div class="dias">${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => `<label><input type="checkbox" name="dias" value="${i}" ${c.diasAtendimento.includes(i) ? 'checked' : ''}>${d}</label>`).join('')}</div><div class="field-error" id="erro-dias"></div></div><div class="field"><label for="arquivo-logo">Logo (imagem até 256px)</label>${/^data:image\/(png|jpeg|webp);base64,/.test(c.logoBase64 || '') ? `<img src="${U.escapar(c.logoBase64)}" alt="Logo atual" style="width:64px;height:64px;object-fit:contain">` : ''}<input id="arquivo-logo" type="file" accept="image/*"><button type="button" id="remover-logo" class="btn secundario compacto">Remover logo</button></div><button class="btn" type="submit">Salvar configurações</button></form>`)}<section class="section"><h2 style="margin-bottom:12px">Gestão</h2>${UI.card(`<div class="gestao-links"><a href="#/gestao/meta">Meta mensal</a><a href="#/catalogo">Catálogo</a><a href="#/gestao/estoque">Estoque</a><a href="#/gestao/profissionais">Profissionais</a><a href="#/gestao/despesas">Despesas fixas</a></div>`)}</section><section class="section"><h2>Instalação</h2>${A.app.podeInstalar()?UI.card('<button class="btn" id="instalar-app">Instalar app</button>'):A.app.instalada() ? UI.card('<p class="muted">O AdmPro já está instalado.</p>') : /iPad|iPhone|iPod/.test(navigator.userAgent) ? UI.card('<p>No iPhone: Compartilhar &gt; Adicionar à Tela de Início.</p>') : UI.card('<p class="muted">A instalação estará disponível ao abrir por HTTP(S) em navegador compatível.</p>')}</section><section class="section"><h2 style="margin-bottom:12px">Backup e dados</h2>${UI.card(`<div class="stack"><button type="button" class="btn secundario" id="exportar">Exportar backup (.json)</button><label class="btn secundario" for="importar" style="cursor:pointer">Importar backup (.json)</label><input type="file" id="importar" accept=".json,application/json" class="sr-only"><button type="button" class="btn perigo" id="apagar">Apagar todos os dados</button><p class="muted">Os dados ficam apenas neste navegador. Faça backups regularmente.</p></div>`)}</section><section class="section"><h2 style="margin-bottom:12px">Segurança</h2>${UI.card(`<div class="stack"><button class="btn secundario" type="button" id="alterar-pin">Alterar PIN</button><button class="btn secundario" type="button" id="esqueci-pin">Esqueci o PIN</button></div>`)}</section><section class="section">${UI.card(`<button type="button" class="btn perigo" id="sair-config">Sair</button>`)}</section>`; }
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
        } const salvar = f.querySelector('[type="submit"]'); salvar.disabled = true; try {
            const antigo = S.obter('config');
            const arquivo = root.querySelector('#arquivo-logo').files[0];
            const logo = arquivo ? await imagemReduzida(arquivo) : (apagarLogo ? '' : antigo.logoBase64);
            const novo = { ...antigo, nomeNegocio: d.get('nomeNegocio').trim(), telefone: U.mascaraTelefone(d.get('telefone')), tipoNegocio: d.get('modeloNegocio')!=='outro' && d.get('modeloNegocio')!==antigo.modeloNegocio ? A.modelos[d.get('modeloNegocio')].tipoNegocio : d.get('tipoNegocio'), modeloNegocio:d.get('modeloNegocio'), tema: d.get('tema'), horaInicio: d.get('horaInicio'), horaFim: d.get('horaFim'), diasAtendimento: dias, logoBase64: logo };
            S.gravar('config', novo);
            A.app.aplicarConfig();
            A.app.refresh();
            UI.toast('Configurações salvas.');
            if (antigo.modeloNegocio !== novo.modeloNegocio && novo.modeloNegocio !== 'outro') UI.confirmar('Adicionar catálogo do modelo?','Se desejar, adicionaremos itens de exemplo sem excluir os itens atuais.',()=>{ const modelo=A.modelos[novo.modeloNegocio];modelo.catalogo.forEach(item=>S.adicionar('catalogo',{id:U.id(),...item,ativo:true}));UI.toast('Itens do modelo adicionados.');},'Adicionar exemplos');
        }
        catch (erro) {
            UI.toast(erro.message);
            salvar.disabled = false;
        } };
        root.querySelector('#instalar-app')?.addEventListener('click',()=>A.app.instalar());
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
        root.querySelector('#sair-config').onclick = A.app.sair;
        root.querySelector('#alterar-pin').onclick = () => UI.modal('Alterar PIN', `<form id="form-troca-pin" class="form-grid">${UI.campo('PIN atual', 'pinAtual', '', { required:true, type:'password', attrs:'inputmode="numeric" maxlength="4" autocomplete="off"' })}${UI.campo('Novo PIN', 'pinNovo', '', { required:true, type:'password', attrs:'inputmode="numeric" maxlength="4" autocomplete="new-password"' })}${UI.campo('Confirmar novo PIN', 'pinConfirmacao', '', { required:true, type:'password', attrs:'inputmode="numeric" maxlength="4" autocomplete="new-password"' })}<p id="erro-alterar-pin" class="pin-erro" role="alert"></p><button class="btn" type="submit">Salvar novo PIN</button></form>`, sheet => {
            const form = sheet.querySelector('form');
            form.onsubmit = async e => { e.preventDefault();
                const a = form.elements.pinAtual.value, n = form.elements.pinNovo.value, c = form.elements.pinConfirmacao.value;
                const err = form.querySelector('#erro-alterar-pin');
                if (!/^\d{4}$/.test(n) || n !== c) { err.textContent = 'Confirme o novo PIN de 4 dígitos.'; return; }
                const botao = form.querySelector('[type="submit"]'); botao.disabled = true;
                try { if (!await S.verificarPin(a)) { err.textContent = 'PIN atual incorreto.'; botao.disabled = false; return; }
                    await S.definirPin(n); UI.fechar(); UI.toast('PIN alterado.');
                } catch (erro) { err.textContent = erro.message; botao.disabled = false; }
            };
        });
        root.querySelector('#esqueci-pin').onclick = () => UI.modal('Esqueci o PIN', `<p>Por ser uma proteção local, o PIN não pode ser recuperado. Para redefini-lo, é necessário apagar os dados deste navegador e configurar novamente.</p><p class="muted" style="margin:12px 0">Exporte um backup antes. Ao restaurar, um backup protegido também restaurará o PIN antigo.</p><button class="btn secundario" type="button" id="backup-antes">Exportar backup primeiro</button>`, sheet => { sheet.querySelector('#backup-antes').onclick = () => UI.tratarErro(baixarBackup); });
        root.querySelector('#apagar').onclick = () => UI.confirmar('Apagar todos os dados?', 'Esta ação elimina configurações, clientes, serviços e financeiro deste navegador.', () => { UI.modal('Confirmação final', `<p>Digite <strong>APAGAR</strong> para excluir definitivamente os dados.</p><form id="confirma-apagar" class="form-grid" style="margin-top:16px">${UI.campo('Confirmação', 'confirmacao', '', { required: true })}<button class="btn perigo" type="submit">Excluir definitivamente</button></form>`, sheet => { sheet.querySelector('form').onsubmit = e => { e.preventDefault(); if (sheet.querySelector('[name="confirmacao"]').value.trim() !== 'APAGAR') {
            UI.erro(sheet.querySelector('form'), 'confirmacao', 'Digite APAGAR exatamente.');
            return;
        } UI.tratarErro(() => { S.limpar(); UI.fechar(); A.app.iniciar(); UI.toast('Dados apagados.'); }); }; }); }, 'Continuar');
    }
    A.views = A.views || {};
    A.views.config = { render, bind, baixarBackup };
})(window.AdmPro = window.AdmPro || {});
