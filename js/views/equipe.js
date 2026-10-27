/* Equipe, profissionais, horários, ausências, convites e acessos. */
(function(A){
'use strict';
const U=A.utils,UI=A.ui,S=A.storage;
let equipe={membros:[],convites:[]};
const papelNome={dono:'Proprietário',gerente:'Gerente',recepcionista:'Recepcionista',profissional:'Profissional'};
const esc=U.escapar;
function profissionais(){return S.lista('profissionais').slice().sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))}
function servicosCatalogo(){return S.lista('catalogo').filter(x=>x.ativo!==false&&x.categoria==='servico')}
function listaProfissionais(){
 const itens=profissionais();
 return itens.length?itens.map(p=>{
   const foto=/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(p.fotoBase64||'')
     ? '<img class="foto-profissional" src="'+esc(p.fotoBase64)+'" alt="">'
     : '<span class="cor-profissional" style="background:'+esc(p.cor||'#0E5A6B')+'"></span>';
   return '<article class="list-card"><div class="grow"><div class="inline-row">'+foto+'<h3>'+esc(p.nome)+'</h3>'+(!p.ativo?'<span class="chip cancelado">Inativo</span>':'')+'</div><p class="item-meta">'+esc([p.funcao,p.especialidade,p.telefone].filter(Boolean).join(' · ')||'Profissional cadastrado')+'</p></div>'+(A.permissoes.pode('equipe.editar')?'<button type="button" class="btn secundario compacto" data-editar-prof="'+esc(p.id)+'">Editar</button>':'')+'</article>';
 }).join(''):UI.vazio('Nenhum profissional','Cadastre quem realiza atendimentos. O profissional não precisa ter login.',A.permissoes.pode('equipe.editar')?'Adicionar profissional':'',A.permissoes.pode('equipe.editar')?'novoProfissional':'');
}
function render(){
 return '<div class="page-heading"><div><h1>Equipe e Profissionais</h1><p class="muted">Agendas, jornadas e acessos da empresa.</p></div>'+(A.permissoes.pode('equipe.editar')?'<button class="btn" type="button" data-novo-prof>+ Profissional</button>':'')+'</div>'+
 '<section class="section"><div class="section-heading"><h2>Profissionais</h2></div>'+UI.card('<div id="lista-profissionais" class="stack">'+listaProfissionais()+'</div>')+'</section>'+
 '<section class="section"><div class="section-heading"><h2>Usuários com acesso</h2>'+(A.permissoes.pode('convites.gerenciar')?'<button class="btn secundario compacto" type="button" data-convidar>Convidar usuário</button>':'')+'</div><div id="equipe-acessos">'+UI.card('<p class="muted">Carregando acessos…</p>')+'</div></section>';
}
function defaultsHorario(p){
 return p?.horariosSemana?.length===7?p:{...S.obter('config'),horariosSemana:S.obter('config')?.horariosSemana};
}
function lerFoto(file,atual){
 if(!file)return Promise.resolve(atual||'');
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))return Promise.reject(Error('Use uma imagem PNG, JPEG ou WebP.'));
 if(file.size>700*1024)return Promise.reject(Error('A foto deve ter no máximo 700 KB.'));
 return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(Error('Não foi possível ler a foto.'));r.onload=()=>resolve(r.result);r.readAsDataURL(file)});
}
function abrirProfissional(id){
 const antigo=id?S.porId('profissionais',id):null, catalogo=servicosCatalogo();
 let ausencias=(antigo?.ausencias||[]).map(x=>({...x,id:x.id||U.id()}));
 const horarios=defaultsHorario(antigo);
 const checks=catalogo.length?'<div class="field"><span class="label">Serviços executados</span><div class="check-grid">'+catalogo.map(c=>'<label class="check-row"><input type="checkbox" name="servicosExecutados" value="'+esc(c.id)+'" '+((antigo?.servicosExecutados||[]).includes(c.id)?'checked':'')+'> '+esc(c.nome)+'</label>').join('')+'</div></div>':'';
 const html='<form id="form-profissional" class="form-grid">'+
  UI.campo('Nome','nome',antigo?.nome||'',{required:true})+
  UI.campo('Telefone','telefone',antigo?.telefone||'',{attrs:'data-mask="telefone" inputmode="tel"'})+
  UI.campo('E-mail (opcional)','email',antigo?.email||'',{type:'email'})+
  '<div class="form-grid duas">'+UI.campo('Função','funcao',antigo?.funcao||'')+UI.campo('Especialidade','especialidade',antigo?.especialidade||'')+'</div>'+
  checks+'<div class="form-grid duas"><label class="field"><span class="label">Cor na agenda</span><input type="color" name="cor" value="'+esc(antigo?.cor||'#0E5A6B')+'"></label><label class="field"><span class="label">Foto (opcional)</span><input type="file" name="foto" accept="image/*"></label></div>'+
  UI.editorHorarios(horarios)+
  '<section><div class="section-heading"><h3>Folgas, férias e bloqueios</h3></div><div id="ausencias-lista" class="stack"></div>'+
  '<div class="form-grid duas">'+UI.campo('Tipo','ausenciaTipo','bloqueio',{options:[{value:'bloqueio',label:'Bloqueio'},{value:'folga',label:'Folga'},{value:'ferias',label:'Férias'},{value:'ausencia',label:'Ausência'}]})+UI.campo('Motivo','ausenciaMotivo','')+'</div>'+
  '<div class="form-grid duas">'+UI.campo('Data inicial','ausenciaInicioData','',{type:'date'})+UI.campo('Data final','ausenciaFimData','',{type:'date'})+'</div>'+
  '<div class="form-grid duas">'+UI.campo('Início','ausenciaInicio','00:00',{type:'time'})+UI.campo('Fim','ausenciaFim','23:59',{type:'time'})+'</div><button type="button" class="btn secundario compacto" data-add-ausencia>Adicionar período</button></section>'+
  '<label class="check-row"><input type="checkbox" name="atendimentoSimultaneo" '+(antigo?.atendimentoSimultaneo?'checked':'')+'> Permitir atendimentos simultâneos para este profissional</label>'+
  '<label class="check-row"><input type="checkbox" name="ativo" '+(antigo?.ativo===false?'':'checked')+'> Profissional ativo</label>'+
  '<button class="btn" type="submit">Salvar profissional</button></form>';
 UI.modal(antigo?'Editar profissional':'Novo profissional',html,sheet=>{
   const f=sheet.querySelector('form');UI.mascara(f);UI.ativarEditorHorarios(f);
   const desenharAusencias=()=>{const box=sheet.querySelector('#ausencias-lista');box.innerHTML=ausencias.length?ausencias.map(a=>{const iniData=a.dataInicio||a.data,fimData=a.dataFim||a.data||iniData,tipo=({bloqueio:'Bloqueio',folga:'Folga',ferias:'Férias',ausencia:'Ausência'})[a.tipo]||'Bloqueio';return '<div class="list-card"><div class="grow"><strong>'+esc(tipo)+' · '+esc(U.exibirData(iniData))+(fimData&&fimData!==iniData?' até '+esc(U.exibirData(fimData)):'')+'</strong><p class="item-meta">'+esc(a.inicio||'00:00')+'–'+esc(a.fim||'23:59')+(a.motivo?' · '+esc(a.motivo):'')+'</p></div><button type="button" class="icon-button" data-rm-ausencia="'+esc(a.id)+'" aria-label="Remover período">'+UI.icon('trash')+'</button></div>'}).join(''):'<p class="muted">Sem folgas, férias ou bloqueios específicos.</p>';box.querySelectorAll('[data-rm-ausencia]').forEach(b=>b.onclick=()=>{ausencias=ausencias.filter(x=>x.id!==b.dataset.rmAusencia);desenharAusencias()})};
   desenharAusencias();
   sheet.querySelector('[data-add-ausencia]').onclick=()=>{const di=f.elements.ausenciaInicioData.value,df=f.elements.ausenciaFimData.value||di,ini=f.elements.ausenciaInicio.value,fim=f.elements.ausenciaFim.value,tipo=f.elements.ausenciaTipo.value;if(!di||df<di||!ini||!fim||ini>=fim){UI.toast('Informe datas e intervalo válidos.');return}ausencias.push({id:U.id(),tipo,dataInicio:di,dataFim:df,inicio:ini,fim,motivo:f.elements.ausenciaMotivo.value.trim()});f.elements.ausenciaInicioData.value='';f.elements.ausenciaFimData.value='';f.elements.ausenciaMotivo.value='';desenharAusencias()};
   f.onsubmit=async e=>{e.preventDefault();if(!UI.validar(f))return;const b=f.querySelector('[type=submit]');b.disabled=true;try{
     const semana=UI.lerEditorHorarios(f),d=new FormData(f),foto=await lerFoto(f.elements.foto.files[0],antigo?.fotoBase64);
     const item={...antigo,id:antigo?.id||U.id(),nome:d.get('nome').trim(),telefone:U.mascaraTelefone(d.get('telefone')||''),email:String(d.get('email')||'').trim(),funcao:String(d.get('funcao')||'').trim(),especialidade:String(d.get('especialidade')||'').trim(),servicosExecutados:d.getAll('servicosExecutados'),horariosSemana:semana,ausencias,cor:d.get('cor')||'#0E5A6B',fotoBase64:foto,atendimentoSimultaneo:d.get('atendimentoSimultaneo')==='on',ativo:d.get('ativo')==='on',criadoEm:antigo?.criadoEm||U.dataHora(),atualizadoEm:U.dataHora()};
     if(antigo)S.atualizar('profissionais',antigo.id,item);else S.adicionar('profissionais',item);
     UI.fechar();A.app.refresh();S.sincronizar().catch(err=>UI.toast(err.message));UI.toast('Profissional salvo.');
   }catch(err){UI.toast(err.message);b.disabled=false}};
 });
}
function opProfissionais(selecionado=''){
 return '<option value="">Sem vínculo de agenda</option>'+profissionais().filter(p=>p.ativo!==false||p.id===selecionado).map(p=>'<option value="'+esc(p.id)+'" '+(p.id===selecionado?'selected':'')+'>'+esc(p.nome)+'</option>').join('');
}
function permissoesExtras(obj={}){
 return '<fieldset class="permissoes-grid"><legend>Permissões adicionais</legend>'+
 ['agenda.ver_todas|Ver todas as agendas','clientes.ver|Ver todos os clientes','catalogo.ver|Ver catálogo','financeiro.receber|Registrar recebimentos','financeiro.ver|Ver financeiro','financeiro.editar|Editar financeiro','estoque.ver|Ver estoque','estoque.editar|Editar estoque','relatorios.operacionais|Ver relatórios operacionais','config.editar|Editar configurações'].map(x=>{const [k,n]=x.split('|');return '<label class="check-row"><input type="checkbox" data-permissao="'+k+'" '+(obj[k]===true?'checked':'')+'> '+n+'</label>'}).join('')+'</fieldset>';
}
function extrasDo(sheet){const o={};sheet.querySelectorAll('[data-permissao]').forEach(c=>{if(c.checked)o[c.dataset.permissao]=true});return o}
function linkConvite(id){
 const u=new URL(location.href);u.search='?convite='+encodeURIComponent(id);u.hash='';return u.href;
}
function mostrarLink(id){
 const link=linkConvite(id);
 UI.modal('Convite pronto','<p>Envie este link para a pessoa convidada. Ela deverá entrar ou criar a conta com o mesmo e-mail informado.</p><label class="field"><span class="label">Link do convite</span><input id="link-convite" readonly value="'+esc(link)+'"></label><button class="btn" type="button" id="copiar-convite">Copiar link</button>',sheet=>{sheet.querySelector('#copiar-convite').onclick=async()=>{try{await navigator.clipboard.writeText(link);UI.toast('Link copiado.')}catch(_){const i=sheet.querySelector('#link-convite');i.select();document.execCommand('copy');UI.toast('Link copiado.')}}});
}
function abrirConvite(){
 const html='<form id="form-convite" class="form-grid">'+UI.campo('E-mail','email','',{required:true,type:'email'})+
 UI.campo('Perfil','papel','recepcionista',{options:[{value:'gerente',label:'Gerente'},{value:'recepcionista',label:'Recepcionista'},{value:'profissional',label:'Profissional'}]})+
 '<label class="field"><span class="label">Profissional associado (opcional)</span><select name="profissionalId">'+opProfissionais()+'</select></label>'+permissoesExtras()+
 '<button class="btn" type="submit">Criar convite</button></form>';
 UI.modal('Convidar usuário',html,sheet=>{const f=sheet.querySelector('form');f.onsubmit=async e=>{e.preventDefault();const b=f.querySelector('[type=submit]');b.disabled=true;try{await S.sincronizar();const d=new FormData(f),r=await A.auth.client.rpc('criar_convite',{p_conta:A.auth.conta.id,p_email:d.get('email'),p_papel:d.get('papel'),p_profissional_id:d.get('profissionalId')||null,p_permissoes:extrasDo(sheet)});if(r.error)throw r.error;UI.fechar();mostrarLink(r.data);await carregarEquipe(document.getElementById('conteudo'));}catch(err){UI.toast(err.message);b.disabled=false}}});
}
function editarMembro(m){
 const html='<form class="form-grid"><p><strong>'+esc(m.email)+'</strong></p>'+UI.campo('Perfil','papel',m.papel,{options:[{value:'gerente',label:'Gerente'},{value:'recepcionista',label:'Recepcionista'},{value:'profissional',label:'Profissional'}]})+
 '<label class="field"><span class="label">Profissional associado</span><select name="profissionalId">'+opProfissionais(m.profissional_id||'')+'</select></label>'+permissoesExtras(m.permissoes||{})+'<button class="btn" type="submit">Salvar acesso</button></form>';
 UI.modal('Editar acesso',html,sheet=>{sheet.querySelector('form').onsubmit=async e=>{e.preventDefault();const d=new FormData(e.currentTarget),r=await A.auth.client.rpc('atualizar_membro',{p_conta:A.auth.conta.id,p_user:m.user_id,p_papel:d.get('papel'),p_profissional_id:d.get('profissionalId')||null,p_permissoes:extrasDo(sheet)});if(r.error){UI.toast(r.error.message);return}UI.fechar();await carregarEquipe(document.getElementById('conteudo'));UI.toast('Acesso atualizado.')}});
}
function acessosHTML(){
 const membros=equipe.membros||[],conv=equipe.convites||[];
 return UI.card('<div class="stack">'+(membros.length?membros.map(m=>'<article class="list-card"><div class="grow"><h3>'+esc(m.email)+'</h3><p class="item-meta">'+esc(papelNome[m.papel]||m.papel)+(m.profissional_id?' · agenda vinculada':'')+(m.ativo===false?' · acesso revogado':'')+'</p></div><div class="item-actions">'+(m.papel!=='dono'&&A.permissoes.pode('equipe.editar')?'<button class="btn secundario compacto" data-editar-membro="'+esc(m.user_id)+'">Editar</button><button class="btn secundario compacto" data-revogar="'+esc(m.user_id)+'">Revogar</button>':'')+'</div></article>').join(''):'<p class="muted">Nenhum usuário.</p>')+
 (conv.length?'<div class="divider"></div><h3>Convites pendentes</h3>'+conv.map(i=>'<article class="list-card"><div class="grow"><strong>'+esc(i.email)+'</strong><p class="item-meta">'+esc(papelNome[i.papel]||i.papel)+' · expira '+new Date(i.expira_em).toLocaleDateString('pt-BR')+'</p></div><div class="item-actions"><button class="btn secundario compacto" data-reenviar="'+esc(i.id)+'">Reenviar</button><button class="btn secundario compacto" data-cancelar="'+esc(i.id)+'">Cancelar</button></div></article>').join(''):'')+'</div>');
}
async function carregarEquipe(root){
 if(!A.permissoes.pode('equipe.ver'))return;
 const r=await A.auth.client.rpc('listar_equipe',{p_conta:A.auth.conta.id});if(r.error){UI.toast(r.error.message);return}
 equipe=r.data||{membros:[],convites:[]};const box=root.querySelector('#equipe-acessos');if(!box)return;box.innerHTML=acessosHTML();
 box.querySelectorAll('[data-editar-membro]').forEach(b=>b.onclick=()=>editarMembro(equipe.membros.find(m=>m.user_id===b.dataset.editarMembro)));
 box.querySelectorAll('[data-revogar]').forEach(b=>b.onclick=()=>UI.confirmar('Revogar acesso?','A pessoa deixará de acessar esta empresa. O profissional e o histórico de atendimentos não serão apagados.',async()=>{const r=await A.auth.client.rpc('revogar_membro',{p_conta:A.auth.conta.id,p_user:b.dataset.revogar});if(r.error){UI.toast(r.error.message);return}await carregarEquipe(root);UI.toast('Acesso revogado.');},'Revogar'));
 box.querySelectorAll('[data-reenviar]').forEach(b=>b.onclick=async()=>{const r=await A.auth.client.rpc('reenviar_convite',{p_conta:A.auth.conta.id,p_convite:b.dataset.reenviar});if(r.error){UI.toast(r.error.message);return}mostrarLink(r.data);await carregarEquipe(root)});
 box.querySelectorAll('[data-cancelar]').forEach(b=>b.onclick=()=>UI.confirmar('Cancelar convite?','O link deixará de poder ser aceito.',async()=>{const r=await A.auth.client.rpc('cancelar_convite',{p_conta:A.auth.conta.id,p_convite:b.dataset.cancelar});if(r.error){UI.toast(r.error.message);return}await carregarEquipe(root);UI.toast('Convite cancelado.');},'Cancelar convite'));
}
function bind(root){
 root.querySelector('[data-novo-prof]')?.addEventListener('click',()=>abrirProfissional());
 root.querySelector('[data-action="novoProfissional"]')?.addEventListener('click',()=>abrirProfissional());
 root.querySelectorAll('[data-editar-prof]').forEach(b=>b.onclick=()=>abrirProfissional(b.dataset.editarProf));
 root.querySelector('[data-convidar]')?.addEventListener('click',abrirConvite);
 carregarEquipe(root).catch(e=>UI.toast(e.message));
}
A.views=A.views||{};A.views.equipe={render,bind,abrirProfissional};
})(window.AdmPro=window.AdmPro||{});
