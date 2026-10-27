(function(A){
'use strict';
const U=A.utils,UI=A.ui;
let pagina='entrar',mensagem='';
const campo=(rotulo,nome,tipo='text',extra='')=>'<label class="field"><span>'+rotulo+'</span><input name="'+nome+'" type="'+tipo+'" '+extra+' required></label>';
function render(){
  const cadastro=pagina==='cadastro',esqueci=pagina==='esqueci',nova=pagina==='nova';
  return '<section class="tela-seguranca auth-page"><img class="marca-vertical" src="img/logo/svg/logo-vertical.svg" alt="AdmPro" width="145" height="145"><h1>'+
    (nova?'Redefinir senha':cadastro?'Criar conta':esqueci?'Recuperar senha':'Entrar no AdmPro')+'</h1>'+
    UI.card('<form id="form-auth" class="form-grid">'+
      (cadastro?campo('Nome do negócio','nome','text','autocomplete="organization" maxlength="150"'):'')+
      (nova?'':campo('E-mail','email','email','autocomplete="email"'))+
      (esqueci?'':campo('Senha','senha','password','minlength="8" autocomplete="'+(cadastro||nova?'new-password':'current-password')+'"'))+
      (cadastro?'<label class="auth-aceite"><input type="checkbox" name="aceite" required> Li e aceito os <a href="termos.html" target="_blank" rel="noopener">Termos de uso</a> e a <a href="privacidade.html" target="_blank" rel="noopener">Política de privacidade</a>.</label>':'')+
      '<p id="auth-erro" class="pin-erro" role="alert">'+U.escapar(mensagem||A.erroLogin||'')+'</p><button class="btn" type="submit">'+
      (nova?'Atualizar senha':cadastro?'Cadastrar':esqueci?'Enviar link':'Entrar')+'</button></form>'+
      '<div class="auth-links"><button type="button" data-auth="entrar">Entrar</button><button type="button" data-auth="cadastro">Criar conta</button><button type="button" data-auth="esqueci">Esqueci a senha</button></div>')+'</section>';
}
function bind(root){
  root.querySelectorAll('[data-auth]').forEach(btn=>btn.onclick=()=>{
    if(location.search.includes('modo='))history.replaceState({},'',location.pathname+location.hash);
    pagina=btn.dataset.auth;mensagem='';A.app.refresh();
  });
  const f=root.querySelector('#form-auth');
  f.onsubmit=async e=>{
    e.preventDefault();const d=new FormData(f),botao=f.querySelector('button[type="submit"]'),erro=f.querySelector('#auth-erro');
    botao.disabled=true;erro.textContent='';
    try{
      if(pagina==='cadastro'){
        if(!d.get('aceite'))throw Error('Aceite os Termos e a Política de privacidade.');
        const ativo=await A.auth.cadastrar(d.get('nome'),d.get('email'),d.get('senha'));
        if(!ativo){pagina='entrar';mensagem='Cadastro criado. Verifique seu e-mail para confirmar a conta.';A.app.refresh();return;}
      } else if(pagina==='esqueci'){
        await A.auth.recuperar(d.get('email'));pagina='entrar';mensagem='Se o e-mail existir, enviaremos um link.';A.app.refresh();return;
      } else if(pagina==='nova'){
        await A.auth.redefinir(d.get('senha'));await A.auth.sair();
        history.replaceState({},'',location.pathname+'#/inicio');pagina='entrar';mensagem='Senha atualizada. Faça login novamente.';A.app.refresh();return;
      } else await A.auth.entrar(d.get('email'),d.get('senha'));
      A.app.iniciar();
    }catch(err){erro.textContent=err.message||'Erro no login.';botao.disabled=false;}
  };
}
function abrirRecuperacao(){pagina='nova';mensagem='';A.app.refresh();}
A.views=A.views||{};A.views.autenticacao={render,bind,abrirRecuperacao};
})(window.AdmPro=window.AdmPro||{});
