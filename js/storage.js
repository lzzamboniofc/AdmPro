/* Único módulo autorizado a acessar localStorage. Substituível por API no futuro. */
(function (A) {
    'use strict';
    const U = A.utils, R = A.regras, PREFIXO = 'admpro_', COLECOES = ['config', 'clientes', 'catalogo', 'servicos', 'lancamentos', 'profissionais', 'despesasFixas', 'movimentacoesEstoque'];
    const copiar = v => JSON.parse(JSON.stringify(v));
    let contaAtual = null, aplicandoRemoto = false;
    const chaveCache = k => PREFIXO + (contaAtual ? contaAtual + '_' : '') + k;
    const VERSAO_DADOS = 3;
    const problemas = new Set();
    const vazio = chave => chave === 'config' ? null : [];
    // Proteção local simples, NÃO equivale a autenticação de servidor.
    // Em file://, crypto.subtle pode faltar: FNV-1a é fallback documentado,
    // não criptográfico. Ao migrar para backend, usar autenticação real.
    const chaveSessao = PREFIXO + 'sessao';
    const chaveTentativas = PREFIXO + 'tentativasPin';
    const chaveBloqueio = PREFIXO + 'bloqueioPin';
    function sessaoLer(chave) { try { return sessionStorage.getItem(chave + ':' + (contaAtual || 'sem-conta')); } catch (_) { return null; } }
    function sessaoGravar(chave, valor) { try { sessionStorage.setItem(chave + ':' + (contaAtual || 'sem-conta'), valor); } catch (_) { /* Navegador restrito: não mantém sessão. */ } }
    function sessaoRemover(chave) { try { sessionStorage.removeItem(chave + ':' + (contaAtual || 'sem-conta')); } catch (_) { /* Sessão já indisponível. */ } }
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
            if (!contaAtual) return vazio(chave);
            const bruto = localStorage.getItem(chaveCache(chave));
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
        if (!contaAtual) throw Error('Faça login para salvar dados.');
        validarEscrita(chave, valor); // preservar mensagem de limite/bloqueio
        const anterior = obter(chave);
        try {
            localStorage.setItem(chaveCache(chave), JSON.stringify(valor));
            registrarMudancas(chave, anterior, valor);
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
    function limpar() {
        if (!contaAtual) return;
        COLECOES.forEach(k => {
          const antes=obter(k);
          registrarMudancas(k,antes,k==='config'?null:[]);
          localStorage.removeItem(chaveCache(k));
        });
        problemas.clear();encerrarSessao();sessaoRemover(chaveTentativas);sessaoRemover(chaveBloqueio);
        agendarSync();
    }
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

    // Sincronização por conta e fila persistente: dados continuam acessíveis sem rede.
    const filaKey=()=>chaveCache('_fila');
    const cursorKey=()=>chaveCache('_cursor');
    const marcasKey=()=>chaveCache('_marcas');
    const fechadosKey=()=>chaveCache('_avisosFechados');
    const carregarJSON=(k,def)=>{try{return JSON.parse(localStorage.getItem(k))??def}catch(_){return def}};
    const salvarJSON=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
    let sincronizando=false,agendado=0,relogio=0,ultimoAcesso=0,falhaSync='',avisosAtivos=[];
    function fila(){return contaAtual?carregarJSON(filaKey(),[]):[]}
    function pendentes(){return fila().length}
    function estadoSync(){
      if(navigator.onLine===false)return 'Offline'+(pendentes()?' · '+pendentes()+' pendente(s)':'');
      if(sincronizando)return 'Sincronizando…';
      if(pendentes())return pendentes()+' alteração(ões) pendente(s)';
      return falhaSync?'Erro de sincronização':'Sincronizado';
    }
    function atualizarIndicador(){const n=document.getElementById('indicador-sync');if(n){n.textContent=estadoSync();n.title=falhaSync||n.textContent}}
    function usarConta(id){
      if(!/^[a-f0-9-]{36}$/i.test(id||''))throw Error('Conta inválida');
      if(contaAtual!==id){contaAtual=id;falhaSync='';avisosAtivos=[];ultimoAcesso=0}
      atualizarIndicador();
    }
    function limparCacheConta(userId){
      if(contaAtual){
        const prefixo=PREFIXO+contaAtual+'_';
        Object.keys(localStorage).filter(k=>k.startsWith(prefixo)).forEach(k=>localStorage.removeItem(k));
      }
      if(userId)localStorage.removeItem(PREFIXO+'usuario_'+userId);
      encerrarSessao();contaAtual=null;falhaSync='';avisosAtivos=[];ultimoAcesso=0;
      atualizarIndicador();
    }
    function novaData(){relogio=Math.max(Date.now(),relogio+1);return new Date(relogio).toISOString()}
    function seguro(colecao,item){
      const v=copiar(item);
      if(colecao==='config'){delete v.pinHash;delete v.pinMetodo}
      return v;
    }
    function registrarMudancas(colecao,antes,depois){
      if(!contaAtual||aplicandoRemoto)return;
      const antiga=colecao==='config'?(antes?[{...seguro(colecao,antes),id:'principal'}]:[]):antes||[];
      const nova=colecao==='config'?(depois?[{...seguro(colecao,depois),id:'principal'}]:[]):depois||[];
      const prev=new Map(antiga.map(v=>[v.id,v]));
      const atual=new Map(nova.map(v=>[v.id,v]));
      const pend=new Map(fila().map(v=>[v.colecao+':'+v.id,v]));
      for(const [id] of prev)if(!atual.has(id))pend.set(colecao+':'+id,{colecao,id,excluido:true,dados:{},atualizado_em:novaData()});
      for(const [id,item] of atual){
        if(!prev.has(id)||JSON.stringify(prev.get(id))!==JSON.stringify(item)){
          const anterior=pend.get(colecao+':'+id);
          pend.set(colecao+':'+id,{colecao,id,dados:seguro(colecao,item),excluido:false,atualizado_em:novaData(),novoRegistro:!prev.has(id)||anterior?.novoRegistro===true});
        }
      }
      salvarJSON(filaKey(),[...pend.values()]);
      atualizarIndicador();if(navigator.onLine!==false)agendarSync();
    }
    function validarEscrita(colecao,novo){
      if(!contaAtual||aplicandoRemoto)return;
      if(A.auth?.conta?.status_assinatura==='bloqueada')throw Error('CONTA_BLOQUEADA: somente leitura. Faça backup ou regularize.');
      const plano=A.auth?.conta?.planos||{};
      if(colecao==='clientes'&&Array.isArray(novo)&&plano.limite_clientes!=null&&novo.length>plano.limite_clientes){
        A.ui?.modal('Limite de clientes','<p>Seu plano permite até '+plano.limite_clientes+' clientes.</p><a class="btn" href="#/assinatura">Assinar o Pro</a>');
        throw Error('LIMITE_CLIENTES');
      }
      if(colecao==='servicos'&&Array.isArray(novo)&&plano.limite_servicos_mes!=null){
        const antes=new Set(lista('servicos').map(v=>v.id));
        const criados=novo.filter(v=>!antes.has(v.id)).length;
        const pend=fila().filter(v=>v.colecao==='servicos'&&!v.excluido&&v.novoRegistro).length;
        if(criados&&criados+pend+(A.auth?.servicosMes||0)>plano.limite_servicos_mes){
          A.ui?.modal('Limite mensal','<p>Seu plano permite '+plano.limite_servicos_mes+' serviços/mês.</p><a class="btn" href="#/assinatura">Assinar o Pro</a>');
          throw Error('LIMITE_SERVICOS_MES');
        }
      }
    }
    function agendarSync(){
      if(agendado||!contaAtual||navigator.onLine===false)return;
      agendado=setTimeout(()=>{agendado=0;sincronizar().catch(e=>{falhaSync=e.message;atualizarIndicador()})},80);
    }
    async function sincronizar(){
      if(!contaAtual||!A.auth?.usuario||sincronizando||navigator.onLine===false)return;
      const cid=contaAtual,client=A.auth.client;
      sincronizando=true;falhaSync='';atualizarIndicador();
      try{
        for(const item of fila()){
          if(cid!==contaAtual)return;
          const payload={conta_id:cid,colecao:item.colecao,id:item.id,dados:item.dados,excluido:item.excluido,atualizado_em:item.atualizado_em};
          const {error}=await client.from('dados').upsert(payload,{onConflict:'conta_id,colecao,id'});
          if(error){
            if(/STALE_WRITE/i.test(error.message)){salvarJSON(filaKey(),fila().filter(v=>v.colecao!==item.colecao||v.id!==item.id));continue;}
            falhaSync=error.message;
            if(/LIMITE_/i.test(error.message))A.ui?.modal('Limite do plano','<p>'+U.escapar(error.message)+'</p><a class="btn" href="#/assinatura">Assinar o Pro</a>');
            break;
          }
          salvarJSON(filaKey(),fila().filter(v=>!(v.colecao===item.colecao&&v.id===item.id&&v.atualizado_em===item.atualizado_em)));
        }
        if(cid===contaAtual){await buscarMudancas();await A.auth.atualizarConta();}
      }finally{sincronizando=false;atualizarIndicador()}
    }
    async function buscarMudancas(){
      if(!contaAtual)return;
      const cid=contaAtual,cursor=localStorage.getItem(cursorKey())||'1970-01-01T00:00:00.000Z';
      let offset=0,maior=cursor;
      while(true){
        const {data,error}=await A.auth.client.from('dados').select('id,colecao,dados,excluido,atualizado_em')
          .eq('conta_id',cid).gte('atualizado_em',cursor)
          .order('atualizado_em',{ascending:true}).order('id',{ascending:true})
          .range(offset,offset+499);
        if(error)throw error;
        if(cid!==contaAtual)return;
        if(!data?.length)break;
        integrarRemotos(data);
        maior=data.reduce((acc,x)=>x.atualizado_em>acc?x.atualizado_em:acc,maior);
        offset+=data.length;
        if(data.length<500)break;
      }
      localStorage.setItem(cursorKey(),maior);
      if(A.app?.refresh&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){
        if(obter('config'))A.app.aplicarConfig?.();
        A.app.refresh();
      }
    }
    function integrarRemotos(rows){
      const pend=new Set(fila().map(v=>v.colecao+':'+v.id));
      const marcas=carregarJSON(marcasKey(),{}),modificadas=new Map();
      for(const row of rows){
        const k=row.colecao+':'+row.id;
        if(pend.has(k)||(marcas[k]&&marcas[k]>row.atualizado_em))continue;
        if(!modificadas.has(row.colecao))modificadas.set(row.colecao,obter(row.colecao));
        if(row.colecao==='config'){
          const anterior=modificadas.get('config')||{};
          modificadas.set('config',row.excluido?null:{...row.dados,...(anterior.pinHash?{pinHash:anterior.pinHash,pinMetodo:anterior.pinMetodo}:{})});
        }else{
          const arr=modificadas.get(row.colecao)||[];
          const i=arr.findIndex(x=>x.id===row.id);
          if(row.excluido){if(i>=0)arr.splice(i,1)}
          else if(i>=0)arr[i]=row.dados;
          else arr.push(row.dados);
        }
        marcas[k]=row.atualizado_em;
      }
      aplicandoRemoto=true;
      try{
        for(const [col,val] of modificadas){
          if(val===null)localStorage.removeItem(chaveCache(col));
          else localStorage.setItem(chaveCache(col),JSON.stringify(val));
        }
        salvarJSON(marcasKey(),marcas);
      }finally{aplicandoRemoto=false}
    }
    async function registrarAcesso(){
      if(!contaAtual||navigator.onLine===false)return;
      const anterior=Math.max(ultimoAcesso,Number(localStorage.getItem(chaveCache('_ultimoAcesso'))||0));
      if(Date.now()-anterior<1800000)return;
      const {error}=await A.auth.client.rpc('registrar_acesso',{p_versao_app:A.supabaseConfig.versaoApp||''});
      if(error)throw error;
      ultimoAcesso=Date.now();localStorage.setItem(chaveCache('_ultimoAcesso'),String(ultimoAcesso));
    }
    async function dadosAssinatura(){
      if(!A.auth.conta)throw Error('Faça login.');
      const c=A.auth.conta,sb=A.auth.client;
      const rs=await Promise.all([
        sb.from('planos').select('*').eq('id',c.plano_id).single(),
        sb.from('pagamentos').select('*').eq('conta_id',c.id).order('criado_em',{ascending:false}),
        sb.from('config_sistema').select('chave,valor'),
        sb.from('planos').select('*').eq('nome','Pro').eq('ativo',true).maybeSingle()
      ]);
      for(const r of rs)if(r.error)throw r.error;
      return {conta:c,plano:rs[0].data,pagamentos:rs[1].data||[],config:Object.fromEntries((rs[2].data||[]).map(v=>[v.chave,v.valor])),pro:rs[3].data};
    }
    async function carregarAvisos(){
      if(!contaAtual||navigator.onLine===false)return avisosAtivos;
      const id=contaAtual;
      const {data,error}=await A.auth.client.from('avisos').select('id,titulo,mensagem,tipo').order('inicio',{ascending:false});
      if(error)throw error;
      if(id!==contaAtual)return [];
      const fechados=new Set(carregarJSON(fechadosKey(),[]));
      avisosAtivos=(data||[]).filter(v=>!fechados.has(v.id));
      return avisosAtivos;
    }
    function avisosHTML(){return avisosAtivos.map(a=>'<aside class="admpro-aviso '+(a.tipo==='alerta'?'alerta':'')+'" role="status"><div><strong>'+U.escapar(a.titulo)+'</strong><p>'+U.escapar(a.mensagem)+'</p></div><button class="icon-button" data-fechar-aviso="'+U.escapar(a.id)+'" aria-label="Fechar aviso">×</button></aside>').join('')}
    function bindAvisos(root){root.querySelectorAll('[data-fechar-aviso]').forEach(btn=>btn.onclick=()=>{salvarJSON(fechadosKey(),[...new Set([...carregarJSON(fechadosKey(),[]),btn.dataset.fecharAviso])]);avisosAtivos=avisosAtivos.filter(v=>v.id!==btn.dataset.fecharAviso);btn.closest('.admpro-aviso').remove()})}
    async function enviarFeedback(tipo,mensagem){
      if(!['duvida','problema','sugestao','pagamento'].includes(tipo))throw Error('Tipo inválido.');
      if(!contaAtual)throw Error('Faça login.');
      const {error}=await A.auth.client.from('feedbacks').insert({conta_id:contaAtual,tipo,mensagem});
      if(error)throw error;
    }
    async function listarFeedbacks(){
      if(!contaAtual)throw Error('Faça login.');
      const {data,error}=await A.auth.client.from('feedbacks').select('*').eq('conta_id',contaAtual).order('criado_em',{ascending:false});
      if(error)throw error;
      return data||[];
    }
    async function atualizarDadosConta(obj){
      const permitido=new Set(['nome_negocio','modelo_negocio','tipo_negocio','telefone','cidade','uf']);
      const dados=Object.fromEntries(Object.entries(obj).filter(([k])=>permitido.has(k)));
      if(!contaAtual||!Object.keys(dados).length)return;
      const {error}=await A.auth.client.from('contas').update(dados).eq('id',contaAtual);
      if(error)throw error;
      await A.auth.atualizarConta();
    }
    function possuiLegado(){return !!localStorage.getItem(PREFIXO+'config')}
    function importarLegado(){
      if(!contaAtual||obter('config'))throw Error('A conta já tem dados ou não está autenticada.');
      const obj={};
      for(const col of COLECOES){
        const raw=localStorage.getItem(PREFIXO+col);
        if(!raw)continue;
        const v=JSON.parse(raw);
        if(col==='config'?!v||typeof v!=='object':!Array.isArray(v))throw Error('Dados antigos inválidos.');
        obj[col]=v;
      }
      for(const col of COLECOES)if(obj[col])gravar(col,obj[col]);
    }
    function guardarContaUsuario(userId,c){salvarJSON(PREFIXO+'usuario_'+userId,c)}
    function contaCacheUsuario(userId){return carregarJSON(PREFIXO+'usuario_'+userId,null)}
    A.storage = { obter, gravar, lista, porId, adicionar, atualizar, excluir, removerServico, exportar, validarBackup, importar, limpar, exemplo, problemas, migrarDados, hashPin, verificarPin, definirPin, sessaoAtiva, abrirSessao, encerrarSessao, bloqueioRestante, registrarErroPin, registrarPagamento, estornarPagamento, movimentarEstoque, sincronizarServico, consumirRecorrente, gerarDespesasFixas, numeroRecibo, registrarLembrete, usarConta, limparCacheConta, pendentes, estadoSync, sincronizar, registrarAcesso, dadosAssinatura, carregarAvisos, avisosHTML, bindAvisos, enviarFeedback, listarFeedbacks, atualizarDadosConta, possuiLegado, importarLegado, guardarContaUsuario, contaCacheUsuario };
})(window.AdmPro = window.AdmPro || {});

/* ADMPRO-SUPABASE-INTEGRADO */
