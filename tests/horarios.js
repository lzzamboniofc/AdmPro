/* Regressão de horários e perfis genéricos — node --test tests/horarios.js */
'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), vm=require('node:vm'), fs=require('node:fs'),path=require('node:path');
const raiz=path.resolve(__dirname,'..');
const contexto={window:{},Intl,Date,crypto:globalThis.crypto};
vm.createContext(contexto);
for(const nome of ['js/utils.js','js/regras.js','js/modelos.js'])
    vm.runInContext(fs.readFileSync(path.join(raiz,nome),'utf8'),contexto,{filename:nome});
const A=contexto.window.AdmPro,R=A.regras;
test('config antiga mantém dias e horários sem exclusão',()=>{
    const d=R.horariosSemana({horaInicio:'08:30',horaFim:'17:30',diasAtendimento:[1,3,5]});
    assert.equal(d.length,7);assert.equal(d[0].ativo,false);assert.equal(d[3].ativo,true);
    assert.equal(d[3].turnos[0].inicio,'08:30');assert.equal(d[3].turnos.length,1);
});
test('dois períodos respeitam almoço e dias fechados',()=>{
    const config={horariosSemana:Array.from({length:7},(_,i)=>({ativo:i===1,turnos:i===1?[{inicio:'08:00',fim:'12:00'},{inicio:'13:00',fim:'18:00'}]:[]}))};
    assert.equal(R.horarioDisponivel(config,'2026-10-26','11:00',60),true);
    assert.equal(R.horarioDisponivel(config,'2026-10-26','11:30',60),false);
    assert.equal(R.horarioDisponivel(config,'2026-10-26','13:00',45),true);
    assert.equal(R.horarioDisponivel(config,'2026-10-27','09:00',30),false);
});
test('todos os oito modelos usam rótulos compartilhados por perfil',()=>{
    assert.equal(Object.keys(A.modelos).length,8);
    for(const m of Object.values(A.modelos)) {
      assert.equal(m.rotulo,m.tipoNegocio==='rapido'?'Atendimento':'Serviço');
      assert.equal(m.plural,m.tipoNegocio==='rapido'?'Atendimentos':'Serviços');
      assert.ok(m.catalogo.length>0);
    }
});
