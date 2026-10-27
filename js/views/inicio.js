/* Resumo e prioridades respeitando as permissões do membro da empresa. */
(function (A) {
    'use strict';
    const U=A.utils,UI=A.ui,S=A.storage,R=A.regras;
    function render() {
        const hoje=U.hoje(),mes=hoje.slice(0,7),podeFinanceiro=A.permissoes.pode('financeiro.ver'),
            podeEstoque=A.permissoes.pode('estoque.ver'),podeCriar=A.permissoes.pode('agenda.editar');
        const servicos=S.lista('servicos'),lanc=podeFinanceiro?S.lista('lancamentos').filter(l=>l.data.startsWith(mes)):[];
        const soma=tipo=>U.somarValores(lanc.filter(l=>l.tipo===tipo).map(l=>l.valor));
        const entradas=soma('entrada'),saidas=soma('saida');
        const abertas=podeFinanceiro?servicos.filter(s=>s.status!=='cancelado').flatMap(s=>(s.parcelas||[]).filter(p=>!p.pago).map(p=>({...p,servico:s}))):[];
        const receber=U.somarValores(abertas.map(p=>p.valor));
        const atrasadas=abertas.filter(p=>p.vencimento<hoje).sort((a,b)=>a.vencimento.localeCompare(b.vencimento));
        const destaque=A.perfil.destaque==='orcamento'?servicos.filter(s=>s.status==='orcamento'):servicos.filter(s=>s.data===hoje&&s.status!=='cancelado');
        destaque.sort((a,b)=>(a.hora||'').localeCompare(b.hora||''));
        const meta=podeFinanceiro?R.metaMensal(S.lista('lancamentos'),Number(S.obter('config').metaMensal||0),hoje):null;
        const estoqueBaixo=podeEstoque?R.estoqueBaixo(S.lista('catalogo')):[];
        const lembretes=servicos.filter(s=>s.status==='agendado'&&s.data===U.deslocarDia(hoje,1)&&!s.lembreteEnviadoEm);
        const metaHtml=!podeFinanceiro?'':`<section class="section meta-destaque">${meta.meta?UI.card(`<h2>Meta mensal</h2><p class="numero"><strong>${U.dinheiro(meta.recebido)}</strong> de ${U.dinheiro(meta.meta)}</p><div class="meta-trilha" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(meta.percentual,100)}"><div class="meta-progresso ${meta.percentual>=100?'meta-sucesso':meta.percentual>=50?'meta-primaria':''}" style="width:${Math.min(meta.percentual,100)}%"></div></div><p class="muted">${meta.percentual}% · ${meta.percentual>=100?'Meta batida!':'Faltam '+U.dinheiro(meta.falta)}. No ritmo atual, você fecha o mês com ${U.dinheiro(meta.projecao)}.</p>`):UI.card('<p>Defina sua meta de faturamento mensal.</p><a class="btn secundario compacto" href="#/gestao/meta">Definir meta mensal</a>')}</section>`;
        const financeiroHtml=!podeFinanceiro?'':`<div class="grid-resumo">${[
            ['Entradas do mês',entradas,'success'],['Saídas do mês',saidas,''],['Saldo',entradas-saidas,entradas-saidas<0?'danger':''],['Total a receber',receber,'']
        ].map(([rotulo,valor,classe])=>UI.card(`<p class="resumo-label">${rotulo}</p><p class="resumo-valor ${classe}">${U.dinheiro(valor)}</p>`)).join('')}</div>`;
        const estoqueHtml=estoqueBaixo.length?UI.card(`<p class="danger">${estoqueBaixo.length} itens com estoque baixo</p><a href="#/gestao/estoque" class="btn secundario compacto">Ver estoque</a>`):'';
        const vazioAgenda=destaque.length?destaque.slice(0,6).map(s=>UI.card(`<div class="list-card"><div class="grow"><h3>${U.escapar(s.titulo)}</h3><p class="item-meta">${U.escapar(S.porId('clientes',s.clienteId)?.nome||'Cliente removido')} · ${U.escapar(s.hora||U.exibirData(s.data))}</p></div>${UI.chip(s.status)}</div><a class="btn secundario compacto" style="margin-top:12px" href="#/servicos/${encodeURIComponent(s.id)}">Ver ${A.perfil.rotulo.toLowerCase()}</a>`)).join(''):(podeCriar?UI.vazio('Tudo em ordem',A.perfil.destaque==='orcamento'?'Não há orçamentos aguardando resposta.':'Nenhum compromisso para hoje.','Novo '+A.perfil.rotulo.toLowerCase(),'novoServico'):'<p class="muted">Nenhum compromisso para hoje.</p>');
        const parcelasHtml=!podeFinanceiro?'':`<section class="section"><div class="section-heading"><h2>Parcelas vencidas</h2><a href="#/financeiro">Financeiro</a></div><div class="stack">${atrasadas.length?atrasadas.map(p=>UI.card(`<div class="list-card"><div class="grow"><h3>${U.escapar(p.servico.titulo)}</h3><p class="item-meta">Venceu em ${U.exibirData(p.vencimento)}</p></div><strong class="danger numero">${U.dinheiro(p.valor)}</strong></div><a href="#/servicos/${encodeURIComponent(p.servico.id)}" class="btn secundario compacto" style="margin-top:12px">Ver parcela</a>`)).join(''):'<p class="muted">Nenhuma parcela vencida. ✓</p>'}</div></section>`;
        return `<div class="page-heading"><div><h1>Olá, ${U.escapar(S.obter('config').nomeNegocio)}!</h1><p class="muted">${U.formatarDia(hoje)}</p></div></div>${metaHtml}${estoqueHtml}${financeiroHtml}<section class="section"><div class="section-heading"><h2>${A.perfil.destaque==='orcamento'?'Orçamentos pendentes':'Agenda de hoje'}</h2><a href="${A.perfil.destaque==='orcamento'?'#/servicos':'#/agenda'}">Ver todos</a></div><div class="stack">${vazioAgenda}</div></section><section class="section"><h2>Lembretes de amanhã</h2><div class="stack">${lembretes.length?lembretes.map(s=>UI.card(`<div class="list-card"><div class="grow"><strong>${U.escapar(s.titulo)}</strong><p class="muted">${U.escapar(S.porId('clientes',s.clienteId)?.nome||'Cliente')} · ${U.escapar(s.hora)}</p></div><button class="btn secundario compacto" data-lembrete="${U.escapar(s.id)}">${UI.icon('sino',true)} Enviar</button></div>`)).join(''):'<p class="muted">Nenhum lembrete pendente para amanhã.</p>'}</div></section>${parcelasHtml}`;
    }
    function bind(root) {
        root.querySelectorAll('[data-lembrete]').forEach(b=>b.onclick=()=>A.views.servicos.enviarLembrete(b.dataset.lembrete));
        root.querySelector('[data-action="novoServico"]')?.addEventListener('click',()=>A.views.servicos.abrirForm());
    }
    A.views=A.views||{};A.views.inicio={render,bind};
})(window.AdmPro=window.AdmPro||{});
