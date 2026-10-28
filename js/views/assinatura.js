(function(A){
'use strict';
const U=A.utils,UI=A.ui,S=A.storage;
let info=null,erro='',carregando=false,carregado=false,contaDaTela=null,ultimaConsulta=0;
const dinheiro=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(c)||0)/100);
const data=d=>d?new Date(d.slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR'):'—';
const nomes={trial:'Em teste',ativa:'Ativa',atrasada:'Pagamento em atraso',bloqueada:'Temporariamente bloqueada',cancelada:'Cancelada'};
function render(){
 const cAtual=A.auth.conta;
 if(contaDaTela!==cAtual?.id || (info&&info.conta.plano_id!==cAtual?.plano_id)){
  info=null;erro='';carregado=false;contaDaTela=cAtual?.id;ultimaConsulta=0;
 }
 if(info&&Date.now()-ultimaConsulta>60000){info=null;carregado=false;}
 if(!info)return '<div class="page-heading"><h1>Minha assinatura</h1></div><p class="muted">'+U.escapar(erro||'Carregando sua assinatura…')+'</p>';
 const {conta:c,plano:p,pagamentos,config,planos}=info;
 const dias=c.trial_ate?Math.max(0,Math.ceil((new Date(c.trial_ate+'T12:00:00')-new Date())/86400000)):0;
 const contratado=c.preco_acordado_centavos==null?p.preco_mensal_centavos:c.preco_acordado_centavos;
 const pago=Number(contratado||0)>0;
 const pix=pago&&!!config.pix_chave&&!!config.pix_nome_recebedor;
 const cards=(planos||[]).map(v=>{
   const atual=v.id===p.id;
   return '<div class="plano-assinatura-card'+(atual?' atual':'')+'"><div class="plano-assinatura-cabecalho"><strong>'+U.escapar(v.nome)+'</strong>'+(atual?'<span class="plano-assinatura-atual">Seu plano</span>':'')+'</div>'+
   '<p class="plano-assinatura-preco">'+dinheiro(v.preco_mensal_centavos)+'<small>/mês</small></p>'+
   '<p>'+ (v.limite_clientes??'Clientes ilimitados')+(v.limite_clientes!=null?' clientes':'')+' · '+(v.limite_servicos_mes??'Serviços ilimitados')+(v.limite_servicos_mes!=null?' serviços/mês':'')+'</p>'+
   (atual?'':(c.status_assinatura==='bloqueada'?'<small>Regularize sua assinatura para alterar o plano.</small>':'<button type="button" class="btn secundario" data-solicitar-plano="'+U.escapar(v.id)+'">Solicitar alteração</button>'))+'</div>';
 }).join('');
 return '<div class="page-heading"><div><h1>Minha assinatura</h1><p class="muted">Consulte seu plano, os vencimentos e as opções disponíveis.</p></div><a class="btn secundario" href="#/config">Voltar</a></div>'+
 UI.card('<p><b>Plano atual:</b> '+U.escapar(p.nome)+'</p><p><b>Situação:</b> '+U.escapar(nomes[c.status_assinatura]||c.status_assinatura)+'</p>'+
 '<p><b>Mensalidade contratada:</b> '+dinheiro(contratado)+'</p>'+
 (c.status_assinatura==='trial'?'<p>Seu teste termina em '+dias+' dia(s). Após o teste, o acesso passa ao plano Grátis, a menos que você contrate outro plano.</p>':'')+
 '<p><b>Próximo vencimento:</b> '+data(c.proximo_vencimento)+'</p>'+
 '<p><b>Limites:</b> '+(p.limite_clientes??'Ilimitados')+' clientes · '+(p.limite_servicos_mes??'Ilimitados')+' serviços/mês</p>')+
 '<section class="section"><h2>Conheça os planos</h2><div class="planos-assinatura-grade">'+cards+'</div><p class="muted">Alterações solicitadas são analisadas pela equipe do AdmPro e não ativam automaticamente cobranças.</p></section>'+
 UI.card('<h2>Pagamento da assinatura</h2>'+
 (pago?'<p>Valor contratado: <b>'+dinheiro(contratado)+'</b></p>':'<p>Você não possui mensalidade contratada para este plano.</p>')+
 (pix?'<p><b>Chave Pix:</b> <code>'+U.escapar(String(config.pix_chave))+'</code></p><p><b>Recebedor:</b> '+U.escapar(String(config.pix_nome_recebedor))+'</p><div class="actions"><button class="btn secundario" id="copiar-pix">Copiar Pix</button><button class="btn" id="avisar-pagamento">Já paguei, avisar</button></div>':
  (pago?'<p class="muted">Consulte o suporte para obter os dados de pagamento.</p>':''))+
 '<p class="muted">A confirmação é feita pela equipe. Avisar um pagamento não ativa a assinatura automaticamente.</p>')+
 '<section class="section"><h2>Histórico de pagamentos</h2>'+
 UI.card(pagamentos.length?pagamentos.map(v=>'<p>'+U.escapar(v.referencia)+' · '+dinheiro(v.valor_centavos)+' · '+U.escapar(v.status)+' · '+data(v.pago_em||v.criado_em)+'</p>').join(''):'<p>Nenhum pagamento registrado.</p>')+'</section>';
}
function bind(root){
 if(!info){if(!carregado&&!carregando)carregar();return;}
 root.querySelector('#copiar-pix')?.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(String(info.config.pix_chave));UI.toast('Pix copiado.');}
  catch(e){UI.toast('Não foi possível copiar.');}
 });
 root.querySelectorAll('[data-solicitar-plano]').forEach(b=>b.addEventListener('click',()=>{
  const plano=(info.planos||[]).find(p=>p.id===b.dataset.solicitarPlano);if(!plano)return;
  UI.confirmar('Solicitar alteração', 'Enviar pedido para alterar sua assinatura para '+plano.nome+'? A equipe confirmará as condições antes de ativar.',async()=>{
   try{await S.enviarFeedback('duvida','Solicito alteração da minha assinatura para o plano '+plano.nome+' ('+dinheiro(plano.preco_mensal_centavos)+'/mês).');
    UI.toast('Solicitação enviada ao suporte do AdmPro.');}
   catch(e){UI.toast(e.message);}
  },'Solicitar');
 }));
 root.querySelector('#avisar-pagamento')?.addEventListener('click',()=>UI.modal('Avisar pagamento','<form id="form-avisar-pagamento" class="form-grid"><label class="field">Detalhes<textarea name="mensagem" maxlength="5000" required placeholder="Informe data, valor e identificador. Não envie credenciais."></textarea></label><button class="btn" type="submit">Enviar aviso</button></form>',sheet=>{
  sheet.querySelector('form').onsubmit=async e=>{
   e.preventDefault();const f=e.currentTarget;f.querySelector('button').disabled=true;
   try{await S.enviarFeedback('pagamento',new FormData(f).get('mensagem'));UI.fechar();UI.toast('Aviso enviado.');}
   catch(err){UI.toast(err.message);f.querySelector('button').disabled=false;}
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
