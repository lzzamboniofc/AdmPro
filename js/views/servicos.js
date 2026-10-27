/* Núcleo de serviços: orçamento, agenda, checklist, parcelas e recebimentos. */
(function (A) {
    'use strict';
    const U = A.utils, UI = A.ui, S = A.storage, R = A.regras;
    const STATUS = ['orcamento', 'agendado', 'andamento', 'concluido', 'pago', 'cancelado'];
    const MEIOS = [['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['cartao', 'Cartão'], ['boleto', 'Boleto'], ['transferencia', 'Transferência']];
    let filtro = 'todos', busca = '';
    const cliente = id => S.porId('clientes', id);
    const somenteAtivos = () => S.lista('catalogo').filter(c => c.ativo);
    const opcoesPagamento = () => MEIOS.map(([value, label]) => ({ value, label }));
    function render() { return `<div class="page-heading"><div><h1>${A.perfil.plural}</h1><p class="muted">Orçamentos, compromissos e recebimentos.</p></div></div><div class="chips" aria-label="Filtrar por status">${['todos', ...STATUS].map(s => `<button type="button" class="chip filtro" data-filtro="${s}" aria-pressed="${filtro === s}">${s === 'todos' ? 'Todos' : UI.chip(s).replace(/<[^>]*>/g, '')}</button>`).join('')}</div><div class="field search-wrap"><label for="buscar-servicos">Buscar ${A.perfil.rotulo.toLowerCase()}</label><input id="buscar-servicos" placeholder="Título ou cliente" value="${U.escapar(busca)}"></div><div id="lista-servicos" class="stack">${listar()}</div>`; }
    function listar() { const lista = S.lista('servicos').filter(s => (filtro === 'todos' || s.status === filtro) && (s.titulo + ' ' + (cliente(s.clienteId)?.nome || '')).toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR'))).sort((a, b) => b.data.localeCompare(a.data) || a.hora.localeCompare(b.hora)); return lista.length ? lista.map(s => UI.card(`<div class="list-card"><div class="grow"><h3>${U.escapar(s.titulo)}</h3><p class="item-meta">${U.escapar(cliente(s.clienteId)?.nome || 'Cliente')} · ${U.exibirData(s.data)} ${U.escapar(s.hora || '')}</p><p class="numero destaque" style="margin-top:8px">${U.dinheiro(s.total)}</p></div>${UI.chip(s.status)}</div>${s.recorrencia?.ativa ? '<span class="badge-sutil">↻ Recorrente</span>' : ''}<div class="actions"><button type="button" class="btn secundario compacto" data-abrir="${U.escapar(s.id)}">Detalhes</button>${s.status !== 'pago' && s.status !== 'cancelado' ? `<button type="button" class="btn compacto" data-avancar="${U.escapar(s.id)}">${A.perfil.botaoCard}</button>` : ''}</div>`)).join('') : (busca || filtro !== 'todos' ? UI.vazio('Nenhum resultado', 'Tente outro termo ou remova o filtro.', 'Limpar filtros', 'limparFiltros') : UI.vazio('Nenhum registro cadastrado', 'Cadastre um novo ' + A.perfil.rotulo.toLowerCase() + ' para começar.', 'Novo ' + A.perfil.rotulo.toLowerCase(), 'novoServico')); }
    function bind(root) { root.querySelector('#buscar-servicos').oninput = e => { busca = e.target.value; root.querySelector('#lista-servicos').innerHTML = listar(); }; root.addEventListener('click', e => { const f = e.target.closest('[data-filtro]'), d = e.target.closest('[data-abrir]'), av = e.target.closest('[data-avancar]'); if (f) {
        filtro = f.dataset.filtro;
        A.app.refresh();
    } if (d)
        A.app.ir('#/servicos/' + encodeURIComponent(d.dataset.abrir)); if (av)
        acaoPrincipal(av.dataset.avancar); if (e.target.closest('[data-action="novoServico"]')) abrirForm();
        if (e.target.closest('[data-action="limparFiltros"]')) { filtro = 'todos'; busca = ''; A.app.refresh(); root.querySelector('#buscar-servicos')?.focus(); } }); }
    function conflito(dados, id) {
        if (!dados.data || !dados.hora || dados.status === 'cancelado' || !dados.profissionalId) return false;
        const profissional=S.porId('profissionais',dados.profissionalId);
        if(profissional?.atendimentoSimultaneo)return false;
        const inicio=U.horaMinutos(dados.hora),fim=inicio+Number(dados.duracaoMin||60);
        return S.lista('servicos').some(s=>s.id!==id&&s.data===dados.data&&s.status!=='cancelado'&&s.hora&&s.profissionalId===dados.profissionalId&&inicio<U.horaMinutos(s.hora)+Number(s.duracaoMin||60)&&U.horaMinutos(s.hora)<fim);
    }
    function horarioProfissionalDisponivel(profissionalId,data,hora,duracao){
        const p=profissionalId?S.porId('profissionais',profissionalId):null;
        const base=p?.horariosSemana?.length===7?p:S.obter('config');
        if(!R.horarioDisponivel(base,data,hora,duracao))return false;
        if(!p)return true;
        const inicio=U.horaMinutos(hora),fim=inicio+Number(duracao||0);
        return !(p.ausencias||[]).some(a=>a.data===data&&inicio<U.horaMinutos(a.fim||'23:59')&&U.horaMinutos(a.inicio||'00:00')<fim);
    }
    function abrirForm(id, preencher = {}) {
        const antigo = id ? S.porId('servicos', id) : null;
        if (id && !antigo) {
            UI.toast('Registro não encontrado.');
            return;
        }
        const catalogo = S.lista('catalogo'), ativos = somenteAtivos(), clientes = S.lista('clientes').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        let itens = (preencher.itens || antigo?.itens || []).map(i => ({ ...i, chave: U.id() }));
        if (!itens.length && ativos.length) itens.push({ chave: U.id(), catalogoId: '', nome: '', qtd: 1, precoUnit: 0 });
        let etapas = (preencher.etapas || antigo?.etapas || []).map(e => ({ ...e }));
        let parcelas = (preencher.parcelas || antigo?.parcelas || [{ id: U.id(), valor: 0, vencimento: preencher.data || U.hoje(), pago: false, pagoEm: null, formaPagamento: null }]).map(p => ({ ...p }));
        const data = preencher.data || antigo?.data || U.hoje();
        const titulo = preencher.titulo ?? antigo?.titulo ?? '';
        const valor = preencher.desconto ?? antigo?.desconto ?? 0;
        const status = preencher.status || antigo?.status || A.perfil.statusInicial;
        const opçõesClientes = [{ value: '', label: 'Selecione um cliente' }, ...clientes.map(c => ({ value: c.id, label: c.nome }))];
        const profissionais = S.lista('profissionais').filter(p => p.ativo || p.id === antigo?.profissionalId);
        const profissionalSelecionado = preencher.profissionalId ?? antigo?.profissionalId ?? (!antigo && profissionais.length===1 ? profissionais[0].id : '');
        const campoProfissional = profissionais.length===1 && !antigo
          ? '<input type="hidden" name="profissionalId" value="'+U.escapar(profissionalSelecionado)+'"><p class="muted">Profissional: <strong>'+U.escapar(profissionais[0].nome)+'</strong></p>'
          : (profissionais.length ? UI.campo('Profissional','profissionalId',profissionalSelecionado,{ options:[{value:'',label:'Não atribuído'},...profissionais.map(p=>({value:p.id,label:p.nome}))] }) : '');
        const recorrencia = preencher.recorrencia || antigo?.recorrencia || {ativa:false,intervalo:1,unidade:'meses'};
        const campos = `<form id="form-servico" class="form-grid"><div class="form-grid">${UI.campo('Cliente', 'clienteId', preencher.clienteId || antigo?.clienteId || '', { required: true, options: opçõesClientes })}<button class="btn secundario compacto" type="button" data-novo-cliente aria-expanded="false" aria-controls="cliente-rapido">+ Criar cliente agora</button><div id="cliente-rapido" class="cliente-rapido" hidden>${UI.campo('Nome do novo cliente', 'novoClienteNome', '', { attrs: 'autocomplete="name"' })}${UI.campo('Telefone com DDD', 'novoClienteTelefone', '', { attrs: 'inputmode="tel" data-mask="telefone" autocomplete="tel"' })}<div class="actions"><button type="button" class="btn compacto" data-salvar-cliente>Adicionar cliente</button><button type="button" class="btn secundario compacto" data-cancelar-cliente>Cancelar</button></div></div></div>${campoProfissional}${UI.campo('Título', 'titulo', titulo, { attrs: 'placeholder="Ex.: Atendimento ou instalação"' })}<div class="section-heading"><h3>Itens do catálogo</h3><button type="button" class="btn secundario compacto" data-add-item>+ Item</button></div><div id="itens-form" class="stack"></div><div id="itens-erro" class="field-error"></div>${UI.campo('Desconto (R$)', 'desconto', U.numerico(valor), { attrs: 'inputmode="decimal" data-mask="moeda"' })}<div class="detail-row"><strong>Total</strong><strong class="numero destaque" id="total-form">${U.dinheiro(0)}</strong></div><div class="form-grid duas">${UI.campo('Data', 'data', data, { type: 'date', required: true })}${UI.campo('Hora', 'hora', preencher.hora || antigo?.hora || '09:00', { type: 'time', required: true })}</div>${UI.campo('Duração (min)', 'duracaoMin', preencher.duracaoMin ?? antigo?.duracaoMin ?? 60, { type: 'number', attrs: 'min="0" step="5" inputmode="numeric"' })}${UI.campo('Endereço', 'endereco', preencher.endereco ?? antigo?.endereco ?? '')}${UI.campo('Observações', 'observacoes', preencher.observacoes ?? antigo?.observacoes ?? '', { type: 'textarea' })}<div class="recorrencia-form"><label class="check-row"><input type="checkbox" name="recorrenciaAtiva" ${recorrencia.ativa ? 'checked' : ''}> Repetir este serviço</label><div class="form-grid duas">${UI.campo('Intervalo','recorrenciaIntervalo',recorrencia.intervalo || 1,{type:'number',attrs:'min="1" max="999" inputmode="numeric"'})}${UI.campo('Unidade','recorrenciaUnidade',recorrencia.unidade || 'meses',{options:[{value:'dias',label:'Dias'},{value:'semanas',label:'Semanas'},{value:'meses',label:'Meses'}]})}</div><div class="actions"><button type="button" class="btn secundario compacto" data-atalho="15:dias">15 dias</button><button type="button" class="btn secundario compacto" data-atalho="1:meses">1 mês</button><button type="button" class="btn secundario compacto" data-atalho="6:meses">6 meses</button></div></div>${UI.campo('Status', 'status', status, { options: STATUS.map(s => ({ value: s, label: A.perfil.status?.[s] || ({ orcamento: 'Orçamento', agendado: 'Agendado', andamento: 'Em andamento', concluido: 'Concluído', pago: 'Pago', cancelado: 'Cancelado' })[s] })) })}${A.perfil.mostraEtapas ? `<section><div class="section-heading"><h3>Etapas</h3><button type="button" class="btn secundario compacto" data-add-etapa>+ Etapa</button></div><div id="etapas-form" class="stack"></div></section>` : ''}<section><div class="section-heading"><h3>Parcelas</h3>${A.perfil.parcelasMultiplas ? '<button type="button" class="btn secundario compacto" data-add-parcela>+ Parcela</button>' : ''}</div><div id="parcelas-form" class="stack"></div><p id="parcelas-aviso" class="aviso" role="alert" hidden></p></section><p id="horario-aviso" class="aviso erro" role="alert" hidden>O profissional não está disponível nesse horário.</p><p id="conflito-aviso" class="aviso erro" role="alert" hidden>Este profissional já possui um atendimento incompatível nesse horário.</p></form><div class="sheet-save"><button type="submit" form="form-servico" class="btn">Salvar ${A.perfil.rotulo.toLowerCase()}</button></div>`;
        UI.modal((antigo ? 'Editar ' : 'Novo ') + A.perfil.rotulo.toLowerCase(), campos, sheet => {
            const f = sheet.querySelector('#form-servico'), el = s => sheet.querySelector(s);
            const pegarItens = () => itens.filter(i => i.catalogoId).map(({ catalogoId, nome, qtd, precoUnit }) => ({ catalogoId, nome, qtd: Number(qtd), precoUnit: Number(precoUnit) }));
            const total = () => U.totalServico(pegarItens(), U.lerMoeda(f.elements.desconto.value));
            function desenharItens() { el('#itens-form').innerHTML = itens.map((i, n) => `<div class="item-row" data-item="${i.chave}"><div class="field"><label for="item-${i.chave}">Item ${n + 1}</label><select id="item-${i.chave}" data-catalogo><option value="">Selecione</option>${catalogo.filter(c => c.ativo || c.id === i.catalogoId).map(c => `<option value="${c.id}" ${c.id === i.catalogoId ? 'selected' : ''}>${U.escapar(c.nome)} · ${U.dinheiro(c.preco)}</option>`).join('')}</select></div><div class="field"><label for="q-${i.chave}">Qtd.</label><input id="q-${i.chave}" data-qtd type="number" inputmode="numeric" min="1" step="1" value="${i.qtd}"></div><button type="button" class="icon-button" data-remove-item aria-label="Remover item">${UI.icon('trash')}</button><small class="item-preco">Valor unitário: ${U.dinheiro(i.precoUnit)}</small></div>`).join('') || '<p class="muted">Adicione pelo menos um item do catálogo.</p>'; }
            function desenharEtapas() { if (!A.perfil.mostraEtapas)
                return; el('#etapas-form').innerHTML = etapas.map((et, i) => `<div class="inline-row" data-etapa="${et.id}"><label class="sr-only" for="et-${et.id}">Etapa ${i + 1}</label><input id="et-${et.id}" data-titulo-etapa class="field-input" style="height:48px;border:1px solid var(--borda);border-radius:10px;padding:10px;background:var(--superficie);color:var(--texto)" value="${U.escapar(et.titulo)}"><button type="button" class="icon-button" data-remove-etapa aria-label="Remover etapa">${UI.icon('trash')}</button></div>`).join('') || '<p class="muted">Sem etapas cadastradas.</p>'; }
            function desenharParcelas() { el('#parcelas-form').innerHTML = parcelas.map((p, i) => `<div class="parcela-row" data-parcela="${p.id}"><div class="field"><label for="pv-${p.id}">Parcela ${i + 1} (R$)</label><input id="pv-${p.id}" data-valor-parcela inputmode="decimal" data-mask="moeda" value="${U.numerico(p.valor)}" ${p.pago ? 'disabled' : ''}></div><div class="field"><label for="pd-${p.id}">Vencimento</label><input id="pd-${p.id}" type="date" data-vencimento value="${p.vencimento}" ${p.pago ? 'disabled' : ''}></div><button type="button" class="icon-button" data-remove-parcela aria-label="Remover parcela" ${p.pago || !A.perfil.parcelasMultiplas ? 'disabled' : ''}>${UI.icon('trash')}</button></div>${p.pago ? `<p class="muted">Paga em ${U.exibirData(p.pagoEm)} · ${U.escapar(p.formaPagamento || '')}</p>` : ''}`).join(''); UI.mascara(el('#parcelas-form')); }
            function sincronizar() { const t = total(); if (!A.perfil.parcelasMultiplas && parcelas.length === 1 && !parcelas[0].pago)
                parcelas[0].valor = t; if (A.perfil.parcelasMultiplas && parcelas.length === 1 && !parcelas[0].pago)
                parcelas[0].valor = t; el('#total-form').textContent = U.dinheiro(t); const diferenca = Math.abs(U.centavos(U.somaParcelas(parcelas)) - U.centavos(t)); el('#parcelas-aviso').hidden = diferenca === 0; el('#parcelas-aviso').textContent = `A soma das parcelas (${U.dinheiro(U.somaParcelas(parcelas))}) deve ser igual ao total (${U.dinheiro(t)}).`; const pid=f.elements.profissionalId?.value||null; el('#horario-aviso').hidden = horarioProfissionalDisponivel(pid,f.elements.data.value,f.elements.hora.value,f.elements.duracaoMin.value); el('#conflito-aviso').hidden = !conflito({ data:f.elements.data.value,hora:f.elements.hora.value,status:f.elements.status.value,duracaoMin:f.elements.duracaoMin.value,profissionalId:pid }, id); return diferenca === 0; }
            function atualizarTotais(redesenhar = true) { sincronizar(); if (redesenhar)
                desenharParcelas(); }
            desenharItens();
            desenharEtapas();
            atualizarTotais();
            f.addEventListener('click', e => {
                const b = e.target.closest('button');
                if (!b)
                    return;
                if (b.hasAttribute('data-atalho')) { const [n,unidade]=b.dataset.atalho.split(':');f.elements.recorrenciaAtiva.checked=true;f.elements.recorrenciaIntervalo.value=n;f.elements.recorrenciaUnidade.value=unidade; }
                if (b.hasAttribute('data-add-item')) {
                    if (!ativos.length) {
                        UI.toast('Cadastre um item ativo no Catálogo.');
                        return;
                    }
                    const chave = U.id();
                    itens.push({ chave, catalogoId: '', nome: '', qtd: 1, precoUnit: 0 });
                    desenharItens();
                    atualizarTotais();
                    el('#itens-form').querySelector('[data-item="' + chave + '"] [data-catalogo]')?.focus();
                }
                if (b.hasAttribute('data-remove-item')) {
                    const row = b.closest('[data-item]');
                    itens = itens.filter(i => i.chave !== row.dataset.item);
                    desenharItens();
                    atualizarTotais();
                }
                if (b.hasAttribute('data-add-etapa')) {
                    etapas.push({ id: U.id(), titulo: '', concluida: false });
                    desenharEtapas();
                }
                if (b.hasAttribute('data-remove-etapa')) {
                    etapas = etapas.filter(x => x.id !== b.closest('[data-etapa]').dataset.etapa);
                    desenharEtapas();
                }
                if (b.hasAttribute('data-add-parcela')) {
                    parcelas.push({ id: U.id(), valor: 0, vencimento: f.elements.data.value || U.hoje(), pago: false, pagoEm: null, formaPagamento: null });
                    desenharParcelas();
                    sincronizar();
                }
                if (b.hasAttribute('data-remove-parcela')) {
                    parcelas = parcelas.filter(p => p.id !== b.closest('[data-parcela]').dataset.parcela);
                    desenharParcelas();
                    sincronizar();
                }
                if (b.hasAttribute('data-novo-cliente')) {
                    const painel = el('#cliente-rapido');
                    painel.hidden = !painel.hidden;
                    b.setAttribute('aria-expanded', String(!painel.hidden));
                    if (!painel.hidden) f.elements.novoClienteNome.focus();
                }
                if (b.hasAttribute('data-cancelar-cliente')) {
                    el('#cliente-rapido').hidden = true;
                    el('[data-novo-cliente]').setAttribute('aria-expanded', 'false');
                    el('[data-novo-cliente]').focus();
                }
                if (b.hasAttribute('data-salvar-cliente')) {
                    const nome = f.elements.novoClienteNome.value.trim();
                    const telefone = U.digitos(f.elements.novoClienteTelefone.value);
                    UI.erro(f, 'novoClienteNome', nome ? '' : 'Informe o nome do cliente.');
                    UI.erro(f, 'novoClienteTelefone', telefone.length >= 10 ? '' : 'Informe um telefone com DDD.');
                    if (!nome || telefone.length < 10) return;
                    b.disabled = true;
                    try {
                        const novoId = U.id();
                        S.adicionar('clientes', { id: novoId, nome, telefone: U.mascaraTelefone(telefone), endereco: '', observacoes: '', criadoEm: U.dataHora() });
                        f.elements.clienteId.add(new Option(nome, novoId, true, true));
                        el('#cliente-rapido').hidden = true;
                        el('[data-novo-cliente]').setAttribute('aria-expanded', 'false');
                        f.elements.titulo.focus();
                        UI.erro(f, 'clienteId', '');
                        UI.toast('Cliente adicionado. Continue o serviço.');
                    } catch (erro) {
                        UI.toast(erro.message);
                        b.disabled = false;
                    }
                }
            });
            f.addEventListener('change', e => {
                const linha = e.target.closest('[data-item]');
                if (linha) {
                    const i = itens.find(i => i.chave === linha.dataset.item);
                    if (e.target.matches('[data-catalogo]')) {
                        const c = catalogo.find(c => c.id === e.target.value);
                        if (c)
                            Object.assign(i, { catalogoId: c.id, nome: c.nome, precoUnit: c.preco });
                        else
                            i.catalogoId = '';
                        desenharItens();
                        atualizarTotais();
                    }
                    if (e.target.matches('[data-qtd]')) {
                        i.qtd = Math.max(1, Math.floor(Number(e.target.value) || 1));
                        atualizarTotais();
                    }
                }
                const etapa = e.target.closest('[data-etapa]');
                if (etapa) {
                    const i = etapas.find(x => x.id === etapa.dataset.etapa);
                    if (i)
                        i.titulo = e.target.value;
                }
                const pLinha = e.target.closest('[data-parcela]');
                if (pLinha) {
                    const p = parcelas.find(x => x.id === pLinha.dataset.parcela);
                    if (p && !p.pago) {
                        if (e.target.matches('[data-valor-parcela]'))
                            p.valor = U.lerMoeda(e.target.value);
                        if (e.target.matches('[data-vencimento]'))
                            p.vencimento = e.target.value;
                        sincronizar();
                    }
                }
                if (['data', 'hora', 'duracaoMin', 'status'].includes(e.target.name))
                    sincronizar();
            });
            f.addEventListener('click', e => { if (e.target.closest('[data-add-item],[data-remove-item],[data-add-etapa],[data-remove-etapa],[data-add-parcela],[data-remove-parcela],[data-atalho]')) sheet.dataset.alterado = 'true'; });
            f.addEventListener('input', () => { sheet.dataset.alterado = 'true'; });
            f.addEventListener('change', () => { sheet.dataset.alterado = 'true'; });
            f.elements.desconto.addEventListener('input', () => atualizarTotais());
            el('#parcelas-form').addEventListener('input', e => { if (!e.target.matches('[data-valor-parcela]'))
                return; const p = parcelas.find(x => x.id === e.target.closest('[data-parcela]').dataset.parcela); if (p) {
                p.valor = U.lerMoeda(e.target.value);
                sincronizar();
            } });
            f.addEventListener('submit', e => { e.preventDefault(); if (!UI.validar(f))
                return; const novosItens = pegarItens(); if (!novosItens.length || novosItens.some(i => i.qtd < 1)) {
                el('#itens-erro').textContent = 'Adicione pelo menos um item válido.';
                return;
            } el('#itens-erro').textContent = ''; if (!sincronizar()) {
                el('#parcelas-aviso').scrollIntoView({ block: 'center' });
                return;
            } if (parcelas.some(p => !p.vencimento || p.valor <= 0)) {
                UI.toast('Informe valor e vencimento válidos em cada parcela.');
                return;
            } const d = new FormData(f), dados = { clienteId: d.get('clienteId'), titulo: (d.get('titulo') || '').trim() || novosItens[0].nome, itens: novosItens, desconto: U.lerMoeda(d.get('desconto')), total: total(), data: d.get('data'), hora: d.get('hora'), duracaoMin: Math.max(1, Number(d.get('duracaoMin')) || 60), endereco: d.get('endereco'), observacoes: d.get('observacoes'), status: d.get('status'), profissionalId:d.get('profissionalId') || null, profissionalIds:d.get('profissionalId') ? [d.get('profissionalId')] : [], recorrencia:{ ativa:d.has('recorrenciaAtiva'), intervalo:Math.max(1,parseInt(d.get('recorrenciaIntervalo'),10)||1), unidade:d.get('recorrenciaUnidade')||'meses' }, etapas: etapas.filter(e => e.titulo.trim()), parcelas }; if (dados.status === 'pago' && !parcelas.every(p => p.pago)) {
                UI.toast('Quite todas as parcelas antes de marcar como pago.');
                return;
            } if (parcelas.every(p => p.pago))
                dados.status = 'pago';
            if(!horarioProfissionalDisponivel(dados.profissionalId,dados.data,dados.hora,dados.duracaoMin)){UI.toast('O profissional não está disponível nesse horário.');return;}
            const temConflito=conflito(dados,id);if(temConflito){UI.toast('Este profissional já possui um atendimento nesse horário.');return;}
            const botaoSalvar = sheet.querySelector('.sheet-save [type="submit"]'); botaoSalvar.disabled = true; UI.tratarErro(() => { if (id) {
                const historico = [...antigo.historico];
                if (antigo.status !== dados.status)
                    historico.push({ status: dados.status, em: U.dataHora() });
                S.atualizar('servicos', id, { ...dados, historico });
            }
            else {
                const sid = U.id();
                S.adicionar('servicos', { id: sid, ...dados, historico: [{ status: dados.status, em: U.dataHora() }], criadoEm: U.dataHora() });
                id = sid;
            } UI.fechar(); A.app.ir('#/servicos/' + encodeURIComponent(id)); const gerado=S.consumirRecorrente(); if(gerado) UI.toastAcao('Próximo agendamento criado para '+U.exibirData(gerado.data).slice(0,5),'Ver',()=>A.app.ir('#/servicos/'+encodeURIComponent(gerado.id))); else UI.toast('Registro salvo com sucesso.'); }); if (f.isConnected) botaoSalvar.disabled = false; });
        });
    }
    function atualizarStatus(id, status) { const s = S.porId('servicos', id); if (!s || s.status === status)
        return; if (status === 'pago' && !s.parcelas.every(p => p.pago)) {
        UI.toast('Existem parcelas em aberto.');
        return;
    } S.atualizar('servicos', id, { status, historico: [...s.historico, { status, em: U.dataHora() }] }); A.app.refresh(); const gerado=S.consumirRecorrente(); if(gerado) UI.toastAcao('Próximo agendamento criado para '+U.exibirData(gerado.data).slice(0,5),'Ver',()=>A.app.ir('#/servicos/'+encodeURIComponent(gerado.id))); else UI.toast('Status atualizado.'); }
    function acaoPrincipal(id) { const s = S.porId('servicos', id); if (!s)
        return; if (A.perfil.acaoPrincipal === 'receber') {
        const pendentes = s.parcelas.filter(p => !p.pago);
        if (!pendentes.length) {
            UI.toast('Todas as parcelas já estão pagas.');
            return;
        }
        abrirPagamento(id, pendentes[0].id, true);
        return;
    } const ordem = ['orcamento', 'agendado', 'andamento', 'concluido']; const i = ordem.indexOf(s.status); if (i < 0 || i === ordem.length - 1) {
        UI.toast('Próxima etapa: registre o pagamento das parcelas.');
        return;
    } UI.tratarErro(() => atualizarStatus(id, ordem[i + 1])); }
    function abrirPagamento(id, parcelaId, receberTudo = false) {
        const s = S.porId('servicos', id), p = s?.parcelas.find(x => x.id === parcelaId);
        if (!p || p.pago) return;
        const pendentes = s.parcelas.filter(x => !x.pago);
        UI.modal('Registrar recebimento', `<p class="muted" style="margin-bottom:12px">${receberTudo ? 'Receber todas as parcelas em aberto' : 'Parcela selecionada'} · ${U.dinheiro(receberTudo ? U.somarValores(pendentes.map(x => x.valor)) : p.valor)}</p><form id="form-pagamento" class="form-grid">${UI.campo('Forma de pagamento', 'formaPagamento', 'pix', { options: opcoesPagamento() })}${UI.campo('Data do recebimento', 'data', U.hoje(), { type: 'date', required: true })}<button class="btn" type="submit">Confirmar pagamento</button></form>`, sheet => {
            sheet.querySelector('form').onsubmit = e => {
                e.preventDefault(); const form = e.currentTarget;
                if (!UI.validar(form)) return;
                const botao = form.querySelector('[type="submit"]'); botao.disabled = true;
                try {
                    const atual = S.porId('servicos', id);
                    const ids = receberTudo ? atual.parcelas.filter(x => !x.pago).map(x => x.id) : [parcelaId];
                    const d = new FormData(form);
                    if (!S.registrarPagamento(id, ids, d.get('data'), d.get('formaPagamento'), receberTudo)) { UI.toast('Parcela já recebida.'); UI.fechar(); return; }
                    UI.fechar(); A.app.refresh(); const gerado=S.consumirRecorrente(); if(gerado)UI.toastAcao('Próximo agendamento criado para '+U.exibirData(gerado.data).slice(0,5),'Ver',()=>A.app.ir('#/servicos/'+encodeURIComponent(gerado.id))); else UI.toast('Recebimento registrado no Financeiro.');
                } catch (erro) { botao.disabled = false; UI.toast(erro.message); }
            };
        });
    }
    function estornar(id, parcelaId) {
        UI.confirmar('Desmarcar parcela?', 'O lançamento financeiro desta parcela será removido.', () => UI.tratarErro(() => {
            if (S.estornarPagamento(id, parcelaId)) { A.app.refresh(); UI.toast('Pagamento estornado.'); }
        }), 'Desmarcar');
    }
    function detalheHTML(id) { const s = S.porId('servicos', id); if (!s)
        return UI.vazio('Não encontrado', 'Este registro não existe ou foi excluído.') + '<a href="#/servicos" class="btn secundario">Voltar para serviços</a>'; const c = cliente(s.clienteId); return `<div class="page-heading"><div><a href="#/servicos" class="text-button">← Voltar</a><h1 style="margin-top:8px">${U.escapar(s.titulo)}</h1><p class="muted">${U.escapar(c?.nome || 'Cliente')} · ${U.exibirData(s.data)} às ${U.escapar(s.hora)}</p></div>${UI.chip(s.status)}</div>${s.recorrencia?.ativa ? '<p class="badge-sutil">↻ Recorrente</p>' : ''}${UI.card(`<div class="detail-row"><span>Total</span><strong class="resumo-valor">${U.dinheiro(s.total)}</strong></div><div class="detail-row"><span>Desconto</span><span>${U.dinheiro(s.desconto)}</span></div><div class="detail-row"><span>Endereço</span><span>${U.escapar(s.endereco || '—')}</span></div>${s.observacoes ? `<p style="margin-top:12px">${U.escapar(s.observacoes)}</p>` : ''}<div class="actions"><button class="btn secundario compacto" data-editar>Editar</button><button class="btn perigo compacto" data-excluir>Excluir</button>${s.recorrencia?.ativa ? '<button class="btn secundario compacto" data-parar>Parar de repetir</button>' : ''}${s.status !== 'pago' && s.status !== 'cancelado' ? `<button class="btn compacto" data-principal>${A.perfil.botaoCard}</button>` : ''}</div>`)}<section class="section"><h2 style="margin-bottom:12px">Itens</h2>${UI.card(s.itens.map(i => `<div class="detail-row"><span>${U.escapar(i.nome)} × ${Number(i.qtd)}</span><strong class="numero">${U.dinheiro(i.qtd * i.precoUnit)}</strong></div>`).join(''))}</section>${A.perfil.mostraEtapas ? `<section class="section"><h2 style="margin-bottom:12px">Etapas</h2>${UI.card(s.etapas.length ? s.etapas.map(e => `<label class="check-row"><input type="checkbox" data-check="${e.id}" ${e.concluida ? 'checked' : ''}>${U.escapar(e.titulo)}</label>`).join('') : '<p class="muted">Nenhuma etapa cadastrada.</p>')}</section>` : ''}<section class="section"><h2 style="margin-bottom:12px">Parcelas</h2><div class="stack">${s.parcelas.map(p => UI.card(`<div class="list-card"><div class="grow"><strong class="numero">${U.dinheiro(p.valor)}</strong><p class="item-meta">Vencimento: ${U.exibirData(p.vencimento)}${p.pago ? ' · Pago ' + U.exibirData(p.pagoEm) : ''}</p></div>${p.pago ? '<span class="chip pago">Pago</span>' : p.vencimento < U.hoje() ? '<span class="chip andamento">Vencida</span>' : ''}</div><button class="btn ${p.pago ? 'secundario' : ''} compacto" style="margin-top:12px;width:100%" data-${p.pago ? 'estornar' : 'pagar'}="${p.id}">${p.pago ? 'Desmarcar pagamento' : 'Marcar como paga'}</button>`)).join('')}</div></section><section class="section"><h2 style="margin-bottom:12px">Histórico de status</h2>${UI.card(`<ol class="timeline">${[...s.historico].reverse().map(h => `<li><strong>${UI.chip(h.status)}</strong><small>${U.dataHoraVisivel(h.em)}</small></li>`).join('')}</ol>`)}</section><section class="section"><div class="actions">${s.status==='agendado' && s.data>=U.hoje() ? `<button class="btn secundario" data-lembrete>${UI.icon('sino',true)} Enviar lembrete</button>` : ''}${s.lembreteEnviadoEm ? '<span class="badge-sutil">🔔 Lembrete enviado</span>':''}<button class="btn secundario" data-whatsapp>Enviar por WhatsApp</button><button class="btn secundario" data-print>Gerar PDF</button>${s.parcelas.some(p=>p.pago) ? '<button class="btn secundario" data-recibo>Recibo</button><button class="btn secundario" data-recibo-whats>Enviar recibo no WhatsApp</button>' : ''}</div></section>`; }
    function bindDetalhe(root, id) { const s = S.porId('servicos', id); if (!s)
        return; root.addEventListener('click', e => { if (e.target.closest('[data-editar]'))
        abrirForm(id); if (e.target.closest('[data-excluir]'))
        UI.confirmar('Excluir ' + A.perfil.rotulo.toLowerCase() + '?', 'O registro e os lançamentos vinculados serão excluídos.', () => { S.removerServico(id); A.app.ir('#/servicos'); UI.toast('Registro excluído.'); }); if (e.target.closest('[data-principal]'))
        acaoPrincipal(id); const pagar = e.target.closest('[data-pagar]'), estornarEl = e.target.closest('[data-estornar]'); if (pagar)
        abrirPagamento(id, pagar.dataset.pagar); if (estornarEl)
        estornar(id, estornarEl.dataset.estornar); if (e.target.closest('[data-whatsapp]'))
        enviarOrcamento(id); if (e.target.closest('[data-print]'))
        imprimirOrcamento(id); if(e.target.closest('[data-lembrete]')) enviarLembrete(id); if(e.target.closest('[data-recibo]')) imprimirRecibo(id); if(e.target.closest('[data-recibo-whats]')) enviarRecibo(id); if(e.target.closest('[data-parar]')) UI.confirmar('Parar recorrência?','Os próximos já gerados serão mantidos.',()=>{const x=S.porId('servicos',id);S.atualizar('servicos',id,{recorrencia:{...x.recorrencia,ativa:false}});A.app.refresh();UI.toast('Recorrência desativada.');},'Parar'); }); root.querySelectorAll('[data-check]').forEach(b => b.onchange = () => UI.tratarErro(() => { const atual = S.porId('servicos', id); S.atualizar('servicos', id, { etapas: atual.etapas.map(et => et.id === b.dataset.check ? { ...et, concluida: b.checked } : et) }); UI.toast('Etapa atualizada.'); })); }
    function enviarOrcamento(id) { const s = S.porId('servicos', id), c = cliente(s.clienteId), cfg = S.obter('config'); if (!c) {
        UI.toast('Cliente não encontrado.');
        return;
    } const validade = U.exibirData(U.deslocarDia(U.hoje(), 7)); const linhas = [`*Orçamento — ${cfg.nomeNegocio}*`, `Cliente: ${c.nome}`, '', ...s.itens.map(i => `• ${i.nome} (${i.qtd} × ${U.dinheiro(i.precoUnit)}) = ${U.dinheiro(i.qtd * i.precoUnit)}`), '', `Desconto: ${U.dinheiro(s.desconto)}`, `*Total: ${U.dinheiro(s.total)}*`, `Validade: ${validade}`]; const url = 'https://wa.me/' + U.numeroWhatsapp(c.telefone) + '?text=' + encodeURIComponent(linhas.join('\n')); window.open(url, '_blank', 'noopener,noreferrer'); }
    function imprimirOrcamento(id) { const s = S.porId('servicos', id), c = cliente(s.clienteId), cfg = S.obter('config'), root = document.getElementById('print-area'); root.innerHTML = `<header>${/^data:image\/(png|jpeg|webp);base64,/.test(cfg.logoBase64 || '') ? `<img src="${U.escapar(cfg.logoBase64)}" alt="Logo do negócio" style="max-width:140px;max-height:80px">` : '<img src="img/logo/svg/logo-horizontal.svg" alt="AdmPro" width="140" height="37">'}<h1>${U.escapar(cfg.nomeNegocio)}</h1><p>${U.escapar(cfg.telefone)}</p></header><hr><h2>Orçamento</h2><p><strong>Cliente:</strong> ${U.escapar(c?.nome || '—')}</p><p><strong>Emissão:</strong> ${U.exibirData(U.hoje())} · <strong>Validade:</strong> ${U.exibirData(U.deslocarDia(U.hoje(), 7))}</p><table><thead><tr><th>Descrição</th><th>Qtd.</th><th>Unitário</th><th>Total</th></tr></thead><tbody>${s.itens.map(i => `<tr><td>${U.escapar(i.nome)}</td><td>${i.qtd}</td><td>${U.dinheiro(i.precoUnit)}</td><td>${U.dinheiro(i.qtd * i.precoUnit)}</td></tr>`).join('')}</tbody></table><p>Desconto: ${U.dinheiro(s.desconto)}</p><p class="print-total">Total: ${U.dinheiro(s.total)}</p><p>Endereço: ${U.escapar(s.endereco || '—')}</p><footer class="print-assinatura"><img src="img/logo/png/logo-monocromatica-600w.png" alt="AdmPro" width="110" height="29"><span>Documento gerado pelo AdmPro</span></footer>`; Promise.all(Array.from(root.querySelectorAll('img'), img => img.decode().catch(() => {}))).then(() => window.print()); }
    function textoLembrete(id) {
        const s=S.porId('servicos',id), c=cliente(s.clienteId), conf=S.obter('config');
        if(!c || s.status!=='agendado' || s.data<U.hoje()) throw Error('Lembrete disponível apenas para agendamentos futuros.');
        const hoje=U.hoje();
        const referencia=s.data===hoje?'hoje':s.data===U.deslocarDia(hoje,1)?'amanhã':'na '+U.parseData(s.data).toLocaleDateString('pt-BR',{weekday:'long'})+', '+U.exibirData(s.data).slice(0,5);
        const horario=s.hora.replace(/:00$/,'h').replace(':','h');
        const atividade=A.perfil.tipo==='projeto' ? (/instala/i.test(s.titulo)?'instalação':'visita') : 'horário';
        return `Olá, ${c.nome.split(' ')[0]}! Lembrando do seu ${atividade} ${referencia} às ${horario} com ${conf.nomeNegocio} para ${s.titulo}.${A.perfil.tipo==='projeto' && s.endereco ? ' Endereço: '+s.endereco+'.':''} Qualquer coisa, é só responder aqui.`;
    }
    function enviarLembrete(id) {
        UI.tratarErro(()=>{const s=S.porId('servicos',id),c=cliente(s.clienteId);const texto=textoLembrete(id);
            window.open('https://wa.me/'+U.numeroWhatsapp(c.telefone)+'?text='+encodeURIComponent(texto),'_blank','noopener,noreferrer');
            S.registrarLembrete(id);A.app.refresh();UI.toast('Lembrete preparado no WhatsApp.');});
    }
    function resumoRecibo(id) {
        const s=S.porId('servicos',id), c=cliente(s.clienteId),cfg=S.obter('config');
        const numero=S.numeroRecibo(id);
        const pagos=s.parcelas.filter(p=>p.pago), valor=U.somarValores(pagos.map(p=>p.valor));
        return {s,c,cfg,numero,pagos,valor,saldo:U.deCentavos(Math.max(0,U.centavos(s.total)-U.centavos(valor)))};
    }
    function enviarRecibo(id) {
        UI.tratarErro(()=>{const r=resumoRecibo(id);
            const texto=[`*Recibo nº ${r.numero} — ${r.cfg.nomeNegocio}*`,`Cliente: ${r.c?.nome || '—'}`,`Data: ${U.exibirData(U.hoje())}`,`Serviço: ${r.s.titulo}`,`Total: ${U.dinheiro(r.s.total)}`,`Recebido: ${U.dinheiro(r.valor)}`,`Saldo: ${U.dinheiro(r.saldo)}`].join('\n');
            window.open('https://wa.me/'+U.numeroWhatsapp(r.c.telefone)+'?text='+encodeURIComponent(texto),'_blank','noopener,noreferrer');
        });
    }
    function imprimirRecibo(id) {
        UI.tratarErro(()=>{const r=resumoRecibo(id),root=document.getElementById('print-area');
            root.innerHTML=`<header>${/^data:image\/(png|jpeg|webp);base64,/.test(r.cfg.logoBase64 || '') ? `<img src="${U.escapar(r.cfg.logoBase64)}" alt="Logo do negócio" style="max-width:140px;max-height:80px">` : '<img src="img/logo/svg/logo-horizontal.svg" alt="AdmPro" width="140" height="37">'}<h1>${U.escapar(r.cfg.nomeNegocio)}</h1><p>${U.escapar(r.cfg.telefone)}</p></header><hr><h2>Recibo nº ${r.numero}</h2><p><strong>Emissão:</strong> ${U.exibirData(U.hoje())}</p><p><strong>Cliente:</strong> ${U.escapar(r.c?.nome || '—')}</p><h3>Itens</h3><table><thead><tr><th>Descrição</th><th>Qtd.</th><th>Valor unitário</th></tr></thead><tbody>${r.s.itens.map(i=>`<tr><td>${U.escapar(i.nome)}</td><td>${Number(i.qtd)}</td><td>${U.dinheiro(i.precoUnit)}</td></tr>`).join('')}</tbody></table><p>Total: ${U.dinheiro(r.s.total)}</p><h3>Pagamentos recebidos</h3><ul>${r.pagos.map(p=>`<li>${U.exibirData(p.pagoEm)} — ${U.escapar(p.formaPagamento || '—')}: ${U.dinheiro(p.valor)}</li>`).join('')}</ul><p class="print-total">Total recebido: ${U.dinheiro(r.valor)}</p><p>Saldo restante: ${U.dinheiro(r.saldo)}</p><p>Recebi de ${U.escapar(r.c?.nome || '—')} a quantia de ${U.dinheiro(r.valor)} (${U.valorPorExtenso(r.valor)}) referente a ${U.escapar(r.s.titulo)}.</p>`;
            Promise.all(Array.from(root.querySelectorAll('img'),img=>img.decode().catch(()=>{}))).then(()=>window.print());
        });
    }
    A.views = A.views || {};
    A.views.servicos = { render, bind, abrirForm, detalheHTML, bindDetalhe, acaoPrincipal, enviarOrcamento, imprimirOrcamento, enviarLembrete, imprimirRecibo, enviarRecibo };
})(window.AdmPro = window.AdmPro || {});
