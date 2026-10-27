/* Seleção de empresa e aceite de convites. */
(function(A){
'use strict';
const U=A.utils,UI=A.ui;
function render(){
  const contas=A.auth.contas||[],convites=A.auth.convites||[],atual=A.auth.conta?.id;
  return '<div class="page-heading"><div><h1>Empresas</h1><p class="muted">Escolha em qual empresa deseja trabalhar.</p></div></div>'+
    UI.card('<div class="stack">'+(contas.length?contas.map(c=>'<button type="button" class="empresa-card '+(c.id===atual?'ativo':'')+'" data-empresa="'+U.escapar(c.id)+'"><span><strong>'+U.escapar(c.nome_negocio)+'</strong><small>'+U.escapar(c.modelo_negocio||'Empresa')+'</small></span><span>'+(c.id===atual?'Em uso':'Acessar')+'</span></button>').join(''):'<p class="muted">Nenhuma empresa vinculada.</p>')+'</div>')+
    (convites.length?'<section class="section"><h2>Convites pendentes</h2>'+UI.card('<div class="stack">'+convites.map(i=>'<div class="list-card"><div class="grow"><h3>'+U.escapar(i.nome_negocio)+'</h3><p class="item-meta">Perfil: '+U.escapar(i.papel)+' · válido até '+new Date(i.expira_em).toLocaleDateString('pt-BR')+'</p></div><button type="button" class="btn compacto" data-aceitar="'+U.escapar(i.id)+'">Aceitar</button></div>').join('')+'</div>')+'</section>':'');
}
function bind(root){
  root.querySelectorAll('[data-empresa]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await A.auth.selecionarConta(b.dataset.empresa);A.app.aplicarConfig();A.app.ir('#/inicio');}catch(e){UI.toast(e.message);b.disabled=false}});
  root.querySelectorAll('[data-aceitar]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await A.auth.aceitarConvite(b.dataset.aceitar);UI.toast('Convite aceito.');A.app.refresh();}catch(e){UI.toast(e.message);b.disabled=false}});
}
A.views=A.views||{};A.views.empresas={render,bind};
})(window.AdmPro=window.AdmPro||{});
