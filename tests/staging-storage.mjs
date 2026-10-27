/* Testes sem dependências de produção, exercitam o storage.js real da branch. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../js/storage.js',import.meta.url),'utf8');
function storage(){
 const m=new Map();
 return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),
  get length(){return m.size;},key:i=>[...m.keys()][i]};
}
const localStorage=storage(),sessionStorage=storage();
const backend=new Map(),internet={onLine:false};
let uploads=0,erroProximo=false;
const client={from(t){
 assert.equal(t,'dados');
 return {
  upsert:async r=>{
   uploads++;
   if(erroProximo){erroProximo=false;return {error:{message:'Falha temporária'}};}
   backend.set(r.conta_id+':'+r.colecao+':'+r.id,{...r});return {error:null};
  },
  select(){return this;},eq(k,v){this.conta=v;return this;},gte(k,v){this.cursor=v;return this;},
  order(){return this;},range(){return Promise.resolve({data:[...backend.values()]
   .filter(x=>x.conta_id===this.conta&&x.atualizado_em>=this.cursor),error:null});}
 };
},rpc:async()=>({error:null})};
const A={utils:{escapar:v=>String(v),dataHora:()=>new Date().toISOString()},regras:{},ui:{modal(){},toast(){}},
 auth:{usuario:{id:'test'},conta:{status_assinatura:'ativa',planos:{limite_clientes:1,limite_servicos_mes:40}},
 servicosMes:0,client,atualizarConta:async()=>{}},supabaseConfig:{versaoApp:'test'},
 app:{refresh(){},aplicarConfig(){}}};
vm.runInNewContext(code,{window:{AdmPro:A},localStorage,sessionStorage,navigator:internet,
 document:{getElementById:()=>null,activeElement:{tagName:'DIV'}},setTimeout:()=>0,clearTimeout(){},console},
 {filename:'js/storage.js'});
const S=A.storage,c1='00000000-0000-4000-8000-000000000001',c2='00000000-0000-4000-8000-000000000002';
S.usarConta(c1);
S.adicionar('clientes',{id:'cli1',nome:'Alice'});
assert.equal(S.pendentes(),1);
assert.equal(uploads,0);
assert.match(S.estadoSync(),/Offline/);
assert.throws(()=>S.adicionar('clientes',{id:'cli2'}),/LIMITE_CLIENTES/);
internet.onLine=true;await S.sincronizar();
assert.equal(S.pendentes(),0);
assert.equal(backend.get(c1+':clientes:cli1').dados.nome,'Alice');
S.usarConta(c2);assert.equal(S.lista('clientes').length,0);
A.auth.conta.status_assinatura='bloqueada';
assert.throws(()=>S.adicionar('clientes',{id:'cli3'}),/CONTA_BLOQUEADA/);
A.auth.conta.status_assinatura='ativa';
S.adicionar('clientes',{id:'cli3'});
erroProximo=true;await S.sincronizar();
assert.equal(S.pendentes(),1,'Falha de rede não pode perder alterações.');
await S.sincronizar();assert.equal(S.pendentes(),0);
S.excluir('clientes','cli3');await S.sincronizar();
assert.equal(backend.get(c2+':clientes:cli3').excluido,true);
S.gravar('config',{id:'principal',nomeNegocio:'Demo',pinHash:'NAO_ENVIAR',pinMetodo:'sha256'});
await S.sincronizar();
const dados=backend.get(c2+':config:principal').dados;
assert.equal(dados.pinHash,undefined,'Hash de PIN é somente local.');
assert.equal(dados.pinMetodo,undefined);
console.log('PASS: fila offline/online, persistência após falha, isolamento, limite, bloqueio, tombstone e PIN local.');
