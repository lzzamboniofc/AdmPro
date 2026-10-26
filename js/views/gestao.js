/* Gestão complementar: meta, estoque, profissionais e despesas fixas. */
(function (A) {
    'use strict';
    const U = A.utils, S = A.storage, UI = A.ui, R = A.regras;
    const hoje = () => U.hoje();
    const cabecalho = (titulo, desc) => `<div class="page-heading"><div><a href="#/config" class="text-button">← Configurações</a><h1>${titulo}</h1><p class="muted">${desc}</p></div></div>`;
    const acoes = (id) => `<div class="actions"><button class="btn secundario compacto" data-editar="${U.escapar(id)}">Editar</button><button class="btn secundario compacto" data-excluir="${U.escapar(id)}">Excluir</button></div>`;
    function render(tipo, id) {
        if (tipo === 'meta') {
            const meta = S.obter('config').metaMensal || 0;
            return cabecalho('Meta mensal','Defina quanto deseja faturar no mês.') + UI.card(`<form class="form-grid" id="form-meta">${UI.campo('Meta (R$)', 'meta', U.numerico(meta), { required:true, attrs:'inputmode="decimal" data-mask="moeda"' })}<button class="btn" type="submit">Salvar meta</button></form>`);
        }
        if (tipo === 'profissionais') {
            if (id) {
                const p = S.porId('profissionais',id);
                if (!p) return UI.vazio('Não encontrado','Profissional não localizado.');
                const servicos = S.lista('servicos').filter(s => s.profissionalId === id);
                const mes = hoje().slice(0,7);
                const valor = R.comissoes(p,servicos,S.lista('lancamentos'),mes);
                return cabecalho(U.escapar(p.nome),'Comissões e serviços') + UI.card(`<div class="grid-resumo"><div><small>Comissão no mês</small><h2>${U.dinheiro(valor.devido)}</h2></div><div><small>Já pago</small><h2>${U.dinheiro(valor.pago)}</h2></div><div><small>A pagar</small><h2>${U.dinheiro(valor.saldo)}</h2></div></div><button class="btn" data-pagar-comissao="${U.escapar(id)}" ${valor.saldo <= 0 ? 'disabled' : ''}>Registrar pagamento da comissão</button>`) + `<section class="section"><h2>Serviços realizados</h2><div class="stack">${servicos.length ? servicos.map(s=>UI.card(`<a href="#/servicos/${encodeURIComponent(s.id)}">${U.escapar(s.titulo)} · ${U.exibirData(s.data)}</a><p class="muted">${U.dinheiro(s.total)}</p>`)).join('') : UI.vazio('Sem serviços','Nenhum serviço vinculado.')}</div></section>`;
            }
            const lista = S.lista('profissionais');
            return cabecalho('Profissionais','Cadastre as pessoas que atendem seus clientes.') + `<button class="btn compacto" data-novo>+ Profissional</button><div class="stack section">${lista.length ? lista.map(p=>UI.card(`<div class="list-card"><div class="grow"><h3>${U.escapar(p.nome)}</h3><p class="muted">${U.escapar(p.telefone || 'Sem telefone')} · ${Number(p.comissaoPercentual)}% · ${p.ativo ? 'Ativo' : 'Inativo'}</p></div></div><div class="actions"><a class="btn secundario compacto" href="#/gestao/profissionais/${encodeURIComponent(p.id)}">Detalhes</a>${acoes(p.id)}</div>`)).join('') : UI.vazio('Nenhum profissional','Cadastre o primeiro profissional.','Adicionar','novo')}</div>`;
        }
        if (tipo === 'despesas') {
            const lista = S.lista('despesasFixas');
            return cabecalho('Despesas fixas','Criadas uma vez por competência a cada mês.') + `<button class="btn compacto" data-novo>+ Despesa fixa</button><div class="stack section">${lista.length ? lista.map(d=>UI.card(`<div class="list-card"><div class="grow"><h3>${U.escapar(d.descricao)}</h3><p class="muted">Dia ${d.diaVencimento} · ${U.escapar(d.categoria || 'outros')} · ${d.ativa ? 'Ativa':'Inativa'}</p></div><strong>${U.dinheiro(d.valor)}</strong></div>${acoes(d.id)}`)).join('') : UI.vazio('Sem despesas fixas','Adicione seus custos recorrentes.','Adicionar','novo')}</div>`;
        }
        if (tipo === 'estoque') {
            const produtos = S.lista('catalogo').filter(c=>c.categoria==='produto' && c.controlaEstoque);
            const movs = S.lista('movimentacoesEstoque').sort((a,b)=>b.em.localeCompare(a.em)).slice(0,40);
            return cabecalho('Estoque','Entradas, contagens e alertas de produtos.') + `<div class="stack">${produtos.length ? produtos.map(c=>UI.card(`<div class="list-card"><div class="grow"><h3>${U.escapar(c.nome)}</h3><p class="item-meta">Mínimo: ${Number(c.estoqueMinimo)} ${U.escapar(c.unidade || 'un')}</p></div><strong class="${Number(c.qtdEstoque)<=Number(c.estoqueMinimo)?'danger':''}">${Number(c.qtdEstoque)} ${U.escapar(c.unidade || 'un')}</strong></div><div class="actions"><button class="btn secundario compacto" data-mov="entrada" data-id="${U.escapar(c.id)}">Entrada</button><button class="btn secundario compacto" data-mov="ajuste" data-id="${U.escapar(c.id)}">Ajuste</button></div>`)).join('') : UI.vazio('Estoque vazio','Ative o controle de estoque nos produtos do catálogo.')}</div><section class="section"><h2>Histórico de movimentações</h2><div class="stack">${movs.length ? movs.map(m=>UI.card(`<div class="list-card"><div class="grow"><strong>${U.escapar(S.porId('catalogo',m.catalogoId)?.nome || 'Produto removido')}</strong><p class="item-meta">${U.dataHoraVisivel(m.em)} · ${U.escapar(m.motivo || m.tipo)}</p></div><span>${m.tipo==='ajuste'?'=':m.tipo==='saida'?'-':'+'}${Number(m.qtd)}</span></div>`)).join('') : UI.vazio('Sem movimentações','Ainda não há entradas ou baixas.')}</div></section>`;
        }
        return UI.vazio('Página não encontrada','Volte para Configurações.');
    }
    function bind(root, tipo, id) {
        if (tipo === 'meta') {
            UI.mascara(root);
            root.querySelector('#form-meta').onsubmit = e => { e.preventDefault(); const valor = U.lerMoeda(e.currentTarget.elements.meta.value); if (valor < 0) return UI.toast('Meta inválida.'); S.gravar('config',{ ...S.obter('config'), metaMensal:valor }); UI.toast('Meta salva.'); A.app.ir('#/inicio'); };
            return;
        }
        root.addEventListener('click', e => {
            const b = e.target.closest('button'); if (!b) return;
            if (b.hasAttribute('data-novo') || b.dataset.action === 'novo') editar(tipo);
            if (b.dataset.editar) editar(tipo,b.dataset.editar);
            if (b.dataset.excluir) UI.confirmar('Excluir cadastro?','Esta ação não apaga registros financeiros já gerados.',()=>{
                S.excluir(tipo==='despesas'?'despesasFixas':'profissionais',b.dataset.excluir);
                A.app.refresh(); UI.toast('Cadastro excluído.');
            });
            if (b.dataset.mov) movimentar(b.dataset.id,b.dataset.mov);
            if (b.dataset.pagarComissao) pagarComissao(b.dataset.pagarComissao);
        });
    }
    function editar(tipo, id) {
        const col = tipo==='despesas'?'despesasFixas':'profissionais';
        const registro = id ? S.porId(col,id) : null;
        const campos = tipo==='despesas'
            ? `${UI.campo('Descrição','descricao',registro?.descricao || '',{required:true})}${UI.campo('Valor mensal (R$)','valor',U.numerico(registro?.valor || 0),{required:true,attrs:'inputmode="decimal" data-mask="moeda"'})}${UI.campo('Dia de vencimento','diaVencimento',registro?.diaVencimento || 5,{type:'number',required:true,attrs:'min="1" max="28" inputmode="numeric"'})}${UI.campo('Categoria','categoria',registro?.categoria || 'aluguel',{options:['aluguel','material','transporte','outros'].map(x=>({value:x,label:x}))})}<label class="check-row"><input type="checkbox" name="ativa" ${registro?.ativa!==false?'checked':''}>Ativa</label>`
            : `${UI.campo('Nome','nome',registro?.nome || '',{required:true})}${UI.campo('Telefone','telefone',registro?.telefone || '',{attrs:'inputmode="tel" data-mask="telefone"'})}${UI.campo('Comissão (%)','comissaoPercentual',registro?.comissaoPercentual || 0,{type:'number',required:true,attrs:'min="0" max="100" step="0.01" inputmode="decimal"'})}<label class="check-row"><input type="checkbox" name="ativo" ${registro?.ativo!==false?'checked':''}>Ativo</label>`;
        UI.modal(id?'Editar cadastro':'Novo cadastro',`<form class="form-grid" id="form-gestao">${campos}<button class="btn" type="submit">Salvar</button></form>`,sheet=>{
            const form=sheet.querySelector('form');form.onsubmit=e=>{e.preventDefault();if(!UI.validar(form))return;
                const d=new FormData(form); const dados=tipo==='despesas' ? {descricao:d.get('descricao').trim(),valor:U.lerMoeda(d.get('valor')),diaVencimento:+d.get('diaVencimento'),categoria:d.get('categoria'),ativa:d.has('ativa')} : {nome:d.get('nome').trim(),telefone:U.mascaraTelefone(d.get('telefone')),comissaoPercentual:+d.get('comissaoPercentual'),ativo:d.has('ativo')};
                if(tipo==='despesas'&&(dados.valor<=0||dados.diaVencimento<1||dados.diaVencimento>28)) return UI.toast('Informe valor e dia entre 1 e 28.');
                if(tipo!=='despesas'&&(dados.comissaoPercentual<0||dados.comissaoPercentual>100)) return UI.toast('Comissão deve ficar entre 0 e 100%.');
                const botao=form.querySelector('[type="submit"]');botao.disabled=true;
                UI.tratarErro(()=>{ if(id)S.atualizar(col,id,dados);else S.adicionar(col,{id:U.id(),...dados,...(tipo==='despesas'?{criadaEm:U.dataHora()}: {})}); if(tipo==='despesas')S.gerarDespesasFixas();UI.fechar();A.app.refresh();UI.toast('Cadastro salvo.'); });
                if(form.isConnected)botao.disabled=false;
            };
        });
    }
    function movimentar(id,tipo) {
        const produto=S.porId('catalogo',id);if(!produto)return;
        UI.modal(tipo==='entrada'?'Entrada de estoque':'Ajuste de estoque',`<form class="form-grid">${UI.campo(tipo==='entrada'?'Quantidade recebida':'Nova quantidade','qtd',0,{type:'number',required:true,attrs:'min="0" step="0.01" inputmode="decimal"'})}${UI.campo('Motivo','motivo',tipo==='entrada'?'Compra':'Contagem física')}${tipo==='entrada'?UI.campo('Valor da compra (opcional)','custo','0,00',{attrs:'data-mask="moeda" inputmode="decimal"'}):''}<button class="btn" type="submit">Registrar</button></form>`,sheet=>{UI.mascara(sheet);sheet.querySelector('form').onsubmit=e=>{e.preventDefault();const d=new FormData(e.currentTarget),q=+d.get('qtd');if(!Number.isFinite(q)||q<0)return UI.toast('Quantidade inválida.');const btn=e.currentTarget.querySelector('[type="submit"]');btn.disabled=true;UI.tratarErro(()=>{S.movimentarEstoque(id,tipo,q,d.get('motivo').trim(),null,U.lerMoeda(d.get('custo')));UI.fechar();A.app.refresh();UI.toast('Estoque atualizado.');});if(e.currentTarget.isConnected)btn.disabled=false;};});
    }
    function pagarComissao(id) {
        const pr=S.porId('profissionais',id);if(!pr)return;
        const mes=hoje().slice(0,7),saldo=R.comissoes(pr,S.lista('servicos'),S.lista('lancamentos'),mes).saldo;
        if(saldo<=0)return;
        UI.confirmar('Pagar comissão?',`Registrar saída de ${U.dinheiro(saldo)} referente a ${pr.nome}?`,()=>{S.adicionar('lancamentos',{id:U.id(),tipo:'saida',descricao:'Comissão — '+pr.nome,valor:saldo,data:hoje(),categoria:'comissão',formaPagamento:'pix',profissionalId:id,competencia:mes,servicoId:null});A.app.refresh();UI.toast('Pagamento registrado no Financeiro.');},'Registrar pagamento');
    }
    A.views = A.views || {}; A.views.gestao = {render,bind};
})(window.AdmPro = window.AdmPro || {});
