/* Único módulo autorizado a acessar localStorage. Substituível por API no futuro. */
(function (A) {
    'use strict';
    const U = A.utils, PREFIXO = 'admpro_', COLECOES = ['config', 'clientes', 'catalogo', 'servicos', 'lancamentos'];
    const copiar = v => JSON.parse(JSON.stringify(v));
    const VERSAO_DADOS = 2;
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
        // Migração não destrutiva: preserva campos/IDs/parcelas antigos.
        gravar('config', { ...c, versaoDados: VERSAO_DADOS });
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
    function adicionar(chave, item) { const registros = lista(chave); registros.push(copiar(item)); gravar(chave, registros); return item; }
    function atualizar(chave, id, alteracoes) { const registros = lista(chave), i = registros.findIndex(v => v.id === id); if (i < 0)
        throw Error('Registro não encontrado.'); registros[i] = { ...registros[i], ...copiar(alteracoes) }; gravar(chave, registros); return registros[i]; }
    function excluir(chave, id) { gravar(chave, lista(chave).filter(v => v.id !== id)); }
    function removerServico(id) {
        const lancamentos = lista('lancamentos'), servicos = lista('servicos');
        try {
            gravar('lancamentos', lancamentos.filter(v => v.servicoId !== id));
            gravar('servicos', servicos.filter(v => v.id !== id));
        } catch (e) { gravar('lancamentos', lancamentos); gravar('servicos', servicos); throw e; }
    }
    function exportar() { const dados = { versao: 2, geradoEm: U.dataHora() }; COLECOES.forEach(k => dados[k] = obter(k)); return dados; }
    function validarBackup(dados) {
        if (!dados || ![1, 2].includes(dados.versao) || !dados.config || typeof dados.config.nomeNegocio !== 'string' || !dados.config.nomeNegocio.trim() || typeof dados.config.telefone !== 'string' || !['rapido', 'projeto'].includes(dados.config.tipoNegocio) || !['claro', 'escuro', 'auto'].includes(dados.config.tema) || !Array.isArray(dados.config.diasAtendimento) || !dados.config.diasAtendimento.every(n => Number.isInteger(n) && n >= 0 && n <= 6) || !/^\d{2}:\d{2}$/.test(dados.config.horaInicio || '') || !/^\d{2}:\d{2}$/.test(dados.config.horaFim || ''))
            throw Error('Backup inválido: configurações ausentes ou versão incompatível.');
        for (const col of COLECOES.filter(c => c !== 'config')) {
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
        for (const col of COLECOES.filter(c => c !== 'config')) {
            if (new Set(dados[col].map(x => x.id)).size !== dados[col].length) throw Error(`Backup inválido: IDs duplicados em ${col}.`);
        }
        if (dados.config.pinHash && !['sha256', 'fnv1a'].includes(dados.config.pinMetodo)) throw Error('Backup inválido: proteção PIN desconhecida.');
        return true;
    }
    function importar(dados) { validarBackup(dados); const anterior = exportar(); try {
        COLECOES.forEach(k => gravar(k, k === 'config' ? { ...dados[k], versaoDados: VERSAO_DADOS } : dados[k]));
        encerrarSessao();
    }
    catch (e) {
        COLECOES.forEach(k => { try {
            gravar(k, anterior[k]);
        }
        catch (_) { /* Erro original será exibido. */ } });
        throw e;
    } }
    function limpar() { COLECOES.forEach(k => localStorage.removeItem(PREFIXO + k)); encerrarSessao(); sessaoRemover(chaveTentativas); sessaoRemover(chaveBloqueio); }
    function exemplo(tipo) {
        const rapido = tipo === 'rapido';
        const nomes = rapido ? ['Ana Costa', 'Beatriz Santos', 'Carla Oliveira', 'Daniela Rocha', 'Elisa Martins'] : ['Carlos Almeida', 'Mariana Lopes', 'Rafael Souza', 'Fernanda Lima', 'Paulo Mendes'];
        const telefones = ['11987654321', '11991234567', '19987654321', '11988776655', '19999887766'];
        const clientes = nomes.map((nome, i) => ({ id: U.id(), nome, telefone: U.mascaraTelefone(telefones[i]), endereco: `Rua das Flores, ${110 + i * 23}`, observacoes: '', criadoEm: U.dataHora() }));
        const itens = rapido ? [['Manicure simples', 45, 45], ['Pedicure', 55, 60], ['Esmaltação em gel', 95, 75], ['Spa dos pés', 85, 60], ['Alongamento', 160, 120], ['Hidratação', 30, 20]] : [['Visita técnica', 250, 90], ['Projeto fotovoltaico', 1600, 300], ['Instalação de painéis', 3800, 480], ['Inversor solar', 3200, 0], ['Painel solar', 950, 0], ['Manutenção preventiva', 450, 120]];
        const catalogo = itens.map((x, i) => ({ id: U.id(), nome: x[0], categoria: (!rapido && (i === 3 || i === 4)) ? 'produto' : 'servico', preco: x[1], duracaoMin: x[2], ativo: true }));
        const hoje = U.hoje(), estados = rapido ? ['agendado', 'agendado', 'concluido', 'pago', 'pago', 'cancelado', 'agendado', 'andamento'] : ['orcamento', 'orcamento', 'agendado', 'andamento', 'concluido', 'pago', 'pago', 'cancelado'];
        const servicos = estados.map((status, i) => {
            const cat = catalogo[i % catalogo.length];
            const data = U.deslocarDia(hoje, [-1, 0, 0, -3, -5, -12, -20, 2][i]);
            const total = cat.preco;
            const parcelas = !rapido && i % 2 === 0 ? [{ id: U.id(), valor: Math.round(total * 50) / 100, vencimento: data, pago: status === 'pago', pagoEm: status === 'pago' ? data : null, formaPagamento: status === 'pago' ? 'pix' : null }, { id: U.id(), valor: total - Math.round(total * 50) / 100, vencimento: U.deslocarDia(data, 30), pago: status === 'pago', pagoEm: status === 'pago' ? data : null, formaPagamento: status === 'pago' ? 'pix' : null }] : [{ id: U.id(), valor: total, vencimento: data, pago: status === 'pago', pagoEm: status === 'pago' ? data : null, formaPagamento: status === 'pago' ? 'pix' : null }];
            return { id: U.id(), clienteId: clientes[i % 5].id, titulo: cat.nome, itens: [{ catalogoId: cat.id, nome: cat.nome, qtd: 1, precoUnit: cat.preco }], desconto: 0, total, status, data, hora: ['09:00', '10:00', '14:00', '11:00', '15:00', '08:00', '13:00', '16:00'][i], duracaoMin: cat.duracaoMin || 60, endereco: clientes[i % 5].endereco, observacoes: 'Exemplo demonstrativo', etapas: rapido ? [] : [{ id: U.id(), titulo: 'Visita técnica', concluida: i >= 3 }, { id: U.id(), titulo: 'Execução', concluida: i >= 5 }], parcelas, historico: [{ status, em: U.dataHora() }], criadoEm: U.dataHora() };
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
    A.storage = { obter, gravar, lista, porId, adicionar, atualizar, excluir, removerServico, exportar, validarBackup, importar, limpar, exemplo, problemas, migrarDados, hashPin, verificarPin, definirPin, sessaoAtiva, abrirSessao, encerrarSessao, bloqueioRestante, registrarErroPin, registrarPagamento, estornarPagamento };
})(window.AdmPro = window.AdmPro || {});
