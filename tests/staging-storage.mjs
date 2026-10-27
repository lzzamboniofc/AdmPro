/* Regressão de sincronização multiusuário sem dependências de runtime. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../js/storage.js',import.meta.url),'utf8');
const fakeStorage=()=>{
  const m=new Map();
  return {
    getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),
    key:i=>[...m.keys()][i]??null,get length(){return m.size;},entries:()=>[...m.entries()]
  };
};
const localStorage=fakeStorage(),sessionStorage=fakeStorage();
const internet={onLine:false},rows=new Map(),calls=[];
let clock=Date.parse('2026-10-27T10:00:00.000Z'),bloquear=false;
const conta1='00000000-0000-4000-8000-000000000001',
      conta2='00000000-0000-4000-8000-000000000002',
      usuario1='00000000-0000-4000-8000-000000000011',
      usuario2='00000000-0000-4000-8000-000000000022';
const agora=()=>new Date(++clock).toISOString();
const chave=p=>[p.p_conta,p.p_colecao,p.p_id].join(':');
const client={
  async rpc(nome,p={}){
    calls.push({nome,p});
    if(nome==='salvar_dado_otimista'){
      if(bloquear){bloquear=false;return {error:{message:'Falha temporária'},data:null}}
      const key=chave(p),antigo=rows.get(key);
      if((p.p_novo&&antigo)||(!p.p_novo&&(!antigo||!p.p_base_atualizado_em||antigo.atualizado_em!==p.p_base_atualizado_em)))
        return {error:{message:'STALE_WRITE'},data:null};
      const timestamp=agora();
      rows.set(key,{conta_id:p.p_conta,colecao:p.p_colecao,id:p.p_id,
        dados:p.p_dados,excluido:p.p_excluido,atualizado_em:timestamp});
      return {data:timestamp,error:null};
    }
    if(nome==='sincronizar_dados'){
      const all=[...rows.values()]
        .filter(x=>x.conta_id===p.p_conta&&x.atualizado_em>=p.p_cursor)
        .sort((a,b)=>a.atualizado_em.localeCompare(b.atualizado_em)||a.id.localeCompare(b.id));
      return {data:all.slice(p.p_offset,p.p_offset+p.p_limite),error:null};
    }
    return {data:null,error:null};
  }
};
const toast=[],A={
 utils:{escapar:v=>String(v),dataHora:()=>agora()},
 regras:{},ui:{modal(){},toast:t=>toast.push(t)},
 auth:{usuario:{id:usuario1},membro:{papel:'dono'},conta:{status_assinatura:'ativa',planos:{limite_clientes:2,limite_servicos_mes:30}},
   servicosMes:0,client,atualizarConta:async()=>{}},
 supabaseConfig:{versaoApp:'teste'},app:{refresh(){},aplicarConfig(){}}
};
const context={window:{AdmPro:A},localStorage,sessionStorage,navigator:internet,
 document:{getElementById:()=>null,activeElement:{tagName:'DIV'}},
 setTimeout:()=>0,clearTimeout(){},console};
vm.runInNewContext(source,context,{filename:'js/storage.js'});
const S=A.storage;

S.usarConta(conta1,usuario1);
S.adicionar('clientes',{id:'cli1',nome:'Alice'});
assert.equal(S.pendentes(),1);
assert.equal(rows.size,0);
assert.match(S.estadoSync(),/Offline/);
internet.onLine=true;
await S.sincronizar();
assert.equal(S.pendentes(),0);
assert.equal(rows.get(conta1+':clientes:cli1').dados.nome,'Alice');
assert.ok(calls.some(x=>x.nome==='salvar_dado_otimista'));
assert.ok(calls.some(x=>x.nome==='sincronizar_dados'));

S.adicionar('clientes',{id:'cli2',nome:'Bruno'});
assert.throws(()=>S.adicionar('clientes',{id:'cli3',nome:'Carla'}),/LIMITE_CLIENTES/);
bloquear=true;await S.sincronizar();
assert.equal(S.pendentes(),1,'Falha de rede não deve perder mudanças.');
await S.sincronizar();
assert.equal(S.pendentes(),0);

const base=rows.get(conta1+':clientes:cli1').atualizado_em;
rows.set(conta1+':clientes:cli1',{...rows.get(conta1+':clientes:cli1'),
 dados:{id:'cli1',nome:'Alteração em outro dispositivo'},atualizado_em:agora()});
S.atualizar('clientes','cli1',{nome:'Edição antiga'});
await S.sincronizar();
assert.equal(S.pendentes(),0,'Fila obsoleta deve ser removida.');
assert.equal(rows.get(conta1+':clientes:cli1').dados.nome,'Alteração em outro dispositivo',
 'Versão obsoleta não pode sobrescrever a alteração mais recente.');
assert.ok(toast.some(t=>/alterado em outro acesso/.test(t)));

S.gravar('config',{id:'principal',nomeNegocio:'Demo',pinHash:'NAO_ENVIAR',pinMetodo:'sha256'});
await S.sincronizar();
const cfg=rows.get(conta1+':config:principal').dados;
assert.equal(cfg.pinHash,undefined);
assert.equal(cfg.pinMetodo,undefined);

S.usarConta(conta2,usuario1);
assert.equal(S.lista('clientes').length,0,'Empresa diferente não pode herdar cache.');
S.adicionar('clientes',{id:'cli4',nome:'Outra empresa'});
await S.sincronizar();
assert.equal(rows.get(conta2+':clientes:cli4').dados.nome,'Outra empresa');

S.usarConta(conta1,usuario2);
assert.equal(S.lista('clientes').length,0,'Usuário diferente não pode herdar cache.');
await S.sincronizar();
assert.equal(S.porId('clientes','cli1').nome,'Alteração em outro dispositivo',
 'Segundo usuário deve baixar versão autorizada do backend.');

A.auth.conta.status_assinatura='bloqueada';
assert.throws(()=>S.adicionar('clientes',{id:'cli5',nome:'Teste'}),/CONTA_BLOQUEADA/);
A.auth.conta.status_assinatura='ativa';

const escopos=localStorage.entries().map(([k])=>k);
assert.ok(escopos.some(k=>k.includes(usuario1)&&k.includes(conta1)));
assert.ok(escopos.some(k=>k.includes(usuario2)&&k.includes(conta1)));
console.log('PASS: offline, RPC otimista, conflito, retentativa, empresa, usuário e PIN local.');
