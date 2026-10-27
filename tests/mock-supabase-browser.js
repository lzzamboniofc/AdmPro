/* Backend determinístico apenas para testes de interface; nunca incluído em produção. */
(() => {
  const perfil=new URLSearchParams(location.search).get('perfil')||'dono';
  const empresa1='10000000-0000-4000-8000-000000000001',empresa2='10000000-0000-4000-8000-000000000002';
  const uid='20000000-0000-4000-8000-000000000001';
  const horario=Array.from({length:7},()=>({ativo:true,turnos:[{inicio:'08:00',fim:'12:00'},{inicio:'13:00',fim:'18:00'}]}));
  const configs=[
    {id:'principal',nomeNegocio:'Estúdio Principal',tipoNegocio:'rapido',modeloNegocio:'outro',tema:'claro',
      versaoDados:3,horariosSemana:horario,diasAtendimento:[0,1,2,3,4,5,6],horaInicio:'08:00',horaFim:'18:00'},
    {id:'principal',nomeNegocio:'Estúdio Secundário',tipoNegocio:'rapido',modeloNegocio:'outro',tema:'claro',
      versaoDados:3,horariosSemana:horario,diasAtendimento:[0,1,2,3,4,5,6],horaInicio:'08:00',horaFim:'18:00'}
  ];
  const empresas=[empresa1,empresa2].map((id,i)=>({
    id,nome_negocio:i?'Estúdio Secundário':'Estúdio Principal',tipo_negocio:'rapido',
    modelo_negocio:'outro',status_assinatura:'ativa',plano_id:'00000000-0000-4000-8000-000000000003',
    planos:{id:'00000000-0000-4000-8000-000000000003',nome:'Easy',limite_clientes:null,limite_servicos_mes:null}
  }));
  const permissoesDono=Object.fromEntries([
    'equipe.ver','equipe.editar','convites.gerenciar','agenda.ver_todas','agenda.editar',
    'atendimentos.ver_todos','clientes.ver','clientes.editar','catalogo.ver','catalogo.editar',
    'financeiro.ver','financeiro.editar','financeiro.receber','estoque.ver','estoque.editar',
    'relatorios.operacionais','config.editar','auditoria.ver','assinatura.gerenciar'
  ].map(k=>[k,true]));
  const permissoesRecepcao={'agenda.ver_todas':true,'agenda.editar':true,'clientes.ver':true,'clientes.editar':true,'catalogo.ver':true};
  const permissoesProfissional={
    'agenda.propria':true,'atendimentos.proprios':true,'atendimentos.atualizar_proprios':true,
    'clientes.vinculados':true
  };
  const hoje=new Date().toISOString().slice(0,10);
  const rows=[];
  let version=0;
  function upsert(conta_id,colecao,id,dados,excluido=false){
    const at=new Date(Date.now()+(++version)*1000).toISOString();
    const prev=rows.findIndex(x=>x.conta_id===conta_id&&x.colecao===colecao&&x.id===id);
    const obj={conta_id,colecao,id,dados:structuredClone(dados),excluido,atualizado_em:at};
    if(prev<0)rows.push(obj);else rows[prev]=obj;
    return at;
  }
  upsert(empresa1,'config','principal',configs[0]);
  upsert(empresa2,'config','principal',configs[1]);
  upsert(empresa1,'profissionais','prof-ana',{id:'prof-ana',nome:'Ana',ativo:true,cor:'#0E5A6B',horariosSemana:horario});
  upsert(empresa1,'profissionais','prof-bruno',{id:'prof-bruno',nome:'Bruno',ativo:true,cor:'#BA6F15',horariosSemana:horario});
  upsert(empresa1,'clientes','cliente-ana',{id:'cliente-ana',nome:'Cliente Ana',telefone:'11999999999'});
  upsert(empresa2,'clientes','cliente-sec',{id:'cliente-sec',nome:'Cliente Secundário',telefone:'11999999998'});
  upsert(empresa1,'servicos','atend-ana',{
    id:'atend-ana',clienteId:'cliente-ana',titulo:'Cabelo',status:'agendado',
    data:hoje,hora:'10:00',duracaoMin:60,profissionalId:'prof-ana',
    itens:[],parcelas:[],total:120,desconto:0,historico:[{status:'agendado',em:new Date().toISOString()}]
  });
  const membro=id=>({
    conta_id:id,conta:empresas.find(x=>x.id===id),papel:perfil==='profissional'?'profissional':perfil==='convidado'?'recepcionista':'dono',
    profissional_id:perfil==='profissional'?'prof-ana':null,ativo:true,permissoes:{}
  });
  const conviteTeste='30000000-0000-4000-8000-000000000999';
  let conviteAceito=sessionStorage.getItem('__fixture_convite_aceito')==='1';
  const convites=perfil==='convidado'?[{id:conviteTeste,email:'convidado@example.test',papel:'recepcionista',
    conta_id:empresa1,nome_negocio:'Estúdio Principal',expira_em:new Date(Date.now()+7*86400000).toISOString()}]:[];
  function result(data=null){return {data,error:null}};
  let signed=true;
  const user={id:uid,email:perfil==='profissional'?'ana@example.test':perfil==='convidado'?'convidado@example.test':'dono@example.test'};
  const mock={
    perfil,empresas,rows,convites,empresa1,empresa2,uid,
    get conviteAceito(){return conviteAceito},
    async rpc(name,p={}){
      if(name==='minhas_empresas')return result((perfil==='convidado'&&!conviteAceito?[]:perfil==='duas'?empresas:[empresas[0]]).map(x=>membro(x.id)));
      if(name==='minha_empresa')return result(empresas.find(x=>x.id===p.p_conta));
      if(name==='permissoes_membro')return result(perfil==='profissional'?permissoesProfissional:perfil==='convidado'?permissoesRecepcao:permissoesDono);
      if(name==='meus_convites_pendentes')return result(conviteAceito?[]:convites);
      if(name==='aceitar_convite'){
        if(perfil==='convidado'&&p.p_convite===conviteTeste){conviteAceito=true;sessionStorage.setItem('__fixture_convite_aceito','1');return result(empresa1)}
        return {data:null,error:{message:'CONVITE_INVALIDO'}};
      }
      if(name==='atualizar_minha_assinatura'||name==='registrar_acesso')return result();
      if(name==='sincronizar_dados'){
        const filtradas=rows.filter(x=>x.conta_id===p.p_conta&&x.atualizado_em>=p.p_cursor)
          .filter(x=>perfil!=='profissional'||['config','profissionais','clientes','servicos'].includes(x.colecao))
          .filter(x=>perfil!=='profissional'||x.colecao!=='profissionais'||x.id==='prof-ana')
          .map(x=>{
            if(perfil!=='profissional'||x.colecao!=='servicos')return x;
            const dados={...x.dados,itens:[],parcelas:[]};delete dados.total;delete dados.desconto;
            return {...x,dados};
          })
          .sort((a,b)=>a.atualizado_em.localeCompare(b.atualizado_em)||a.id.localeCompare(b.id));
        return result(filtradas.slice(p.p_offset,p.p_offset+p.p_limite));
      }
      if(name==='salvar_dado_otimista'){
        const anterior=rows.find(x=>x.conta_id===p.p_conta&&x.colecao===p.p_colecao&&x.id===p.p_id);
        if(p.p_novo?!!anterior:!anterior||anterior.atualizado_em!==p.p_base_atualizado_em)
          return {data:null,error:{message:'STALE_WRITE'}};
        return result(upsert(p.p_conta,p.p_colecao,p.p_id,p.p_dados,p.p_excluido));
      }
      if(name==='listar_equipe')return result({membros:[{
        user_id:uid,email:user.email,papel:perfil==='profissional'?'profissional':'dono',
        profissional_id:perfil==='profissional'?'prof-ana':null,ativo:true,permissoes:{}
      }],convites});
      if(name==='criar_convite'){
        const id='30000000-0000-4000-8000-'+String(convites.length+1).padStart(12,'0');
        convites.push({id,email:p.p_email,papel:p.p_papel,profissional_id:p.p_profissional_id,
          expira_em:new Date(Date.now()+7*86400000).toISOString()});
        return result(id);
      }
      if(name==='cancelar_convite'||name==='reenviar_convite'||name==='atualizar_membro'||name==='revogar_membro')return result(p.p_convite||null);
      return result();
    },
    from(table){
      const q={
        select(){return q},eq(){return q},gte(){return q},order(){return q},in(){return q},
        single(){return Promise.resolve(result(null))},maybeSingle(){return Promise.resolve(result(null))},
        then(ok,fail){return Promise.resolve(result(table==='avisos'||table==='uso_diario'?[]:[])).then(ok,fail)}
      };
      return q;
    },
    auth:{
      async getSession(){return result({session:signed?{user}:null})},
      async signInWithPassword(){signed=true;return result({user,session:{user}})},
      async signUp(){signed=true;return result({user,session:{user}})},
      async signOut(){signed=false;return result()},
      async updateUser(){return result({user})}
    }
  };
  window.__admproMock=mock;
  window.supabase={createClient:()=>mock};
})();