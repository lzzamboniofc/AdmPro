/* Único módulo autorizado a acessar localStorage. Substituível por API no futuro. */
(function (A) {
    'use strict';
    const U = A.utils, PREFIXO = 'admpro_', COLECOES = ['config', 'clientes', 'catalogo', 'servicos', 'lancamentos'];
    const copiar = v => JSON.parse(JSON.stringify(v));
    function obter(chave) {
        if (!COLECOES.includes(chave))
            throw Error('Coleção desconhecida.');
        try {
            const bruto = localStorage.getItem(PREFIXO + chave);
            return bruto ? JSON.parse(bruto) : (chave === 'config' ? null : []);
        }
        catch (e) {
            console.error('Erro ao ler dados:', e);
            throw Error('Não foi possível ler os dados do navegador.');
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
    function removerServico(id) { gravar('lancamentos', lista('lancamentos').filter(v => v.servicoId !== id)); excluir('servicos', id); }
    function exportar() { const dados = { versao: 1, geradoEm: U.dataHora() }; COLECOES.forEach(k => dados[k] = obter(k)); return dados; }
    function validarBackup(dados) {
        if (!dados || dados.versao !== 1 || !dados.config || typeof dados.config.nomeNegocio !== 'string' || !dados.config.nomeNegocio.trim() || typeof dados.config.telefone !== 'string' || !['rapido', 'projeto'].includes(dados.config.tipoNegocio) || !['claro', 'escuro', 'auto'].includes(dados.config.tema) || !Array.isArray(dados.config.diasAtendimento) || !dados.config.diasAtendimento.every(n => Number.isInteger(n) && n >= 0 && n <= 6) || !/^\d{2}:\d{2}$/.test(dados.config.horaInicio || '') || !/^\d{2}:\d{2}$/.test(dados.config.horaFim || ''))
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
        return true;
    }
    function importar(dados) { validarBackup(dados); const anterior = exportar(); try {
        COLECOES.forEach(k => gravar(k, dados[k]));
    }
    catch (e) {
        COLECOES.forEach(k => { try {
            gravar(k, anterior[k]);
        }
        catch (_) { /* Erro original será exibido. */ } });
        throw e;
    } }
    function limpar() { COLECOES.forEach(k => localStorage.removeItem(PREFIXO + k)); }
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
    A.storage = { obter, gravar, lista, porId, adicionar, atualizar, excluir, removerServico, exportar, validarBackup, importar, limpar, exemplo };
})(window.AdmPro = window.AdmPro || {});
