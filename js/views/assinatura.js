(function(A){
'use strict';
const U=A.utils,UI=A.ui,S=A.storage;
let info=null,erro='',carregando=false,carregado=false,contaDaTela=null,ultimaConsulta=0;
const dinheiro=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(c||0)/100);
const data=d=>d?new Date(d.slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR'):'—';
const nomes={trial:'Em teste',ativa:'Ativa',atrasada:'Pagamento em atraso',bloqueada:'Temporariamente bloqueada',cancelada:'Cancelada'};
const statusPedido={aguardando_pagamento:'Aguardando Pix',em_analise:'Pagamento informado — em análise',aprovado:'Pix confirmado e plano ativado',recusado:'Pagamento não confirmado',cancelado:'Solicitação cancelada'};
const titular=()=>A.auth.membro?.papel==='dono' && A.auth.membro?.ativo!==false;
const pedidoAberto=()=>info?.pedidos?.find(v=>['aguardando_pagamento','em_analise'].includes(v.status));
function avisar(msg){UI.toast(msg)}
async function recarregar(){
 const id=A.auth.conta?.id;
 info=null;erro='';carregado=false;ultimaConsulta=0;
 try{await A.auth.atualizarConta();}catch(e){console.warn('Assinatura:',e.message)}
 if(id===A.auth.conta?.id && location.hash==='#/assinatura')A.app.refresh();
}
function pedidoHTML(){
 if(!titular())return '';
 const p=pedidoAberto();
 if(!p){
   const ultimo=info?.pedidos?.[0];
   if(!ultimo||!['recusado','aprovado'].includes(ultimo.status))return '';
   return UI.card('<div class="pedido-plano-situacao '+(ultimo.status==='aprovado'?'pedido-ok':'pedido-recusado')+'">'+
    '<strong>'+U.escapar(statusPedido[ultimo.status])+'</strong>'+
    (ultimo.motivo_recusa?'<p>Motivo: '+U.escapar(ultimo.motivo_recusa)+'</p>':'')+
    '<p class="muted">Pedido de '+data(ultimo.criado_em)+'. '+(ultimo.status==='recusado'?'Escolha um plano novamente quando desejar.':'Seu plano já deve aparecer atualizado acima.')+'</p></div>');
 }
 const alvo=(info.planos||[]).find(v=>v.id===p.plano_destino_id);
 const aguardando=p.status==='aguardando_pagamento';
 return '<section class="section pedido-plano-section"><h2>Seu pedido de plano</h2>'+
 UI.card('<div class="pedido-plano-situacao">'+
  '<strong>'+U.escapar(alvo?.nome||'Plano selecionado')+'</strong>'+
  '<span class="pedido-plano-status '+(aguardando?'':'pedido-analise')+'">'+U.escapar(statusPedido[p.status])+'</span></div>'+
  '<p>Valor do primeiro mês: <b>'+dinheiro(p.valor_centavos)+'</b></p>'+
  (aguardando?
  '<div class="pedido-plano-pix"><p><strong>Faça seu Pix</strong></p>'+
  '<p>Chave Pix: <code>'+U.escapar(p.pix_chave)+'</code></p>'+
  '<p>Beneficiário: <b>'+U.escapar(p.pix_beneficiario)+'</b></p>'+
  '<p>Valor exato: <b>'+dinheiro(p.valor_centavos)+'</b></p></div>'+
  '<p class="muted">Confirme o beneficiário no seu banco antes de transferir. Esta é uma chave Pix, não um código Pix Copia e Cola.</p>'+
  '<div class="actions"><button type="button" class="btn secundario" id="copiar-pix-plano">Copiar chave Pix</button>'+
  '<button type="button" class="btn" id="informar-pix-plano">Já fiz o Pix</button>'+
  '<button type="button" class="btn secundario" id="cancelar-pedido-plano">Cancelar pedido</button></div>':
  '<p>Recebemos sua informação de pagamento. A equipe vai conferir o recebimento no extrato e liberar o plano escolhido.</p>'+
  (p.declaracao_cliente?'<p><b>Dados informados:</b> '+U.escapar(p.declaracao_cliente)+'</p>':'')+
  '<p class="muted">Enquanto o pagamento não for confirmado no AdmPro Console, seu plano e seus limites atuais continuam os mesmos. Você pode atualizar a tela para consultar o resultado.</p>')+
  '<div class="actions"><button type="button" class="btn secundario" id="atualizar-pedido-plano">Atualizar situação</button></div>')+
 '</section>';
}
function render(){
 const atual=A.auth.conta;
 if(contaDaTela!==atual?.id || (info&&info.conta.plano_id!==atual?.plano_id)){
   info=null;erro='';carregado=false;contaDaTela=atual?.id;ultimaConsulta=0;
 }
 if(info&&Date.now()-ultimaConsulta>60000){info=null;carregado=false;}
 if(!info)return '<div class="page-heading"><h1>Minha assinatura</h1></div><p class="muted">'+U.escapar(erro||'Carregando sua assinatura…')+'</p>';
 const {conta:c,plano:p,pagamentos,config,planos}=info;
 const dias=c.trial_ate?Math.max(0,Math.ceil((new Date(c.trial_ate+'T12:00:00')-new Date())/86400000)):0;
 const contratado=c.preco_acordado_centavos==null?p.preco_mensal_centavos:c.preco_acordado_centavos;
 const pago=Number(contratado||0)>0;
 const pix=pago&&c.status_assinatura!=='trial'&&!!config.pix_chave&&!!config.pix_nome_recebedor;
 const podeTrocar=titular()&&!['bloqueada','cancelada'].includes(c.status_assinatura);
 const emAnalise=pedidoAberto()?.status==='em_analise';
 const cards=(planos||[]).map(v=>{
   const ativo=v.id===p.id;
   const ativarTrial=ativo&&c.status_assinatura==='trial'&&v.preco_mensal_centavos>0;
   const alternativo=!ativo||ativarTrial;
   let botao='';
   if(!titular())botao='<small>Somente o proprietário pode alterar o plano.</small>';
   else if(!podeTrocar)botao='<small>Regularize sua conta para alterar o plano.</small>';
   else if(emAnalise)botao='<small>Há um Pix aguardando análise.</small>';
   else if(alternativo){
      botao='<button type="button" class="btn secundario" data-solicitar-plano="'+U.escapar(v.id)+'">'+
        (v.preco_mensal_centavos===0?'Mudar para Grátis':ativarTrial?'Contratar o Easy':'Escolher e pagar Pix')+'</button>';
   }
   return '<div class="plano-assinatura-card'+(ativo?' atual':'')+'"><div class="plano-assinatura-cabecalho"><strong>'+U.escapar(v.nome)+'</strong>'+
    (ativo?'<span class="plano-assinatura-atual">'+(c.status_assinatura==='trial'?'Em teste':'Seu plano')+'</span>':'')+'</div>'+
    '<p class="plano-assinatura-preco">'+dinheiro(v.preco_mensal_centavos)+'<small>/mês</small></p>'+
    '<p>'+(v.limite_clientes??'Clientes ilimitados')+(v.limite_clientes!=null?' clientes':'')+
    ' · '+(v.limite_servicos_mes??'Serviços ilimitados')+(v.limite_servicos_mes!=null?' serviços/mês':'')+'</p>'+
    botao+'</div>';
 }).join('');
 return '<div class="page-heading"><div><h1>Minha assinatura</h1><p class="muted">Escolha o plano e pague com Pix. A ativação é feita após a confirmação do recebimento.</p></div><a class="btn secundario" href="#/config">Voltar</a></div>'+
 UI.card('<p><b>Plano atual:</b> '+U.escapar(p.nome)+'</p><p><b>Situação:</b> '+U.escapar(nomes[c.status_assinatura]||c.status_assinatura)+'</p>'+
 '<p><b>'+(c.status_assinatura==='trial'?'Valor após o teste':'Mensalidade contratada')+':</b> '+dinheiro(contratado)+'</p>'+
 (c.status_assinatura==='trial'?'<p>Seu período de teste termina em '+dias+' dia(s). Sem contratação, o acesso passa para o plano Grátis.</p>':'')+
 '<p><b>Próximo vencimento:</b> '+data(c.proximo_vencimento)+'</p>'+
 '<p><b>Limites:</b> '+(p.limite_clientes??'Ilimitados')+' clientes · '+(p.limite_servicos_mes??'Ilimitados')+' serviços/mês</p>')+
 pedidoHTML()+
 '<section class="section"><h2>Planos disponíveis</h2><div class="planos-assinatura-grade">'+cards+'</div>'+
 '<p class="muted">Ao escolher um plano pago, o valor será cobrado integralmente e o novo ciclo mensal começa na data do Pix confirmado. Não há cálculo proporcional nesta etapa.</p></section>'+
 UI.card('<h2>Pagamento da mensalidade atual</h2>'+
 (pago?'<p>Valor contratado: <b>'+dinheiro(contratado)+'</b></p>':'<p>Seu plano atual não exige mensalidade.</p>')+
 (pix?'<p><b>Chave Pix:</b> <code>'+U.escapar(String(config.pix_chave))+'</code></p><p><b>Recebedor:</b> '+U.escapar(String(config.pix_nome_recebedor))+'</p><div class="actions"><button class="btn secundario" id="copiar-pix">Copiar chave Pix</button><button class="btn" id="avisar-pagamento">Já paguei a mensalidade</button></div>':
 (pago?'<p class="muted">Consulte o suporte para obter os dados de pagamento.</p>':''))+
 '<p class="muted">Esta seção é para renovar o plano que você já utiliza. Para trocar de plano, use os botões acima.</p>')+
 '<section class="section"><h2>Histórico de pagamentos</h2>'+
 UI.card(pagamentos.length?pagamentos.map(v=>'<p>'+U.escapar(v.referencia)+' · '+dinheiro(v.valor_centavos)+' · '+U.escapar(v.status)+' · '+data(v.pago_em||v.criado_em)+'</p>').join(''):'<p>Nenhum pagamento registrado.</p>')+'</section>';
}
function bind(root){
 if(!info){if(!carregado&&!carregando)carregar();return;}
 root.querySelector('#atualizar-pedido-plano')?.addEventListener('click',recarregar);
 root.querySelector('#copiar-pix-plano')?.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(pedidoAberto().pix_chave);avisar('Chave Pix copiada.');}
  catch(e){avisar('Não foi possível copiar a chave Pix.');}
 });
 root.querySelector('#informar-pix-plano')?.addEventListener('click',()=>{
  const pedido=pedidoAberto();if(!pedido)return;
  UI.modal('Informar pagamento Pix','<p>Informe que você realizou a transferência de <b>'+
    dinheiro(pedido.valor_centavos)+'</b>. O plano só será ativado após a equipe conferir o recebimento no banco.</p>'+
    '<form id="informar-pix-form" class="form-grid"><label class="field">Detalhes da transferência (opcional)'+
    '<textarea name="detalhes" maxlength="500" placeholder="Horário, banco ou identificador da transação"></textarea></label>'+
    '<button class="btn" type="submit">Enviar para conferência</button></form>',sheet=>{
     sheet.querySelector('form').onsubmit=async e=>{
       e.preventDefault();const b=e.currentTarget.querySelector('[type="submit"]');b.disabled=true;
       try{
        await A.auth.client.rpc('informar_pix_plano',{
           p_pedido:pedido.id,p_detalhes:new FormData(e.currentTarget).get('detalhes')||''
        }).then(r=>{if(r.error)throw r.error});
        UI.fechar();avisar('Pagamento informado. Aguarde a confirmação no Console.');
        await recarregar();
       }catch(err){b.disabled=false;avisar(err.message)}
     };
  });
 });
 root.querySelector('#cancelar-pedido-plano')?.addEventListener('click',()=>{
  const pedido=pedidoAberto();if(!pedido)return;
  UI.confirmar('Cancelar pedido de plano',
    'Deseja cancelar esta solicitação ainda não informada como paga? Nenhum valor será devolvido automaticamente.',
    async()=>{try{
      const r=await A.auth.client.rpc('cancelar_pedido_plano',{p_pedido:pedido.id});
      if(r.error)throw r.error;avisar('Solicitação cancelada.');await recarregar();
    }catch(e){avisar(e.message)}},'Cancelar pedido');
 });
 root.querySelectorAll('[data-solicitar-plano]').forEach(b=>b.addEventListener('click',()=>{
  const plano=(info.planos||[]).find(v=>v.id===b.dataset.solicitarPlano);if(!plano)return;
  const gratis=plano.preco_mensal_centavos===0;
  const mensagem=gratis?
     'Mudar para o plano Grátis agora? Os limites serão aplicados imediatamente, sem estorno automático de valores já pagos.':
     'Solicitar '+plano.nome+' por '+dinheiro(plano.preco_mensal_centavos)+'/mês? Você receberá uma chave Pix e somente após a confirmação administrativa o plano será ativado. Se já existir um pedido não pago, ele será substituído.';
  UI.confirmar(gratis?'Mudar para Grátis':'Escolher plano e pagar Pix',mensagem,async()=>{
   try{
    const rpc=gratis?'mudar_para_plano_gratis':'solicitar_troca_plano';
    const args=gratis?{p_conta:A.auth.conta.id}:{p_conta:A.auth.conta.id,p_plano:plano.id};
    const r=await A.auth.client.rpc(rpc,args);
    if(r.error)throw r.error;
    avisar(gratis?'Plano Grátis ativado.':'Pedido criado. Confira a chave Pix na tela.');
    await recarregar();
   }catch(e){avisar(e.message)}
  },gratis?'Mudar agora':'Continuar para Pix');
 }));
 root.querySelector('#copiar-pix')?.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(String(info.config.pix_chave));avisar('Chave Pix copiada.');}
  catch(e){avisar('Não foi possível copiar.')}
 });
 root.querySelector('#avisar-pagamento')?.addEventListener('click',()=>UI.modal('Avisar pagamento da mensalidade','<form id="form-avisar-pagamento" class="form-grid"><label class="field">Detalhes<textarea name="mensagem" maxlength="5000" required placeholder="Informe data, valor e identificador. Não envie credenciais."></textarea></label><button class="btn" type="submit">Enviar aviso</button></form>',sheet=>{
  sheet.querySelector('form').onsubmit=async e=>{
   e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;
   try{await S.enviarFeedback('pagamento',new FormData(e.currentTarget).get('mensagem'));UI.fechar();avisar('Aviso enviado.');}
   catch(err){avisar(err.message);b.disabled=false;}
  };
 }));
}
async function carregar(){
 if(carregando)return;const id=A.auth.conta?.id;carregando=true;
 try{
  if(navigator.onLine!==false)await A.auth.atualizarConta();
  const result=await S.dadosAssinatura();
  if(id===A.auth.conta?.id){info=result;erro='';ultimaConsulta=Date.now();}
 }catch(e){if(id===A.auth.conta?.id)erro=e.message;}
 finally{carregando=false;if(id===A.auth.conta?.id)carregado=true;}
 if(location.hash==='#/assinatura'&&id===A.auth.conta?.id)A.app.refresh();
}
A.views=A.views||{};A.views.assinatura={render,bind};
})(window.AdmPro=window.AdmPro||{});
