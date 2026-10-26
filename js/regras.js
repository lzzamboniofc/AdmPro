/* Cálculos puros: recebem dados, devolvem resultados; sem DOM ou armazenamento. */
(function (A) {
    'use strict';
    const U = A.utils;
    const cent = U.centavos;
    const moeda = U.deCentavos;
    const somar = valores => moeda(valores.reduce((total, valor) => total + cent(valor), 0));

    function proximaData(data, recorrencia) {
        if (!recorrencia?.ativa || !Number.isInteger(+recorrencia.intervalo) || +recorrencia.intervalo < 1) return null;
        const quantidade = +recorrencia.intervalo;
        if (recorrencia.unidade === 'dias') return U.deslocarDia(data, quantidade);
        if (recorrencia.unidade === 'semanas') return U.deslocarDia(data, quantidade * 7);
        if (recorrencia.unidade !== 'meses') return null;
        const [ano, mes, dia] = data.split('-').map(Number);
        const primeiro = new Date(ano, mes - 1 + quantidade, 1);
        const ultimo = new Date(primeiro.getFullYear(), primeiro.getMonth() + 1, 0).getDate();
        return U.dataISO(new Date(primeiro.getFullYear(), primeiro.getMonth(), Math.min(dia, ultimo)));
    }
    function itensEstoque(servico, catalogo) {
        return (servico.itens || []).reduce((itens, item) => {
            const produto = catalogo.find(c => c.id === item.catalogoId && c.categoria === 'produto' && c.controlaEstoque);
            if (produto) itens[produto.id] = (itens[produto.id] || 0) + Number(item.qtd || 0);
            return itens;
        }, {});
    }
    const estoqueBaixo = catalogo => catalogo.filter(c => c.categoria === 'produto' && c.controlaEstoque && Number(c.qtdEstoque) <= Number(c.estoqueMinimo));
    function movimento(quantidadeAtual, tipo, quantidade) {
        const qtd = Number(quantidade);
        if (!Number.isFinite(qtd) || qtd < 0) throw Error('Quantidade inválida.');
        if (tipo === 'ajuste') return qtd;
        return Number(quantidadeAtual) + (tipo === 'entrada' ? qtd : -qtd);
    }
    function despesasDoMes(despesas, lancamentos, competencia) {
        return despesas.filter(d => d.ativa &&
            String(d.criadaEm || '').slice(0, 7) <= competencia &&
            !(d.competenciasGeradas || []).includes(competencia) &&
            !lancamentos.some(l => l.despesaFixaId === d.id && l.competencia === competencia))
            .map(d => ({ despesaFixaId: d.id, descricao: d.descricao, valor: Number(d.valor),
                data: `${competencia}-${U.dois(d.diaVencimento)}`, competencia,
                tipo: 'saida', categoria: d.categoria || 'outros', formaPagamento: 'pix', servicoId: null }));
    }
    function comissaoServico(servico, profissional, mes) {
        if (!profissional || !servico || servico.profissionalId !== profissional.id) return 0;
        const recebido = (servico.parcelas || []).filter(p => p.pago && (!mes || String(p.pagoEm).slice(0, 7) === mes)).map(p => p.valor);
        return moeda(Math.round(cent(somar(recebido)) * Number(profissional.comissaoPercentual || 0) / 100));
    }
    function comissoes(profissional, servicos, lancamentos, mes) {
        const devido = somar(servicos.map(s => comissaoServico(s, profissional, mes)));
        const pago = somar(lancamentos.filter(l => l.categoria === 'comissão' && l.profissionalId === profissional.id && l.data.startsWith(mes)).map(l => l.valor));
        return { devido, pago, saldo: moeda(Math.max(0, cent(devido) - cent(pago))) };
    }
    function metaMensal(lancamentos, meta, hoje) {
        const mes = hoje.slice(0, 7);
        const recebido = somar(lancamentos.filter(l => l.tipo === 'entrada' && l.data.startsWith(mes)).map(l => l.valor));
        const diasMes = new Date(+mes.slice(0, 4), +mes.slice(5, 7), 0).getDate();
        const dia = +hoje.slice(-2);
        const percentual = meta > 0 ? Math.round(recebido / meta * 100) : 0;
        return { recebido, meta, percentual, falta: moeda(Math.max(0, cent(meta) - cent(recebido))),
            projecao: moeda(Math.round(cent(recebido) / Math.max(1, dia) * diasMes)) };
    }
    function periodo(tipo, hoje) {
        const ano = +hoje.slice(0, 4), mes = +hoje.slice(5, 7);
        let inicio, fim, anteriorInicio, anteriorFim;
        if (tipo === 'ano') {
            inicio = `${ano}-01-01`; fim = `${ano + 1}-01-01`;
            anteriorInicio = `${ano - 1}-01-01`; anteriorFim = inicio;
        } else {
            const qtd = tipo === 'trimestre' ? 3 : 1;
            const ref = tipo === 'anterior' ? U.deslocarMes(hoje, -1) : hoje.slice(0, 7);
            inicio = U.deslocarMes(ref, 1 - qtd) + '-01';
            fim = U.deslocarMes(ref, 1) + '-01';
            anteriorInicio = U.deslocarMes(inicio, -qtd) + '-01'; anteriorFim = inicio;
        }
        return { inicio, fim, anteriorInicio, anteriorFim };
    }
    const dentro = (data, ini, fim) => String(data || '') >= ini && String(data || '') < fim;
    function relatorio(tipo, hoje, servicos, clientes, lancamentos, profissionais) {
        const p = periodo(tipo, hoje);
        const movimentos = lancamentos.filter(l => dentro(l.data, p.inicio, p.fim));
        const e = movimentos.filter(l => l.tipo === 'entrada');
        const saidas = movimentos.filter(l => l.tipo === 'saida');
        const serv = servicos.filter(s => s.status !== 'cancelado' && dentro(s.data, p.inicio, p.fim));
        const antes = servicos.filter(s => s.status !== 'cancelado' && dentro(s.data, p.anteriorInicio, p.anteriorFim));
        const antesEnt = somar(lancamentos.filter(l => l.tipo === 'entrada' && dentro(l.data, p.anteriorInicio, p.anteriorFim)).map(l => l.valor));
        const faturamento = somar(e.map(l => l.valor));
        const variacao = (a, b) => b ? Math.round((a - b) / b * 100) : a ? 100 : 0;
        const agregar = (lista, chave, valor) => {
            const grupos = new Map();
            lista.forEach(item => {
                const k = chave(item);
                const anterior = grupos.get(k) || { nome: k, qtd: 0, valor: 0 };
                anterior.qtd++;
                anterior.valor = moeda(cent(anterior.valor) + cent(valor(item)));
                grupos.set(k, anterior);
            });
            return [...grupos.values()];
        };
        const itens = serv.flatMap(s => s.itens.map(i => ({ ...i, valor: i.qtd * i.precoUnit })));
        const produtos = agregar(itens, i => i.nome, i => i.valor);
        const clientesTop = agregar(serv, s => s.clienteId, s => s.total).map(c => ({ ...c, nome: clientes.find(x => x.id === c.nome)?.nome || 'Cliente' }));
        const sumidos = clientes.filter(c => {
            const datas = servicos.filter(s => s.clienteId === c.id && s.status !== 'cancelado').map(s => s.data).sort();
            return datas.length && U.deslocarDia(datas[0] > datas[datas.length - 1] ? datas[0] : datas[datas.length - 1], 60) < hoje;
        });
        const despesas = agregar(saidas, l => l.categoria || 'outros', l => l.valor).sort((a, b) => b.valor - a.valor);
        const comissoesLista = profissionais.map(pr => {
            const recebido = somar(servicos.filter(s=>s.profissionalId===pr.id).flatMap(s => s.parcelas.filter(par=>par.pago && dentro(par.pagoEm,p.inicio,p.fim)).map(par=>moeda(Math.round(cent(par.valor)*Number(pr.comissaoPercentual||0)/100)))));
            const pago = somar(lancamentos.filter(l=>l.profissionalId===pr.id && l.categoria==='comissão' && dentro(l.data,p.inicio,p.fim)).map(l=>l.valor));
            return { nome:pr.nome,devido:recebido,pago,saldo:moeda(Math.max(0,cent(recebido)-cent(pago))) };
        });
        return { periodo: p, faturamento, quantidade: serv.length, ticket: serv.length ? moeda(Math.round(cent(faturamento) / serv.length)) : 0,
            variacaoFaturamento: variacao(faturamento, antesEnt), variacaoQuantidade: variacao(serv.length, antes.length),
            variacaoTicket: variacao(serv.length ? faturamento / serv.length : 0, antes.length ? antesEnt / antes.length : 0),
            receita: [...produtos].sort((a,b)=>b.valor-a.valor).slice(0,5), quantidadeItens: [...produtos].sort((a,b)=>b.qtd-a.qtd).slice(0,5),
            clientes: clientesTop.sort((a,b)=>b.valor-a.valor).slice(0,5), sumidos, despesas, comissoes: comissoesLista };
    }
    A.regras = { proximaData, itensEstoque, estoqueBaixo, movimento, despesasDoMes, comissaoServico, comissoes, metaMensal, periodo, relatorio };
})(window.AdmPro = window.AdmPro || {});
