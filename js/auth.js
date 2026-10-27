/* Supabase Auth: email/senha; PIN local é uma proteção separada. */
(function(A){
'use strict';
const cfg=A.supabaseConfig||{};
let sb=null,usuario=null,conta=null,pronto=false,booting=null,servicosMes=0;
function client(){
  if(!sb){
    if(!cfg.url||!cfg.anonKey||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url)) throw Error('Configure js/config.js para o Supabase.');
    if(!window.supabase?.createClient) throw Error('Biblioteca local js/vendor/supabase.js ausente.');
    sb=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  }
  return sb;
}
function ok(r){if(r.error)throw r.error;return r.data;}
async function atualizarConta(){
  if(!conta||navigator.onLine===false)return conta;
  const c=ok(await client().from('contas').select('*,planos(*)').eq('id',conta.id).single());
  conta=c;A.storage.guardarContaUsuario(usuario.id,c);
  const inicio=new Date();inicio.setDate(1);
  const result=await client().from('uso_diario').select('servicos_criados').eq('conta_id',c.id).gte('dia',inicio.toISOString().slice(0,10));
  servicosMes=(result.data||[]).reduce((a,x)=>a+Number(x.servicos_criados||0),0);
  return conta;
}
async function carregarConta(){
  const rel=ok(await client().from('membros').select('conta_id').eq('user_id',usuario.id).single());
  conta=ok(await client().from('contas').select('*,planos(*)').eq('id',rel.conta_id).single());
  A.storage.usarConta(conta.id);
  A.storage.guardarContaUsuario(usuario.id,conta);
  const status=await client().rpc('atualizar_minha_assinatura');
  if(status.error)console.warn('Atualização do status:',status.error.message);
  await atualizarConta();
  return conta;
}
async function boot(){
  if(booting)return booting;
  booting=(async()=>{
    try{
      const data=ok(await client().auth.getSession());
      usuario=data.session?.user||null;
      if(usuario){
        try{await carregarConta();}
        catch(e){
          const local=A.storage.contaCacheUsuario(usuario.id);
          if(!local||navigator.onLine!==false)throw e;
          conta=local;A.storage.usarConta(local.id);
        }
      }
      return !!usuario;
    }catch(e){A.erroLogin=e.message;usuario=null;conta=null;return false;}
    finally{pronto=true;booting=null;}
  })();
  return booting;
}
async function entrar(email,senha){
  const r=ok(await client().auth.signInWithPassword({email,password:senha}));
  usuario=r.user;await carregarConta();pronto=true;
  await A.storage.sincronizar();
  A.storage.registrarAcesso().catch(()=>{});
  A.storage.carregarAvisos().catch(()=>{});
  return conta;
}
async function cadastrar(nome,email,senha){
  const r=ok(await client().auth.signUp({
    email,password:senha,
    options:{emailRedirectTo:new URL('index.html',location.href).href,data:{nome_negocio:nome.trim()}}
  }));
  if(r.session&&r.user){usuario=r.user;await carregarConta();pronto=true;}
  return !!r.session;
}
async function recuperar(email){
  ok(await client().auth.resetPasswordForEmail(email,{redirectTo:new URL('index.html?modo=recuperar',location.href).href}));
}
async function redefinir(senha){ok(await client().auth.updateUser({password:senha}));}
async function sair(){
  ok(await client().auth.signOut());
  A.storage.limparCacheConta(usuario?.id);
  usuario=null;conta=null;servicosMes=0;pronto=true;
}
A.auth={get client(){return client();},get usuario(){return usuario;},get conta(){return conta;},get pronto(){return pronto;},
  get servicosMes(){return servicosMes;},boot,entrar,cadastrar,recuperar,redefinir,atualizarConta,sair};
})(window.AdmPro=window.AdmPro||{});
