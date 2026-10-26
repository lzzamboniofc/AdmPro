/* Regressões sem bibliotecas: node --test tests/regressao.js */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const config={nomeNegocio:'Teste',tipoNegocio:'rapido',telefone:'11988887777',
horaInicio:'09:00',horaFim:'18:00',diasAtendimento:[1,2,3,4,5],tema:'claro',versaoDados:2};
function ambiente(inicial={}) {
 const dados=new Map(Object.entries(inicial)),sessao=new Map(),avisos=[];
 const storage=m=>({getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)});
 const ctx={window:{},localStorage:storage(dados),sessionStorage:storage(sessao),
 console:{...console,warn:m=>avisos.push(m)},Date,Intl,Math,TextEncoder};
 ctx.globalThis=ctx;vm.createContext(ctx);
 for(const f of ['utils','regras','modelos','storage']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',f+'.js'),'utf8'),ctx);
 }
 return {S:ctx.window.AdmPro.storage,U:ctx.window.AdmPro.utils,R:ctx.window.AdmPro.regras,dados,avisos};
}
function base() {
 const a=ambiente();a.S.gravar('config',config);
 a.S.gravar('clientes',[{id:'cl',nome:'Ana',telefone:'11988887777'}]);
 a.S.gravar('catalogo',[{id:'c',nome:'Item',preco:12,categoria:'produto',ativo:true}]);
 a.S.gravar('servicos',[]);a.S.gravar('lancamentos',[]);a.S.migrarDados();return a;
}
test('armazenamento vazio e dinheiro brasileiro',()=>{
 const {S,U}=ambiente();assert.equal(S.obter('config'),null);
 assert.equal(S.lista('clientes').length,0);assert.equal(U.lerMoeda('1.234,56'),1234.56);
});
test('valores por extenso',()=>{
 const {U}=ambiente();
 for(const [v,s] of [[.5,'cinquenta centavos'],[1,'um real'],[1234.56,'mil duzentos e trinta e quatro reais e cinquenta e seis centavos'],[1000000,'um milhão de reais']])
 assert.equal(U.valorPorExtenso(v),s);
});
test('fim de mês e ano bissexto',()=>{
 const {R}=ambiente(),rec={ativa:true,intervalo:1,unidade:'meses'};
 assert.equal(R.proximaData('2024-01-31',rec),'2024-02-29');
 assert.equal(R.proximaData('2025-01-31',rec),'2025-02-28');
});
test('migração v2->v3 preserva dados',()=>{
 const {S}=base();assert.equal(S.obter('config').versaoDados,3);
 assert.equal(S.porId('clientes','cl').nome,'Ana');
 assert.equal(S.porId('catalogo','c').qtdEstoque,0);
});
test('JSON inválido não é sobrescrito por migração',()=>{
 const {S,dados,avisos}=ambiente({admpro_config:JSON.stringify(config),admpro_catalogo:'{invalido'});
 S.migrarDados();assert.equal(dados.get('admpro_catalogo'),'{invalido');
 assert.equal(S.obter('config').versaoDados,2);assert.equal(avisos.length,1);
});
test('estoque e recorrência sem duplicação',()=>{
 const {S}=base();S.atualizar('catalogo','c',{controlaEstoque:true,qtdEstoque:10});
 S.adicionar('servicos',{id:'s',clienteId:'cl',titulo:'Atendimento',
 itens:[{catalogoId:'c',nome:'Item',qtd:2,precoUnit:12}],total:24,
 status:'agendado',data:'2026-10-25',hora:'10:00',etapas:[],historico:[],
 estoqueBaixado:false,recorrencia:{ativa:true,intervalo:1,unidade:'meses'},
 parcelas:[{id:'p',valor:24,vencimento:'2026-10-25',pago:false}]});
 S.atualizar('servicos','s',{status:'concluido'});
 assert.equal(S.porId('catalogo','c').qtdEstoque,8);assert.equal(S.lista('servicos').length,2);
 S.atualizar('servicos','s',{status:'concluido'});assert.equal(S.lista('servicos').length,2);
 S.atualizar('servicos','s',{status:'andamento'});assert.equal(S.porId('catalogo','c').qtdEstoque,10);
});
test('receber duas vezes não duplica; estornar remove',()=>{
 const {S}=base();S.adicionar('servicos',{id:'s',clienteId:'cl',titulo:'Serviço',itens:[],
 total:100,status:'concluido',data:'2026-10-20',hora:'09:00',
 etapas:[],historico:[],parcelas:[{id:'p',valor:100,vencimento:'2026-10-20',pago:false}]});
 assert.equal(S.registrarPagamento('s',['p'],'2026-10-26','pix'),true);
 assert.equal(S.registrarPagamento('s',['p'],'2026-10-26','pix'),false);
 assert.equal(S.lista('lancamentos').length,1);S.estornarPagamento('s','p');
 assert.equal(S.lista('lancamentos').length,0);assert.equal(S.porId('servicos','s').status,'concluido');
});
test('despesas fixas idempotentes',()=>{
 const {S}=base();S.adicionar('despesasFixas',{id:'d',descricao:'Aluguel',valor:300,
 diaVencimento:10,categoria:'aluguel',ativa:true,criadaEm:'2026-10-01'});
 for(let i=0;i<5;i++)S.gerarDespesasFixas('2026-10');
 assert.equal(S.lista('lancamentos').filter(l=>l.despesaFixaId==='d').length,1);
});
test('backup e restauração preservam coleções',()=>{
 const {S}=base(),b=S.exportar();S.limpar();S.importar(b);
 assert.equal(S.obter('config').versaoDados,3);assert.equal(S.porId('clientes','cl').nome,'Ana');
});
test('restauração limpa sinalização de corrupção',()=>{
 const {S}=base(),b=S.exportar(),outro=ambiente({admpro_catalogo:'?!'});
 outro.S.lista('catalogo');assert.ok(outro.S.problemas.has('catalogo'));
 outro.S.importar(b);assert.equal(outro.S.problemas.size,0);
 assert.equal(outro.S.porId('catalogo','c').nome,'Item');
});
