/* Único módulo autorizado a acessar localStorage. Substituível por API no futuro. */
(function (A) {
    'use strict';
    const U = A.utils, R = A.regras, PREFIXO = 'admpro_', COLECOES = ['config', 'clientes', 'catalogo', 'servicos', 'lancamentos', 'profissionais', 'despesasFixas', 'movimentacoesEstoque'];
    const copiar = v => JSON.parse(JSON.stringify(v));
    const VERSAO_DADOS = 3;
    const problemas = new Set();
    const vazio = chave => chave === 'config' ? null : [];
    // Proteção local simples, NÃO equivale a autenticação de servidor.
    // Em file://, crypto.subtle pode faltar: FNV-1a é fallback documentado,
    // não criptográfico. Ao migrar para backend, usar autenticação real.
    const chaveSessao = PREFIXO + 'sessao';
    const chaveTentativas = PREFIXO + 'tentativasPin';
    const chaveBloqueio = PREFIXO + 'bloqueioPin';
    function sessaoLer(chave) { try { return sessionStorage.getItem(chave); } catch (_) { return null; } }
    function sessaoGravar(chave, valor) { try { sessionStorage.setItem(chave, valor); } catch (_) { /* Navegador restrito: não mantém sessão. */ } }
    function sessaoRemover(chave) { try { sessionStorage.removeItem(chave); } catch (_) { /* Sessão já indisponível. */ } }
    function fnv(texto) {
        let a = 2166136261, b = 2166136261;
        for (let i = 0; i < texto.length; i++) {
            a = Math.imul(a ^ texto.charCodeAt(i), 16777619);
            b = Math.imul(b ^ (texto.charCodeAt(i) + 17), 16777619);
        }
        return [a,b].map(n => (n >>> 0).toString(16).padStart(8, '0')).join('');
    }
    async function hashPin(pin, metodo) {
        if (!/^\d{4}$/.test(pin)) throw Error('O PIN deve ter exatamente 4 dígitos.');
        const usarSHA = metodo === 'sha256' || (!metodo && !!globalThis.crypto?.subtle);
        if (usarSHA && globalThis.crypto?.subtle) {
            const bytes = new TextEncoder().encode('admpro-pin-v2:' + pin);
            const buffer = await crypto.subtle.digest('SHA-256', bytes);
            return { pinHash: [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join(''), pinMetodo: 'sha256' };
        }
        if (metodo === 'sha256') throw Error('Este PIN necessita de um navegador com suporte a SHA-256.');
        return { pinHash: fnv('admpro-pin-v2:' + pin), pinMetodo: 'fnv1a' };
    }
    async function verificarPin(pin) {
        const c = obter('config');
        if (!c?.pinHash) return false;
        const hash = await hashPin(pin, c.pinMetodo || 'fnv1a');
        return hash.pinHash === c.pinHash;
    }
    function sessaoAtiva() { return sessaoLer(chaveSessao) === '1'; }
    function abrirSessao() { sessaoGravar(chaveSessao, '1'); sessaoRemover(chaveTentativas); sessaoRemover(chaveBloqueio); }
    function encerrarSessao() { sessaoRemover(chaveSessao); }
    function bloqueioRestante() { return Math.max(0, Math.ceil((Number(sessaoLer(chaveBloqueio)) - Date.now()) / 1000) || 0); }
    function registrarErroPin() {
        const n = Number(sessaoLer(chaveTentativas) || 0) + 1;
        if (n >= 5) { sessaoGravar(chaveBloqueio, String(Date.now() + 30000)); sessaoGravar(chaveTentativas, '0'); return 30; }
        sessaoGravar(chaveTentativas, String(n));
        return 0;
    }
    async function definirPin(pin) {
        const config = obter('config');
        if (!config) throw Error('Configure o negócio primeiro.');
        gravar('config', { ...config, ...await hashPin(pin), versaoDados: VERSAO_DADOS });
        abrirSessao();
    }
    function migrarDados() {
        const c = obter('config');
        if (!c || (c.versaoDados || 1) >= VERSAO_DADOS) return;
        // Validar todas as coleções antes de gravar evita sobrescrever um JSON
        // corrompido com uma lista vazia. O usuário poderá recuperar o backup.
        const catalogo = lista('catalogo');
        const servicos = lista('servicos');
        const lancamentos = lista('lancamentos');
        const extras = ['profissionais','despesasFixas','movimentacoesEstoque'];
        extras.forEach(lista);
        if (problemas.size) {
            console.warn('AdmPro: migração adiada; existe armazenamento inválido. Restaure um backup antes de continuar.');
            return;
        }
        // Migração aditiva: preserva IDs e campos desconhecidos e só marca
        // versaoDados=3 depois das demais escritas, permitindo uma retomada.
        gravar('catalogo', catalogo.map(item => ({ controlaEstoque:false, qtdEstoque:0, estoqueMinimo:0, unidade:'un', ...item })));
        gravar('servicos', servicos.map(s => ({ profissionalId:null, recorrencia:{ ativa:false, intervalo:1, unidade:'meses' }, origemRecorrenciaId:null, proximoGeradoId:null, estoqueBaixado:false, lembreteEnviadoEm:null, ...s })));
        gravar('lancamentos', lancamentos.map(l => ({ despesaFixaId:null, competencia:l.data?.slice(0,7) || '', ...l })));
        for (const col of extras) {
            if (!lista(col).length) gravar(col, []);
        }
        gravar('config', { metaMensal:0, modeloNegocio:'outro', reciboSequencia:0, ...c, versaoDados:VERSAO_DADOS });
    }

    function obter(chave) {
        if (!COLECOES.includes(chave))
            throw Error('Coleção desconhecida.');
        try {
            const bruto = localStorage.getItem(PREFIXO + chave);
            if (!bruto) return vazio(chave);
            const dados = JSON.parse(bruto);
            if (chave === 'config' && (!dados || typeof dados !== 'object' || Array.isArray(dados))) throw Error('Configuração inválida');
            if (chave !== 'config' && !Array.isArray(dados)) throw Error('Coleção inválida');
            return dados;
        }
        catch (e) {
            // Não sobrescreve o dado original corrompido; permita exportar o backup antes de salvar.
            problemas.add(chave);
            return vazio(chave);
        }
    }
    function gravar(chave, valor) {
        if (!COLECOES.includes(chave))
            throw Error('Coleção desconhecida.');
        try {
            localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
            return copiar(valor);
        }
        catch (e) {
            console.error('Erro ao gravar dados:', e);
            throw Error('Sem espaço ou permissão para salvar dados. Exporte seu backup.');
        }
    }
    function lista(chave) { const v = obter(chave); return Array.isArray(v) ? v : []; }
    function porId(chave, id) { return lista(chave).find(v => v.id === id) || null; }
    function adicionar(chave, item) { const registros = lista(chave); registros.push(copiar(item)); gravar(chave, registros); if (chave === 'servicos') sincronizarServico(item.id); return item; }
    function atualizar(chave, id, alteracoes) {
        if (chave === 'servicos') { const anterior = porId(chave,id); if (anterior?.estoqueBaixado && alteracoes.itens && JSON.stringify(anterior.itens)!==JSON.stringify(alteracoes.itens)) reverterEstoque(anterior); }
        const registros = lista(chave), i = registros.findIndex(v => v.id === id); if (i < 0)
        throw Error('Registro não encontrado.'); registros[i] = { ...registros[i], ...copiar(alteracoes) }; gravar(chave, registros); if (chave === 'servicos') sincronizarServico(id, registros[i - 0]); return registros[i]; }
    function excluir(chave, id) { gravar(chave, lista(chave).filter(v => v.id !== id)); }
    function removerServico(id) {
        const lancamentos = lista('lancamentos'), servicos = lista('servicos');
        const s = servicos.find(x => x.id === id);
        if (s?.estoqueBaixado) reverterEstoque(s);
        try {
            gravar('lancamentos', lancamentos.filter(v => v.servicoId !== id));
            gravar('servicos', servicos.filter(v => v.id !== id));
        } catch (e) { gravar('lancamentos', lancamentos); gravar('servicos', servicos); throw e; }
    }
    function exportar() { const dados = { versao: 3, geradoEm: U.dataHora() }; COLECOES.forEach(k => dados[k] = obter(k)); return dados; }
    function validarBackup(dados) {
        if (!dados || ![1, 2, 3].includes(dados.versao) || !dados.config || typeof dados.config.nomeNegocio !== 'string' || !dados.config.nomeNegocio.trim() || typeof dados.config.telefone !== 'string' || !['rapido', 'projeto'].includes(dados.config.tipoNegocio) || !['claro', 'escuro', 'auto'].includes(dados.config.tema) || !Array.isArray(dados.config.diasAtendimento) || !dados.config.diasAtendimento.every(n => Number.isInteger(n) && n >= 0 && n <= 6) || !/^\d{2}:\d{2}$/.test(dados.config.horaInicio || '') || !/^\d{2}:\d{2}$/.test(dados.config.horaFim || ''))
            throw Error('Backup inválido: configurações ausentes ou versão incompatível.');
        for (const col of COLECOES.filter(c => c !== 'config' && (dados.versao >= 3 || !['profissionais','despesasFixas','movimentacoesEstoque'].includes(c)))) {
            if (!Array.isArray(dados[col]))
                throw Error(`Backup inválido: coleção ${col}.`);
            if (dados[col].some(v => !v || typeof v !== 'object' || typeof v.id !== 'string'))
                throw Error(`Backup inválido: registro em ${col}.`);
        }
        if (dados.clientes.some(c => !c.nome || !c.telefone))
            throw Error('Clientes inválidos no backup.');
        if (dados.catalogo.some(c => !c.nome || !['produto', 'servico'].includes(c.categoria) || !Number.isFinite(Number(c.preco))))
            throw Error('Catálogo inválido no backup.');
        if (dados.servicos.some(s => !s.clienteId || !Array.isArray(s.itens) || !Array.isArray(s.parcelas) || !Array.isArray(s.etapas) || !Array.isArray(s.historico) || !['orcamento', 'agendado', 'andamento', 'concluido', 'pago', 'cancelado'].includes(s.status)))
            throw Error('Serviços inválidos no backup.');
        if (dados.lancamentos.some(l => !l.descricao || !['entrada', 'saida'].includes(l.tipo) || !Number.isFinite(Number(l.valor)) || !/\d{4}-\d{2}-\d{2}/.test(l.data || '')))
            throw Error('Lançamentos inválidos no backup.');
        // Consistência referencial e monetária antes de modificar coleções locais.
        const idsClientes = new Set(dados.clientes.map(c => c.id));
        if (dados.servicos.some(s => !idsClientes.has(s.clienteId) || s.itens.some(i => !i.nome || !Number.isFinite(Number(i.qtd)) || !Number.isFinite(Number(i.precoUnit))) || s.parcelas.some(p => !p.id || !Number.isFinite(Number(p.valor)) || !/^\d{4}-\d{2}-\d{2}$/.test(p.vencimento || '')))) throw Error('Backup inválido: referências, itens ou parcelas inconsistentes.');
        for (const col of COLECOES.filter(c => c !== 'config' && Array.isArray(dados[c]))) {
            if (new Set(dados[col].map(x => x.id)).size !== dados[col].length) throw Error(`Backup inválido: IDs duplicados em ${col}.`);
        }
        if (dados.versao >= 3 && (dados.profissionais.some(p => !p.nome || Number(p.comissaoPercentual) < 0 || Number(p.comissaoPercentual) > 100) || dados.despesasFixas.some(d => !d.descricao || Number(d.valor) <= 0 || Number(d.diaVencimento) < 1 || Number(d.diaVencimento) > 28) || dados.movimentacoesEstoque.some(m => !['entrada','saida','ajuste'].includes(m.tipo)))) throw Error('Backup inválido: dados de gestão.');
        if (dados.config.pinHash && !['sha256', 'fnv1a'].includes(dados.config.pinMetodo)) throw Error('Backup inválido: proteção PIN desconhecida.');
        return true;
    }
    function importar(dados) { validarBackup(dados); const anterior = exportar(); try {
        COLECOES.forEach(k => gravar(k, k === 'config' ? { ...dados[k], versaoDados: Math.min(dados[k].versaoDados || 1, VERSAO_DADOS) } : dados[k] || []));
        problemas.clear();
        if ((dados.config.versaoDados || 1) < VERSAO_DADOS) migrarDados();
        encerrarSessao();
    }
    catch (e) {
        COLECOES.forEach(k => { try {
            gravar(k, anterior[k]);
        }
        catch (_) { /* Erro original será exibido. */ } });
        throw e;
    } }
    function limpar() { COLECOES.forEach(k => localStorage.removeItem(PREFIXO + k)); problemas.clear(); encerrarSessao(); sessaoRemover(chaveTentativas); sessaoRemover(chaveBloqueio); }
    function exemplo(tipo) {
        const rapido = tipo === 'rapido';
        const nomes = rapido ? ['Ana Costa', 'Beatriz Santos', 'Carla Oliveira', 'Daniela Rocha', 'Elisa Martins'] : ['Carlos Almeida', 'Mariana Lopes', 'Rafael Souza', 'Fernanda Lima', 'Paulo Mendes'];
        const telefones = ['11987654321', '11991234567', '19987654321', '11988776655', '19999887766'];
        const clientes = nomes.map((nome, i) => ({ id: U.id(), nome, telefone: U.mascaraTelefone(telefones[i]), endereco: `Rua das Flores, ${110 + i * 23}`, observacoes: '', criadoEm: U.dataHora() }));
        const modelo = A.modelos[obter('config')?.modeloNegocio] || A.modelos.outro;
        const catalogo = modelo.catalogo.map(x => ({ id:U.id(), ...copiar(x), ativo:true }));
        const hoje = U.hoje(), estados = rapido ? ['agendado', 'agendado', 'concluido', 'pago', 'pago', 'cancelado', 'agendado', 'andamento'] : ['orcamento', 'orcamento', 'agendado', 'andamento', 'concluido', 'pago', 'pago', 'cancelado'];
        const servicos = estados.map((status, i) => {
            const cat = catalogo[i % catalogo.length];
            const data = U.deslocarDia(hoje, [-1, 0, 0, -3, -5, -12, -20, 2][i]);
            const total = cat.preco;
            const parcelas = !rapido && i % 2 === 0 ? [{ id: U.id(), valor: Math.round(total * 50) / 100, vencimento: data, pago: status === 'pago', pagoEm: status === 'pago' ? data : null, formaPagamento: status === 'pago' ? 'pix' : null }, { id: U.id(), valor: total - Math.round(total * 50) / 100, vencimento: U.deslocarDia(data, 30), pago: status === 'pago', pagoEm: status === 'pago' ? data : null, formaPagamento: status === 'pago' ? 'pix' : null }] : [{ id: U.id(), valor: total, vencimento: data, pago: status === 'pago', pagoEm: status === 'pago' ? data : null, formaPagamento: status === 'pago' ? 'pix' : null }];
            return { id: U.id(), clienteId: clientes[i % 5].id, titulo: cat.nome, itens: [{ catalogoId: cat.id, nome: cat.nome, qtd: 1, precoUnit: cat.preco }], desconto: 0, total, status, data, hora: ['09:00', '10:00', '14:00', '11:00', '15:00', '08:00', '13:00', '16:00'][i], duracaoMin: cat.duracaoMin || 60, endereco: clientes[i % 5].endereco, observacoes: 'Exemplo demonstrativo', profissionalId:null, recorrencia:{ativa:false,intervalo:modelo.recorrencia.intervalo,unidade:modelo.recorrencia.unidade},origemRecorrenciaId:null,proximoGeradoId:null,estoqueBaixado:false,lembreteEnviadoEm:null,etapas: rapido ? [] : [{ id: U.id(), titulo: 'Visita técnica', concluida: i >= 3 }, { id: U.id(), titulo: 'Execução', concluida: i >= 5 }], parcelas, historico: [{ status, em: U.dataHora() }], criadoEm: U.dataHora() };
        });
        const lancamentos = [];
        servicos.forEach(s => s.parcelas.filter(p => p.pago).forEach(p => lancamentos.push({ id: U.id(), tipo: 'entrada', descricao: `Recebimento: ${s.titulo}`, valor: p.valor, data: p.pagoEm, categoria: 'Serviços', formaPagamento: p.formaPagamento, servicoId: s.id, parcelaId: p.id })));
        let i = 0;
        while (lancamentos.length < 10) {
            const saida = i % 3 !== 0;
            lancamentos.push({ id: U.id(), tipo: saida ? 'saida' : 'entrada', descricao: saida ? ['Materiais', 'Transporte', 'Aluguel'][i % 3] : 'Venda avulsa', valor: saida ? 65 + i * 14 : 110 + i * 10, data: U.deslocarDia(hoje, -i * 2), categoria: saida ? 'material' : 'Outros', formaPagamento: 'pix', servicoId: null });
            i++;
        }
        gravar('clientes', clientes);
        gravar('catalogo', catalogo);
        gravar('servicos', servicos);
        gravar('lancamentos', lancamentos);
    }
    function registrarPagamento(id, ids, data, formaPagamento, receberTudo = false) {
        const s = porId('servicos', id);
        if (!s) throw Error('Serviço não encontrado.');
        const alvos = s.parcelas.filter(p => ids.includes(p.id) && !p.pago);
        if (!alvos.length) return false;
        const antes = lista('lancamentos');
        const lancamentos = copiar(antes);
        const parcelas = s.parcelas.map(p => {
            if (!alvos.some(x => x.id === p.id)) return p;
            let l = lancamentos.find(x => x.servicoId === id && x.parcelaId === p.id && x.tipo === 'entrada');
            if (!l) {
                l = { id: U.id(), tipo: 'entrada', descricao: `Recebimento: ${s.titulo}`, valor: p.valor, data, categoria: 'Serviços', formaPagamento, servicoId: id, parcelaId: p.id };
                lancamentos.push(l);
            }
            return { ...p, pago: true, pagoEm: data, formaPagamento, lancamentoId: l.id };
        });
        let status = s.status;
        const historico = [...s.historico];
        if (receberTudo && status !== 'concluido' && status !== 'pago') { status = 'concluido'; historico.push({ status, em: U.dataHora() }); }
        if (parcelas.length && parcelas.every(p => p.pago) && status !== 'pago') { status = 'pago'; historico.push({ status, em: U.dataHora() }); }
        try {
            gravar('lancamentos', lancamentos);
            atualizar('servicos', id, { parcelas, status, historico });
        } catch (e) { gravar('lancamentos', antes); throw e; }
        return true;
    }
    function estornarPagamento(id, parcelaId) {
        const s = porId('servicos', id);
        const p = s?.parcelas.find(x => x.id === parcelaId);
        if (!p?.pago) return false;
        const antes = lista('lancamentos');
        const relacionado = antes.find(l => l.servicoId === id && l.parcelaId === parcelaId && l.tipo === 'entrada');
        const lancamentoId = p.lancamentoId || relacionado?.id;
        const restantes = antes.filter(l => l.id !== lancamentoId);
        const parcelas = s.parcelas.map(x => x.id === parcelaId ? { ...x, pago: false, pagoEm: null, formaPagamento: null, lancamentoId: null } : x);
        const status = s.status === 'pago' ? 'concluido' : s.status;
        const historico = status !== s.status ? [...s.historico, { status, em: U.dataHora() }] : s.historico;
        try {
            gravar('lancamentos', restantes);
            atualizar('servicos', id, { parcelas, status, historico });
        } catch (e) { gravar('lancamentos', antes); throw e; }
        return true;
    }

    // Operações coordenadas em uma única camada para manter a integridade das coleções.
    function movimentarEstoque(catalogoId, tipo, qtd, motivo, servicoId = null, valorCompra = 0) {
        const c = porId('catalogo', catalogoId);
        if (!c || c.categoria !== 'produto' || (!c.controlaEstoque && !servicoId)) throw Error('Produto sem controle de estoque.');
        const atual = Number(c.qtdEstoque || 0);
        const novo = R.movimento(atual, tipo, qtd);
        const movimento = { id:U.id(), catalogoId, tipo, qtd:Number(qtd), saldoAnterior:atual, saldoNovo:novo, motivo, servicoId, em:U.dataHora() };
        gravar('catalogo', lista('catalogo').map(p => p.id === c.id ? { ...p, qtdEstoque:novo } : p));
        gravar('movimentacoesEstoque', [...lista('movimentacoesEstoque'), movimento]);
        if (tipo === 'entrada' && U.centavos(valorCompra) > 0) adicionar('lancamentos', { id:U.id(), tipo:'saida', descricao:`Compra de ${c.nome}`, valor:valorCompra, data:U.hoje(), categoria:'material', formaPagamento:'pix', servicoId:null, competencia:U.hoje().slice(0,7) });
        return movimento;
    }
    function reverterEstoque(s) {
        if (!s.estoqueBaixado) return;
        const saidas = lista('movimentacoesEstoque').filter(m => m.servicoId === s.id && m.tipo === 'saida');
        const entradas = lista('movimentacoesEstoque').filter(m => m.servicoId === s.id && m.tipo === 'entrada');
        const compensadas = entradas.map(m => m.reverteId);
        saidas.filter(m => !compensadas.includes(m.id)).forEach(m => {
            if (porId('catalogo',m.catalogoId)) {
                const retorno = movimentarEstoque(m.catalogoId,'entrada',m.qtd,'Estorno de '+s.titulo,s.id);
                const todas = lista('movimentacoesEstoque');
                gravar('movimentacoesEstoque', todas.map(x => x.id === retorno.id ? { ...x, reverteId:m.id } : x));
            }
        });
        gravar('servicos',lista('servicos').map(x => x.id === s.id ? { ...x, estoqueBaixado:false } : x));
    }
    function sincronizarServico(id) {
        let s = porId('servicos', id);
        if (!s) return;
        const finalizado = ['concluido','pago'].includes(s.status);
        if (!finalizado && s.estoqueBaixado) reverterEstoque(s);
        s = porId('servicos',id);
        if (finalizado && !s.estoqueBaixado) {
            const baixas = R.itensEstoque(s, lista('catalogo'));
            Object.entries(baixas).forEach(([itemId, qtd]) => movimentarEstoque(itemId,'saida',qtd,'Conclusão de '+s.titulo,s.id));
            gravar('servicos',lista('servicos').map(x => x.id === id ? { ...x, estoqueBaixado:true } : x));
        }
        s = porId('servicos',id);
        if (finalizado && s.recorrencia?.ativa && !s.proximoGeradoId) {
            const proxima = R.proximaData(s.data,s.recorrencia);
            if (proxima) {
                const novoId = U.id();
                const novasParcelas = s.parcelas.map(p => ({ ...p, id:U.id(), pago:false, pagoEm:null, formaPagamento:null, lancamentoId:null, vencimento:R.proximaData(p.vencimento,s.recorrencia) || proxima }));
                const filho = { ...copiar(s), id:novoId, status:'agendado', data:proxima, parcelas:novasParcelas,
                    estoqueBaixado:false, proximoGeradoId:null, origemRecorrenciaId:s.id, lembreteEnviadoEm:null,
                    historico:[{status:'agendado',em:U.dataHora()}], criadoEm:U.dataHora(), reciboNumero:null,
                    etapas:s.etapas.map(e => ({ ...e, concluida:false })) };
                // Registra vínculo antes de gerar o filho para impedir duplicação.
                gravar('servicos',lista('servicos').map(x => x.id === id ? { ...x, proximoGeradoId:novoId } : x).concat(filho));
                ultimoRecorrente = { id:novoId, data:proxima };
            }
        }
    }
    let ultimoRecorrente = null;
    function consumirRecorrente() { const r = ultimoRecorrente; ultimoRecorrente = null; return r; }
    function gerarDespesasFixas(mes = U.hoje().slice(0,7)) {
        const novas = R.despesasDoMes(lista('despesasFixas'),lista('lancamentos'),mes);
        if (novas.length) {
            gravar('lancamentos',[...lista('lancamentos'),...novas.map(x => ({ id:U.id(),...x }))]);
            const ids = new Set(novas.map(n=>n.despesaFixaId));
            gravar('despesasFixas',lista('despesasFixas').map(d=>ids.has(d.id) ? { ...d, competenciasGeradas:[...new Set([...(d.competenciasGeradas||[]),mes])] } : d));
        }
        return novas.length;
    }
    function numeroRecibo(id) {
        const s = porId('servicos',id);
        if (!s || !s.parcelas.some(p => p.pago)) throw Error('Recibo disponível somente após pagamento.');
        if (s.reciboNumero) return s.reciboNumero;
        const config = obter('config'); const numero = Number(config.reciboSequencia || 0) + 1;
        gravar('config',{ ...config, reciboSequencia:numero });
        gravar('servicos',lista('servicos').map(x => x.id === id ? { ...x, reciboNumero:numero } : x));
        return numero;
    }
    function registrarLembrete(id) {
        const s = porId('servicos',id);
        if (!s) throw Error('Serviço não encontrado.');
        atualizar('servicos',id,{ lembreteEnviadoEm:U.dataHora() });
    }
    A.storage = { obter, gravar, lista, porId, adicionar, atualizar, excluir, removerServico, exportar, validarBackup, importar, limpar, exemplo, problemas, migrarDados, hashPin, verificarPin, definirPin, sessaoAtiva, abrirSessao, encerrarSessao, bloqueioRestante, registrarErroPin, registrarPagamento, estornarPagamento, movimentarEstoque, sincronizarServico, consumirRecorrente, gerarDespesasFixas, numeroRecibo, registrarLembrete };
})(window.AdmPro = window.AdmPro || {});
