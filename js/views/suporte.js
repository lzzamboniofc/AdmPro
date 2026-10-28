(function(A){
'use strict';const U=A.utils,UI=A.ui,S=A.storage;
let mensagens=[],erro='',carregando=false,carregado=false,contaDaTela=null;
function render(){
 if(contaDaTela!==A.auth.conta?.id){mensagens=[];erro='';carregado=false;contaDaTela=A.auth.conta?.id;}
 return '<div class="page-heading"><div><h1>Ajuda e suporte</h1><p class="muted">Envie mensagens e consulte respostas.</p></div><a href="#/config" class="btn secundario">Voltar</a></div>'+
 UI.card('<div class="suporte-ajuda"><div><strong>Consulte o Manual do AdmPro</strong><p class="muted">Veja orientações passo a passo para as principais tarefas.</p></div><a class="btn secundario" href="#/tutoriais">Abrir tutoriais</a></div>')+
 UI.card('<form class="form-grid" id="form-feedback"><label class="field">Assunto<select name="tipo"><option value="duvida">Dúvida</option><option value="problema">Problema</option><option value="sugestao">Sugestão</option></select></label><label class="field">Mensagem<textarea name="mensagem" required minlength="5" maxlength="5000"></textarea></label><button class="btn" type="submit">Enviar</button></form>')+
 '<section class="section"><h2>Minhas solicitações</h2>'+(erro?'<p>'+U.escapar(erro)+'</p>':'')+
 (mensagens.map(m=>UI.card('<p><strong>'+U.escapar(m.tipo)+'</strong> · '+U.escapar(m.status)+'</p><p>'+U.escapar(m.mensagem)+'</p>'+(m.resposta?'<div class="resposta-suporte"><strong>Resposta:</strong> '+U.escapar(m.resposta)+'</div>':''))).join('')||'<p>Nenhuma solicitação.</p>')+'</section>';
}
function bind(root){
 root.querySelector('#form-feedback').onsubmit=async e=>{
   e.preventDefault();const f=e.currentTarget,d=new FormData(f),botao=f.querySelector('button[type="submit"]');
   botao.disabled=true;try{await S.enviarFeedback(d.get('tipo'),d.get('mensagem'));f.reset();carregado=false;UI.toast('Enviado.');await carregar();}
   catch(err){UI.toast(err.message);}finally{botao.disabled=false;}
 };
 if(!carregando&&!carregado)carregar();
}
async function carregar(){
 if(carregando)return;const id=A.auth.conta?.id;carregando=true;
 try{const r=await S.listarFeedbacks();if(id===A.auth.conta?.id){mensagens=r;erro='';}}
 catch(e){if(id===A.auth.conta?.id)erro=e.message;}
 finally{carregando=false;if(id===A.auth.conta?.id)carregado=true;}
 if(location.hash==='#/suporte'&&id===A.auth.conta?.id)A.app.refresh();
}
A.views=A.views||{};A.views.suporte={render,bind};
})(window.AdmPro=window.AdmPro||{});
