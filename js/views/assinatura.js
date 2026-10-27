(function(A){
'use strict';const U=A.utils,UI=A.ui,S=A.storage;
let info=null,erro='',carregando=false,carregado=false,contaDaTela=null;
const dinheiro=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);
const data=d=>d?new Date(d.slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR'):'—';
function render(){
 if(contaDaTela!==A.auth.conta?.id){info=null;erro='';carregado=false;contaDaTela=A.auth.conta?.id;}
 if(!info)return '<div class="page-heading"><h1>Minha assinatura</h1></div><p class="muted">'+U.escapar(erro||'Carregando assinatura…')+'</p>';
 const {conta:c,plano:p,pagamentos,config,pro}=info;
 const dias=c.trial_ate?Math.max(0,Math.ceil((new Date(c.trial_ate+'T12:00:00')-new Date())/86400000)):0;
 const pix=!!config.pix_chave&&!!config.pix_nome_recebedor&&!pro?.recursos?.preco_pendente&&(pro?.preco_mensal_centavos||0)>0;
 const valor=p.nome==='Pro'?p.preco_mensal_centavos:pro?.preco_mensal_centavos;
 return '<div class="page-heading"><div><h1>Minha assinatura</h1></div><a class="btn secundario" href="#/config">Voltar</a></div>'+
 UI.card('<p><b>Plano:</b> '+U.escapar(p.nome)+'</p><p><b>Status:</b> '+U.escapar(c.status_assinatura)+'</p>'+
 (c.status_assinatura==='trial'?'<p>Seu teste termina em '+dias+' dia(s).</p>':'')+
 '<p><b>Próximo vencimento:</b> '+data(c.proximo_vencimento)+'</p>'+
 '<p><b>Limites:</b> '+(p.limite_clientes??'ilimitado')+' clientes; '+(p.limite_servicos_mes??'ilimitado')+' serviços/mês</p>')+
 UI.card('<h2>'+(p.nome==='Pro'?'Pagar mensalidade':'Assinar o Pro')+'</h2><p>Valor: <b>'+(valor==null?'A definir':dinheiro(valor))+'</b></p>'+
 (pix?'<p><b>Chave Pix:</b> <code>'+U.escapar(String(config.pix_chave))+'</code></p><p><b>Recebedor:</b> '+U.escapar(String(config.pix_nome_recebedor))+'</p><div class="actions"><button class="btn secundario" id="copiar-pix">Copiar Pix</button><button class="btn" id="avisar-pagamento">Já paguei, avisar</button></div>':'<p>Pagamento ainda indisponível: preço do Pro e chave Pix pendentes.</p>')+
 '<p class="muted">O aviso não confirma o pagamento; a equipe fará a verificação.</p>')+
 '<section class="section"><h2>Histórico de pagamentos</h2>'+
 UI.card(pagamentos.length?pagamentos.map(v=>'<p>'+U.escapar(v.referencia)+' · '+dinheiro(v.valor_centavos)+' · '+U.escapar(v.status)+' · '+data(v.pago_em||v.criado_em)+'</p>').join(''):'<p>Nenhum pagamento registrado.</p>')+'</section>';
}
function bind(root){
 if(!info){if(!carregado&&!carregando)carregar();return;}
 root.querySelector('#copiar-pix')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(String(info.config.pix_chave));UI.toast('Pix copiado.');}catch(e){UI.toast('Não foi possível copiar.');}});
 root.querySelector('#avisar-pagamento')?.addEventListener('click',()=>UI.modal('Avisar pagamento','<form id="form-avisar-pagamento" class="form-grid"><label class="field">Detalhes<textarea name="mensagem" maxlength="5000" required placeholder="Informe data, valor e identificador. Não envie credenciais."></textarea></label><button class="btn" type="submit">Enviar aviso</button></form>',sheet=>{
 sheet.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;f.querySelector('button').disabled=true;try{await S.enviarFeedback('pagamento',new FormData(f).get('mensagem'));UI.fechar();UI.toast('Aviso enviado.');}catch(err){UI.toast(err.message);f.querySelector('button').disabled=false;}};
 }));
}
async function carregar(){
 if(carregando)return;const id=A.auth.conta?.id;carregando=true;
 try{const result=await S.dadosAssinatura();if(id===A.auth.conta?.id){info=result;erro='';}}
 catch(e){if(id===A.auth.conta?.id)erro=e.message;}
 finally{carregando=false;if(id===A.auth.conta?.id)carregado=true;}
 if(location.hash==='#/assinatura'&&id===A.auth.conta?.id)A.app.refresh();
}
A.views=A.views||{};A.views.assinatura={render,bind};
})(window.AdmPro=window.AdmPro||{});
