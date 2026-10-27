/* Supabase Auth multiempresa; PIN local continua sendo uma proteção separada. */
(function(A){
'use strict';
const cfg=A.supabaseConfig||{};
let sb=null,usuario=null,conta=null,membro=null,vinculos=[],permissoes={},convites=[],pronto=false,booting=null,servicosMes=0;
function client(){
  if(!sb){
    if(!cfg.url||!cfg.anonKey||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url))throw Error('Configure js/config.js para o Supabase.');
    if(!window.supabase?.createClient)throw Error('Biblioteca local js/vendor/supabase.js ausente.');
    sb=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  }
  return sb;
}
function ok(r){if(r.error)throw r.error;return r.data;}
async function carregarVinculos(){
  const rel=ok(await client().from('membros').select('conta_id,papel,profissional_id,permissoes,ativo,criado_em').eq('user_id',usuario.id).eq('ativo',true));
  const ids=(rel||[]).map(x=>x.conta_id);
  let contas=[];
  if(ids.length)contas=ok(await client().from('contas').select('*,planos(*)').in('id',ids));
  const mapa=new Map((contas||[]).map(c=>[c.id,c]));
  vinculos=(rel||[]).map(v=>({...v,conta:mapa.get(v.conta_id)})).filter(v=>v.conta);
  A.storage.guardarVinculosUsuario(usuario.id,vinculos);
  return vinculos;
}
async function carregarConvites(){
  if(!usuario||navigator.onLine===false)return convites;
  const r=await client().rpc('meus_convites_pendentes');
  if(!r.error)convites=r.data||[];
  return convites;
}
async function aceitarConviteDaUrl(){
  const id=new URLSearchParams(location.search).get('convite');
  if(!id||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))return false;
  const r=await client().rpc('aceitar_convite',{p_convite:id});
  if(r.error)throw r.error;
  const url=new URL(location.href);url.searchParams.delete('convite');history.replaceState({},'',url.pathname+(url.search||'')+(url.hash||''));
  await carregarVinculos();await carregarConvites();
  return true;
}
async function atualizarConta(){
  if(!conta||navigator.onLine===false)return conta;
  const c=ok(await client().from('contas').select('*,planos(*)').eq('id',conta.id).single());
  conta=c;
  const i=vinculos.findIndex(v=>v.conta_id===c.id);if(i>=0)vinculos[i]={...vinculos[i],conta:c};
  A.storage.guardarContaUsuario(usuario.id,c);A.storage.guardarVinculosUsuario(usuario.id,vinculos);
  const inicio=new Date();inicio.setDate(1);
  const result=await client().from('uso_diario').select('servicos_criados').eq('conta_id',c.id).gte('dia',inicio.toISOString().slice(0,10));
  servicosMes=result.error?0:(result.data||[]).reduce((a,x)=>a+Number(x.servicos_criados||0),0);
  return conta;
}
async function selecionarConta(id,{sincronizar=true}={}){
  const v=vinculos.find(x=>x.conta_id===id&&x.ativo!==false);
  if(!v)throw Error('Empresa não autorizada.');
  conta=v.conta;membro=v;permissoes={};
  A.storage.usarConta(conta.id,usuario.id,membro.papel==='dono');
  A.storage.definirContaPreferida(usuario.id,conta.id);
  if(navigator.onLine!==false){
    const rp=await client().rpc('permissoes_membro',{p_conta:conta.id});
    if(rp.error)throw rp.error;permissoes=rp.data||{};
    v.permissoes_efetivas=permissoes;A.storage.guardarVinculosUsuario(usuario.id,vinculos);
    A.storage.aplicarEscopo(permissoes,membro);
    const status=await client().rpc('atualizar_minha_assinatura',{p_conta:conta.id});
    if(status.error)console.warn('Atualização do status:',status.error.message);
    await atualizarConta();
  }
  if(sincronizar&&navigator.onLine!==false)await A.storage.sincronizar();
  return conta;
}
async function carregarConta(){
  if(navigator.onLine===false){
    vinculos=A.storage.vinculosCacheUsuario(usuario.id)||[];
  }else{
    await carregarVinculos();
    await aceitarConviteDaUrl();
    await carregarConvites();
  }
  if(!vinculos.length){conta=null;membro=null;permissoes={};return null;}
  const preferida=A.storage.contaPreferida(usuario.id);
  const alvo=vinculos.some(v=>v.conta_id===preferida)?preferida:vinculos[0].conta_id;
  return selecionarConta(alvo,{sincronizar:false});
}
async function boot(){
  if(booting)return booting;
  booting=(async()=>{
    try{
      const data=ok(await client().auth.getSession());usuario=data.session?.user||null;
      if(usuario){
        try{await carregarConta();}
        catch(e){
          const local=A.storage.contaCacheUsuario(usuario.id),cache=A.storage.vinculosCacheUsuario(usuario.id)||[];
          if(navigator.onLine!==false||(!local&&!cache.length))throw e;
          vinculos=cache;
          const v=cache.find(x=>x.conta_id===local?.id)||cache[0];
          if(v){conta=v.conta||local;membro=v;permissoes=v.permissoes_efetivas||{};A.storage.usarConta(conta.id,usuario.id,membro.papel==='dono');}
        }
      }
      return !!usuario;
    }catch(e){A.erroLogin=e.message;usuario=null;conta=null;membro=null;vinculos=[];permissoes={};return false;}
    finally{pronto=true;booting=null;}
  })();
  return booting;
}
async function entrar(email,senha){
  const r=ok(await client().auth.signInWithPassword({email,password:senha}));
  usuario=r.user;await carregarConta();pronto=true;
  if(conta){await A.storage.sincronizar();A.storage.registrarAcesso().catch(()=>{});A.storage.carregarAvisos().catch(()=>{});}
  return conta;
}
async function cadastrar(nome,email,senha){
  const redir=new URL('index.html',location.href),convite=new URLSearchParams(location.search).get('convite');
  if(convite)redir.searchParams.set('convite',convite);
  const r=ok(await client().auth.signUp({email,password:senha,options:{emailRedirectTo:redir.href,data:{nome_negocio:nome.trim()}}}));
  if(r.session&&r.user){usuario=r.user;await carregarConta();pronto=true;}
  return !!r.session;
}
async function aceitarConvite(id){
  const contaId=ok(await client().rpc('aceitar_convite',{p_convite:id}));
  await carregarVinculos();await carregarConvites();
  const v=vinculos.find(x=>x.conta_id===contaId);
  if(v)await selecionarConta(v.conta_id);
  return contaId;
}
async function trocarEmpresa(id){if(conta?.id===id)return conta;await A.storage.sincronizar().catch(()=>{});return selecionarConta(id);}
async function recuperar(email){ok(await client().auth.resetPasswordForEmail(email,{redirectTo:new URL('index.html?modo=recuperar',location.href).href}));}
async function redefinir(senha){ok(await client().auth.updateUser({password:senha}));}
async function sair(){
  const uid=usuario?.id;ok(await client().auth.signOut());A.storage.limparCacheConta(uid);
  usuario=null;conta=null;membro=null;vinculos=[];permissoes={};convites=[];servicosMes=0;pronto=true;
}
A.auth={
 get client(){return client();},get usuario(){return usuario;},get conta(){return conta;},get membro(){return membro;},
 get vinculos(){return vinculos;},get contas(){return vinculos.map(v=>v.conta).filter(Boolean);},get permissoes(){return permissoes;},
 get convites(){return convites;},get pronto(){return pronto;},get servicosMes(){return servicosMes;},
 boot,entrar,cadastrar,recuperar,redefinir,atualizarConta,selecionarConta:trocarEmpresa,aceitarConvite,carregarConvites,sair
};
})(window.AdmPro=window.AdmPro||{});
