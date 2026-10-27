/* Agenda diária/semanal multiprofissional, com jornada individual. */
(function(A){
'use strict';
const U=A.utils,UI=A.ui,S=A.storage;
let dia=U.hoje(),visao='dia',profissional='';
const ativos=()=>S.lista('profissionais').filter(p=>p.ativo!==false);
function profissionalEfetivo(){
 const proprio=A.auth.membro?.profissional_id;
 if(A.permissoes.pode('agenda.propria')&&!A.permissoes.pode('agenda.ver_todas'))return proprio||'__sem_vinculo__';
 return profissional;
}
function compromissos(data,pid=profissionalEfetivo()){
 return S.lista('servicos').filter(s=>s.data===data&&s.status!=='cancelado'&&s.hora&&(!pid||s.profissionalId===pid)).sort((a,b)=>a.hora.localeCompare(b.hora));
}
function card(s){
 const p=s.profissionalId?S.porId('profissionais',s.profissionalId):null;
 return '<div class="agenda-envoltorio"><button type="button" class="agenda-item" data-abrir="'+U.escapar(s.id)+'" '+(p?.cor?'style="border-left-color:'+U.escapar(p.cor)+'"':'')+'><strong>'+U.escapar(s.hora)+' · '+U.escapar(S.porId('clientes',s.clienteId)?.nome||'Cliente')+'</strong><span>'+U.escapar(s.titulo)+'</span>'+(!profissionalEfetivo()&&p?'<small>'+U.escapar(p.nome)+'</small>':'')+UI.chip(s.status)+(s.lembreteEnviadoEm?'<small class="badge-sutil">Lembrete enviado ✓</small>':'')+(s.recorrencia?.ativa?'<small class="badge-sutil">↻ Recorrente</small>':'')+'</button>'+(s.status==='agendado'&&s.data>=U.hoje()?'<button class="btn secundario compacto" data-lembrete="'+U.escapar(s.id)+'" aria-label="Enviar lembrete por WhatsApp">'+UI.icon('sino',true)+' Enviar lembrete</button>':'')+'</div>';
}
function escala(data,pid){
 const p=pid?S.porId('profissionais',pid):null,base=p?.horariosSemana?.length===7?p:S.obter('config');
 return A.regras.horariosSemana(base)[U.parseData(data).getDay()];
}
function bloqueado(pid,data,hora,dur=30){
 const p=pid?S.porId('profissionais',pid):null;if(!p)return false;
 const ini=U.horaMinutos(hora),fim=ini+dur;
 return (p.ausencias||[]).some(a=>{const di=a.dataInicio||a.data,df=a.dataFim||a.data||di;return di&&data>=di&&data<=df&&ini<U.horaMinutos(a.fim||'23:59')&&U.horaMinutos(a.inicio||'00:00')<fim});
}
const turnoLabel=t=>t.map(x=>x.inicio+'–'+x.fim).join(' · ');
function telaIndividual(pid){
 const ag=escala(dia,pid),agendados=compromissos(dia,pid),slots=[];
 if(!ag?.ativo||!ag.turnos?.length)return UI.vazio('Dia sem atendimento','Este profissional não possui expediente neste dia.');
 for(const turno of ag.turnos){
  slots.push('<div class="agenda-turno-titulo">'+U.escapar(turno.inicio)+' às '+U.escapar(turno.fim)+'</div>');
  for(let minuto=U.horaMinutos(turno.inicio);minuto<U.horaMinutos(turno.fim);minuto+=30){
   const hora=U.dois(Math.floor(minuto/60))+':'+U.dois(minuto%60),nessa=agendados.filter(s=>U.horaMinutos(s.hora)>=minuto&&U.horaMinutos(s.hora)<minuto+30);
   const livre=!bloqueado(pid,dia,hora,30);
   slots.push('<div class="agenda-slot"><span class="agenda-hora">'+hora+'</span><div class="agenda-compromissos">'+nessa.map(card).join('')+(livre&&A.permissoes.pode('agenda.editar')?'<button class="agenda-empty" data-criar="'+dia+'" data-hora="'+hora+'" data-prof="'+U.escapar(pid||'')+'" aria-label="Agendar às '+hora+'">+ Agendar</button>':(!livre?'<span class="muted">Bloqueado</span>':''))+'</div></div>');
  }
 }
 const fora=agendados.filter(s=>!A.regras.horarioDisponivel(S.porId('profissionais',pid)?.horariosSemana?.length===7?S.porId('profissionais',pid):S.obter('config'),dia,s.hora,s.duracaoMin||0)||bloqueado(pid,dia,s.hora,s.duracaoMin||30));
 if(fora.length)slots.unshift('<div class="agenda-turno-titulo">Agendamentos fora da jornada atual</div>'+fora.map(card).join(''));
 return slots.join('');
}
function telaTodos(){
 const ps=ativos(),sem=compromissos(dia,'').filter(s=>!s.profissionalId);
 if(ps.length<=1)return telaIndividual(ps[0]?.id||'');
 return '<div class="agenda-profissionais">'+ps.map(p=>{const ag=escala(dia,p.id),it=compromissos(dia,p.id);return '<section class="agenda-coluna"><h3><span class="cor-profissional" style="background:'+U.escapar(p.cor||'#0E5A6B')+'"></span>'+U.escapar(p.nome)+'</h3><p class="agenda-expediente">'+(ag?.ativo?turnoLabel(ag.turnos):'Folga')+'</p>'+(it.map(card).join('')||'<p class="muted">Sem agendamentos</p>')+(ag?.ativo&&A.permissoes.pode('agenda.editar')?'<button class="btn secundario compacto" data-criar="'+dia+'" data-hora="'+ag.turnos[0].inicio+'" data-prof="'+U.escapar(p.id)+'">+ Agendar</button>':'')+'</section>'}).join('')+(sem.length?'<section class="agenda-coluna"><h3>Sem profissional</h3><p class="agenda-expediente">Histórico sem atribuição</p>'+sem.map(card).join('')+'</section>':'')+'</div>';
}
function telaSemana(){
 const inicio=U.inicioSemana(dia),pid=profissionalEfetivo();
 return '<div class="semana">'+Array.from({length:7},(_,i)=>{const data=U.deslocarDia(inicio,i),comp=compromissos(data,pid),ag=pid?escala(data,pid):A.regras.horariosSemana(S.obter('config'))[U.parseData(data).getDay()];return '<section class="card semana-dia"><h3>'+['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][i]+' '+U.exibirData(data).slice(0,5)+'</h3><p class="agenda-expediente">'+(ag?.ativo?turnoLabel(ag.turnos):'Fechado')+'</p>'+(comp.map(card).join('')||'<p class="muted">Sem agendamentos</p>')+(ag?.ativo&&A.permissoes.pode('agenda.editar')?'<button class="btn secundario compacto" data-criar="'+data+'" data-hora="'+ag.turnos[0].inicio+'" data-prof="'+U.escapar(pid||'')+'">+ Agendar</button>':'')+'</section>'}).join('')+'</div>';
}
function render(){
 const ps=ativos(),proprio=A.auth.membro?.profissional_id,somenteProprio=A.permissoes.pode('agenda.propria')&&!A.permissoes.pode('agenda.ver_todas');
 if(somenteProprio)profissional=proprio||'__sem_vinculo__';
 const seletor=!somenteProprio&&ps.length?'<div class="field agenda-seletor-prof"><label for="agenda-profissional">Profissional</label><select id="agenda-profissional"><option value="">Todos</option>'+ps.map(p=>'<option value="'+U.escapar(p.id)+'" '+(p.id===profissional?'selected':'')+'>'+U.escapar(p.nome)+'</option>').join('')+'</select></div>':'';
 return '<div class="page-heading"><div><h1>Agenda</h1><p class="muted">Compromissos por profissional e jornada individual.</p></div></div>'+seletor+'<div class="toolbar"><div class="segmented" aria-label="Visualização"><button data-view="dia" aria-pressed="'+(visao==='dia')+'">Dia</button><button data-view="semana" aria-pressed="'+(visao==='semana')+'">Semana</button></div><button class="btn secundario compacto" data-hoje>Hoje</button></div><div class="toolbar"><button class="icon-button" data-mover="-1" aria-label="Período anterior">'+UI.icon('back')+'</button><strong>'+(visao==='dia'?U.formatarDia(dia):'Semana de '+U.exibirData(U.inicioSemana(dia)))+'</strong><button class="icon-button" data-mover="1" aria-label="Próximo período">'+UI.icon('next')+'</button></div>'+(visao==='dia'?(profissionalEfetivo()?telaIndividual(profissionalEfetivo()):telaTodos()):telaSemana());
}
function bind(root){
 root.querySelector('#agenda-profissional')?.addEventListener('change',e=>{profissional=e.target.value;A.app.refresh()});
 root.querySelectorAll('[data-lembrete]').forEach(b=>b.onclick=()=>A.views.servicos.enviarLembrete(b.dataset.lembrete));
 root.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{visao=b.dataset.view;A.app.refresh()});
 root.querySelector('[data-hoje]').onclick=()=>{dia=U.hoje();A.app.refresh()};
 root.querySelectorAll('[data-mover]').forEach(b=>b.onclick=()=>{dia=U.deslocarDia(dia,Number(b.dataset.mover)*(visao==='semana'?7:1));A.app.refresh()});
 root.querySelectorAll('[data-abrir]').forEach(b=>b.onclick=()=>A.app.ir('#/servicos/'+encodeURIComponent(b.dataset.abrir)));
 root.querySelectorAll('[data-criar]').forEach(b=>b.onclick=()=>A.views.servicos.abrirForm(null,{data:b.dataset.criar,hora:b.dataset.hora,profissionalId:b.dataset.prof||undefined}));
}
A.views=A.views||{};A.views.agenda={render,bind};
})(window.AdmPro=window.AdmPro||{});
