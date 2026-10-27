/* Agenda diária e semanal com seleção de horários livres. */
(function (A) {
    'use strict';
    const U = A.utils, UI = A.ui, S = A.storage;
    let dia = U.hoje(), visao = 'dia', profissional = ''; 
    const compromissos = (data) => S.lista('servicos').filter(s => s.data === data && s.status !== 'cancelado' && s.hora && (!profissional || s.profissionalId===profissional)).sort((a, b) => a.hora.localeCompare(b.hora));
    function card(s) { return `<div class="agenda-envoltorio"><button type="button" class="agenda-item" data-abrir="${U.escapar(s.id)}"><strong>${U.escapar(s.hora)} · ${U.escapar(S.porId('clientes',s.clienteId)?.nome || 'Cliente')}</strong><span>${U.escapar(s.titulo)}</span>${UI.chip(s.status)}${s.lembreteEnviadoEm?'<small class="badge-sutil">Lembrete enviado ✓</small>':''}${s.recorrencia?.ativa?'<small class="badge-sutil">↻ Recorrente</small>':''}</button>${s.status==='agendado'&&s.data>=U.hoje()?`<button class="btn secundario compacto" data-lembrete="${U.escapar(s.id)}" aria-label="Enviar lembrete por WhatsApp">${UI.icon('sino',true)} Enviar lembrete</button>`:''}</div>`; }
    const agendaDia=data=>A.regras.horariosSemana(S.obter('config'))[U.parseData(data).getDay()];
    const turnoLabel=turnos=>turnos.map(t=>`${t.inicio}–${t.fim}`).join(' · ');
    function telaDia() {
        const agenda=agendaDia(dia), agendados=compromissos(dia), slots=[];
        if (!agenda.ativo || !agenda.turnos.length) return UI.vazio('Dia sem atendimento','Este dia está marcado como folga. Você pode alterá-lo em Configurações.');
        for(const turno of agenda.turnos) {
            slots.push(`<div class="agenda-turno-titulo">${U.escapar(turno.inicio)} às ${U.escapar(turno.fim)}</div>`);
            for(let minuto=U.horaMinutos(turno.inicio);minuto<U.horaMinutos(turno.fim);minuto+=30) {
                const hora=U.dois(Math.floor(minuto/60))+':'+U.dois(minuto%60);
                const nessa=agendados.filter(s=>U.horaMinutos(s.hora)>=minuto && U.horaMinutos(s.hora)<minuto+30);
                slots.push(`<div class="agenda-slot"><span class="agenda-hora">${hora}</span><div class="agenda-compromissos">${nessa.map(card).join('')}<button class="agenda-empty" data-criar="${dia}" data-hora="${hora}" aria-label="Agendar às ${hora}">+ Agendar</button></div></div>`);
            }
        }
        const fora=agendados.filter(s=>!A.regras.horarioDisponivel(S.obter('config'),dia,s.hora,0));
        if(fora.length) slots.unshift(`<div class="agenda-turno-titulo">Agendamentos fora do expediente</div>${fora.map(card).join('')}`);
        return slots.join('');
    }
    function telaSemana() { const inicio=U.inicioSemana(dia); return `<div class="semana">${Array.from({length:7},(_,i)=>{
        const data=U.deslocarDia(inicio,i), comp=compromissos(data), escala=agendaDia(data);
        return `<section class="card semana-dia"><h3>${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][i]} ${U.exibirData(data).slice(0,5)}</h3><p class="agenda-expediente">${escala.ativo?turnoLabel(escala.turnos):'Fechado'}</p>${comp.map(card).join('') || '<p class="muted">Sem agendamentos</p>'}${escala.ativo?`<button class="btn secundario compacto" data-criar="${data}" data-hora="${escala.turnos[0].inicio}">+ Agendar</button>`:''}</section>`;
    }).join('')}</div>`; }
    function render() { const profissionais=S.lista('profissionais').filter(p=>p.ativo); return `<div class="page-heading"><div><h1>Agenda</h1><p class="muted">Seus compromissos e horários.</p></div></div>${profissionais.length ? `<div class="field"><label for="agenda-profissional">Profissional</label><select id="agenda-profissional"><option value="">Todos os profissionais</option>${profissionais.map(p=>`<option value="${U.escapar(p.id)}" ${p.id===profissional?'selected':''}>${U.escapar(p.nome)}</option>`).join('')}</select></div>`:''}<div class="toolbar"><div class="segmented" aria-label="Visualização"><button data-view="dia" aria-pressed="${visao === 'dia'}">Dia</button><button data-view="semana" aria-pressed="${visao === 'semana'}">Semana</button></div><button class="btn secundario compacto" data-hoje>Hoje</button></div><div class="toolbar"><button class="icon-button" data-mover="-1" aria-label="Período anterior">${UI.icon('back')}</button><strong>${visao === 'dia' ? U.formatarDia(dia) : `Semana de ${U.exibirData(U.inicioSemana(dia))}`}</strong><button class="icon-button" data-mover="1" aria-label="Próximo período">${UI.icon('next')}</button></div>${visao === 'dia' ? telaDia() : telaSemana()}`; }
    function bind(root) { root.querySelector('#agenda-profissional')?.addEventListener('change',e=>{profissional=e.target.value;A.app.refresh();});root.querySelectorAll('[data-lembrete]').forEach(b=>b.onclick=()=>A.views.servicos.enviarLembrete(b.dataset.lembrete)); root.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { visao = b.dataset.view; A.app.refresh(); }); root.querySelector('[data-hoje]').onclick = () => { dia = U.hoje(); A.app.refresh(); }; root.querySelectorAll('[data-mover]').forEach(b => b.onclick = () => { dia = U.deslocarDia(dia, Number(b.dataset.mover) * (visao === 'semana' ? 7 : 1)); A.app.refresh(); }); root.querySelectorAll('[data-abrir]').forEach(b => b.onclick = () => A.app.ir('#/servicos/' + encodeURIComponent(b.dataset.abrir))); root.querySelectorAll('[data-criar]').forEach(b => b.onclick = () => A.views.servicos.abrirForm(null, { data: b.dataset.criar, hora: b.dataset.hora })); }
    A.views = A.views || {};
    A.views.agenda = { render, bind };
})(window.AdmPro = window.AdmPro || {});
