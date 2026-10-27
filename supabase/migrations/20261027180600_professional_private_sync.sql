-- Sincronização privada para papéis restritos e operações seguras do profissional.

create or replace function public.pode_ler_dado(p_conta uuid,p_colecao text,p_id text,p_dados jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare prof text;
begin
  if not public.eh_membro(p_conta) then return false; end if;
  if p_colecao='config' then return public.tem_permissao(p_conta,'config.editar'); end if;
  if p_colecao='catalogo' then return public.tem_permissao(p_conta,'catalogo.ver'); end if;
  if p_colecao='profissionais' then return public.tem_permissao(p_conta,'equipe.ver'); end if;
  if p_colecao='clientes' then
    return public.tem_permissao(p_conta,'clientes.ver')
      or (public.tem_permissao(p_conta,'clientes.vinculados') and public.cliente_vinculado_ao_profissional(p_conta,p_id));
  end if;
  if p_colecao='servicos' then
    if public.tem_permissao(p_conta,'agenda.ver_todas') or public.tem_permissao(p_conta,'atendimentos.ver_todos') then return true; end if;
    prof:=public.meu_profissional(p_conta);
    return prof is not null and nullif(p_dados->>'profissionalId','')=prof
      and (public.tem_permissao(p_conta,'financeiro.ver') or public.tem_permissao(p_conta,'financeiro.receber'));
  end if;
  if p_colecao in ('lancamentos','despesasFixas') then return public.tem_permissao(p_conta,'financeiro.ver'); end if;
  if p_colecao='movimentacoesEstoque' then return public.tem_permissao(p_conta,'estoque.ver'); end if;
  return false;
end $$;

create or replace function public.minha_empresa(p_conta uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare m public.membros%rowtype; c public.contas%rowtype; p public.planos%rowtype; completo boolean;
begin
  select * into m from public.membros where conta_id=p_conta and user_id=(select auth.uid()) and ativo;
  if not found then raise exception 'CONTA_NAO_AUTORIZADA' using errcode='42501'; end if;
  select * into c from public.contas where id=p_conta;
  select * into p from public.planos where id=c.plano_id;
  completo:=public.tem_permissao(p_conta,'config.editar') or public.tem_permissao(p_conta,'assinatura.gerenciar');
  if completo then
    return to_jsonb(c)||jsonb_build_object('planos',to_jsonb(p));
  end if;
  return jsonb_build_object(
    'id',c.id,'nome_negocio',c.nome_negocio,'modelo_negocio',c.modelo_negocio,'tipo_negocio',c.tipo_negocio,
    'telefone',c.telefone,'cidade',c.cidade,'uf',c.uf,'status_assinatura',c.status_assinatura,'trial_ate',c.trial_ate,
    'plano_id',c.plano_id,
    'planos',jsonb_build_object(
      'id',p.id,'nome',p.nome,'limite_clientes',p.limite_clientes,'limite_servicos_mes',p.limite_servicos_mes,
      'limite_profissionais',p.limite_profissionais,'limite_usuarios',p.limite_usuarios,'limite_unidades',p.limite_unidades
    )
  );
end $$;

create or replace function public.minhas_empresas() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if (select auth.uid()) is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'conta_id',m.conta_id,'papel',m.papel,'profissional_id',m.profissional_id,
      'permissoes',m.permissoes,'ativo',m.ativo,'criado_em',m.criado_em,
      'conta',public.minha_empresa(m.conta_id)
    ) order by m.criado_em,m.conta_id)
    from public.membros m
    where m.user_id=(select auth.uid()) and m.ativo
  ),'[]'::jsonb);
end $$;

revoke all on function public.minha_empresa(uuid),public.minhas_empresas() from public,anon;
grant execute on function public.minha_empresa(uuid),public.minhas_empresas() to authenticated;

drop policy if exists contas_ler on public.contas;
create policy contas_ler on public.contas for select to authenticated
using ((select public.is_admin()) or public.tem_permissao(id,'config.editar') or public.tem_permissao(id,'assinatura.gerenciar'));

create or replace function public.sincronizar_dados(
  p_conta uuid,
  p_cursor timestamptz default '1970-01-01T00:00:00Z',
  p_offset integer default 0,
  p_limite integer default 500
) returns table(id text,colecao text,dados jsonb,excluido boolean,atualizado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare prof text; pode_valores boolean; pode_config boolean; pode_equipe boolean;
begin
  if not public.eh_membro(p_conta) then raise exception 'CONTA_NAO_AUTORIZADA' using errcode='42501'; end if;
  prof:=public.meu_profissional(p_conta);
  pode_valores:=public.tem_permissao(p_conta,'financeiro.ver') or public.tem_permissao(p_conta,'financeiro.receber');
  pode_config:=public.tem_permissao(p_conta,'config.editar');
  pode_equipe:=public.tem_permissao(p_conta,'equipe.ver');

  return query
  select d.id,d.colecao,
    case
      when d.colecao='config' and not pode_config then
        d.dados-'metaMensal'-'reciboSequencia'-'pinHash'-'pinMetodo'
      when d.colecao='profissionais' and not pode_equipe then
        d.dados-'comissaoPercentual'
      when d.colecao='servicos' and not pode_valores then
        (d.dados-'parcelas'-'total'-'desconto'-'reciboNumero') ||
        jsonb_build_object(
          'parcelas','[]'::jsonb,
          'itens',coalesce((
            select jsonb_agg(e.value-'precoUnit'-'preco'-'custo')
            from jsonb_array_elements(coalesce(d.dados->'itens','[]'::jsonb)) e
          ),'[]'::jsonb)
        )
      else d.dados
    end as dados,
    d.excluido,d.atualizado_em
  from public.dados d
  where d.conta_id=p_conta
    and d.atualizado_em>=coalesce(p_cursor,'1970-01-01T00:00:00Z'::timestamptz)
    and (
      public.pode_ler_dado(d.conta_id,d.colecao,d.id,d.dados)
      or d.colecao='config'
      or (d.colecao='profissionais' and prof is not null and d.id=prof)
      or (d.colecao='servicos' and prof is not null and nullif(d.dados->>'profissionalId','')=prof
          and (public.tem_permissao(p_conta,'agenda.propria') or public.tem_permissao(p_conta,'atendimentos.proprios')))
    )
  order by d.atualizado_em,d.id
  offset greatest(coalesce(p_offset,0),0)
  limit least(greatest(coalesce(p_limite,500),1),500);
end $$;

revoke all on function public.sincronizar_dados(uuid,timestamptz,integer,integer) from public,anon;
grant execute on function public.sincronizar_dados(uuid,timestamptz,integer,integer) to authenticated;

create or replace function private.proxima_data_recorrencia(p_data date,p_rec jsonb) returns date
language plpgsql immutable set search_path='' as $$
declare q integer; unidade text; primeiro date; ultimo date;
begin
  if not coalesce((p_rec->>'ativa')::boolean,false) then return null; end if;
  if coalesce(p_rec->>'intervalo','') !~ '^[0-9]+$' then return null; end if;
  q:=(p_rec->>'intervalo')::integer;if q<1 then return null; end if;
  unidade:=p_rec->>'unidade';
  if unidade='dias' then return p_data+q; end if;
  if unidade='semanas' then return p_data+(q*7); end if;
  if unidade<>'meses' then return null; end if;
  primeiro:=(date_trunc('month',p_data)::date+make_interval(months=>q))::date;
  ultimo:=(primeiro+interval '1 month - 1 day')::date;
  return make_date(extract(year from primeiro)::integer,extract(month from primeiro)::integer,
                   least(extract(day from p_data)::integer,extract(day from ultimo)::integer));
exception when others then return null;
end $$;

create or replace function private.aplicar_estoque_servico(
  p_conta uuid,p_servico_id text,p_servico jsonb,p_baixar boolean
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb; mov record; cat record; qtd numeric; saldo numeric; novo numeric; mov_id text;
begin
  if p_baixar then
    if coalesce((p_servico->>'estoqueBaixado')::boolean,false) then return p_servico; end if;
    for item in select value from jsonb_array_elements(coalesce(p_servico->'itens','[]'::jsonb)) loop
      begin qtd:=coalesce((item->>'qtd')::numeric,0); exception when others then qtd:=0; end;
      if qtd<=0 or nullif(item->>'catalogoId','') is null then continue; end if;
      select d.id,d.dados into cat from public.dados d
       where d.conta_id=p_conta and d.colecao='catalogo' and d.id=item->>'catalogoId' and not d.excluido
       for update;
      if not found or cat.dados->>'categoria'<>'produto' or not coalesce((cat.dados->>'controlaEstoque')::boolean,false) then continue; end if;
      begin saldo:=coalesce((cat.dados->>'qtdEstoque')::numeric,0); exception when others then saldo:=0; end;
      novo:=saldo-qtd;
      update public.dados set dados=jsonb_set(cat.dados,'{qtdEstoque}',to_jsonb(novo),true),atualizado_em=clock_timestamp()
       where conta_id=p_conta and colecao='catalogo' and id=cat.id;
      mov_id:=gen_random_uuid()::text;
      insert into public.dados(conta_id,colecao,id,dados,excluido,atualizado_em)
      values(p_conta,'movimentacoesEstoque',mov_id,jsonb_build_object(
        'id',mov_id,'catalogoId',cat.id,'tipo','saida','qtd',qtd,'saldoAnterior',saldo,'saldoNovo',novo,
        'motivo','Conclusão de '||coalesce(p_servico->>'titulo','atendimento'),'servicoId',p_servico_id,'em',clock_timestamp()
      ),false,clock_timestamp());
    end loop;
    return jsonb_set(p_servico,'{estoqueBaixado}','true'::jsonb,true);
  end if;

  if not coalesce((p_servico->>'estoqueBaixado')::boolean,false) then return p_servico; end if;
  for mov in
    select d.id,d.dados from public.dados d
    where d.conta_id=p_conta and d.colecao='movimentacoesEstoque' and not d.excluido
      and d.dados->>'servicoId'=p_servico_id and d.dados->>'tipo'='saida'
      and not exists(
        select 1 from public.dados r where r.conta_id=p_conta and r.colecao='movimentacoesEstoque' and not r.excluido
          and r.dados->>'tipo'='entrada' and r.dados->>'reverteId'=d.id
      )
  loop
    begin qtd:=coalesce((mov.dados->>'qtd')::numeric,0); exception when others then qtd:=0; end;
    select d.id,d.dados into cat from public.dados d
     where d.conta_id=p_conta and d.colecao='catalogo' and d.id=mov.dados->>'catalogoId' and not d.excluido
     for update;
    if not found then continue; end if;
    begin saldo:=coalesce((cat.dados->>'qtdEstoque')::numeric,0); exception when others then saldo:=0; end;
    novo:=saldo+qtd;
    update public.dados set dados=jsonb_set(cat.dados,'{qtdEstoque}',to_jsonb(novo),true),atualizado_em=clock_timestamp()
     where conta_id=p_conta and colecao='catalogo' and id=cat.id;
    mov_id:=gen_random_uuid()::text;
    insert into public.dados(conta_id,colecao,id,dados,excluido,atualizado_em)
    values(p_conta,'movimentacoesEstoque',mov_id,jsonb_build_object(
      'id',mov_id,'catalogoId',cat.id,'tipo','entrada','qtd',qtd,'saldoAnterior',saldo,'saldoNovo',novo,
      'motivo','Estorno de '||coalesce(p_servico->>'titulo','atendimento'),'servicoId',p_servico_id,
      'reverteId',mov.id,'em',clock_timestamp()
    ),false,clock_timestamp());
  end loop;
  return jsonb_set(p_servico,'{estoqueBaixado}','false'::jsonb,true);
end $$;

create or replace function private.gerar_recorrencia_servico(
  p_conta uuid,p_servico_id text,p_servico jsonb
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare rec jsonb; proxima date; filho jsonb; parcelas jsonb:='[]'::jsonb; etapas jsonb:='[]'::jsonb;
        p jsonb; e jsonb; venc date; novo_id text;
begin
  rec:=p_servico->'recorrencia';
  if not coalesce((rec->>'ativa')::boolean,false) or nullif(p_servico->>'proximoGeradoId','') is not null then return p_servico; end if;
  begin proxima:=private.proxima_data_recorrencia((p_servico->>'data')::date,rec); exception when others then proxima:=null; end;
  if proxima is null then return p_servico; end if;
  for p in select value from jsonb_array_elements(coalesce(p_servico->'parcelas','[]'::jsonb)) loop
    begin venc:=private.proxima_data_recorrencia((p->>'vencimento')::date,rec); exception when others then venc:=proxima; end;
    parcelas:=parcelas||jsonb_build_array(
      (p-'id'-'pago'-'pagoEm'-'formaPagamento'-'lancamentoId'-'vencimento')||
      jsonb_build_object('id',gen_random_uuid()::text,'pago',false,'pagoEm',null,'formaPagamento',null,
                         'lancamentoId',null,'vencimento',coalesce(venc,proxima)::text)
    );
  end loop;
  for e in select value from jsonb_array_elements(coalesce(p_servico->'etapas','[]'::jsonb)) loop
    etapas:=etapas||jsonb_build_array(jsonb_set(e,'{concluida}','false'::jsonb,true));
  end loop;
  novo_id:=gen_random_uuid()::text;
  filho:=p_servico||
    jsonb_build_object('id',novo_id,'status','agendado','data',proxima::text,'parcelas',parcelas,
      'estoqueBaixado',false,'proximoGeradoId',null,'origemRecorrenciaId',p_servico_id,
      'lembreteEnviadoEm',null,'historico',jsonb_build_array(jsonb_build_object('status','agendado','em',clock_timestamp())),
      'criadoEm',clock_timestamp(),'reciboNumero',null,'etapas',etapas);
  begin
    insert into public.dados(conta_id,colecao,id,dados,excluido,atualizado_em)
    values(p_conta,'servicos',novo_id,filho,false,clock_timestamp());
    return jsonb_set(p_servico,'{proximoGeradoId}',to_jsonb(novo_id),true);
  exception when others then
    perform private.auditar_empresa(p_conta,'recorrencia_pendente','servico',p_servico_id,
      jsonb_build_object('erro',sqlerrm,'data',proxima));
    return p_servico;
  end;
end $$;

revoke all on function private.proxima_data_recorrencia(date,jsonb),
 private.aplicar_estoque_servico(uuid,text,jsonb,boolean),
 private.gerar_recorrencia_servico(uuid,text,jsonb)
from public,anon,authenticated;

create or replace function public.salvar_atendimento_operacional(
  p_conta uuid,p_id text,p_status text default null,p_lembrete boolean default false,p_base_atualizado_em timestamptz default null
) returns timestamptz
language plpgsql security definer set search_path='' as $$
declare d public.dados%rowtype; novo jsonb; antigo_status text; novo_status text; salvo timestamptz;
        prof text; final_antigo boolean; final_novo boolean;
begin
  if not public.tem_permissao(p_conta,'atendimentos.atualizar_proprios') then
    raise exception 'SEM_PERMISSAO' using errcode='42501';
  end if;
  prof:=public.meu_profissional(p_conta);
  if prof is null then raise exception 'PROFISSIONAL_NAO_VINCULADO' using errcode='42501'; end if;
  select * into d from public.dados
   where conta_id=p_conta and colecao='servicos' and id=p_id and not excluido
     and nullif(dados->>'profissionalId','')=prof
   for update;
  if not found then raise exception 'ATENDIMENTO_NAO_ENCONTRADO' using errcode='42501'; end if;
  if p_base_atualizado_em is null or d.atualizado_em<>p_base_atualizado_em then
    raise exception 'STALE_WRITE' using errcode='P0001';
  end if;

  antigo_status:=coalesce(d.dados->>'status','');
  if antigo_status='pago' and p_status is not null and p_status<>'pago' then
    raise exception 'ATENDIMENTO_PAGO_PROTEGIDO' using errcode='42501';
  end if;
  novo:=d.dados;
  if p_status is not null then
    if p_status not in ('agendado','andamento','concluido','cancelado') then raise exception 'STATUS_INVALIDO'; end if;
    if p_status<>antigo_status then
      novo:=jsonb_set(novo,'{status}',to_jsonb(p_status),true);
      novo:=jsonb_set(novo,'{historico}',coalesce(novo->'historico','[]'::jsonb)||
        jsonb_build_array(jsonb_build_object('status',p_status,'em',clock_timestamp())),true);
    end if;
  end if;
  if p_lembrete then novo:=jsonb_set(novo,'{lembreteEnviadoEm}',to_jsonb(clock_timestamp()),true); end if;

  novo_status:=coalesce(novo->>'status','');
  final_antigo:=antigo_status in ('concluido','pago');
  final_novo:=novo_status in ('concluido','pago');
  if not final_antigo and final_novo then
    novo:=private.aplicar_estoque_servico(p_conta,p_id,novo,true);
    novo:=private.gerar_recorrencia_servico(p_conta,p_id,novo);
  elsif final_antigo and not final_novo then
    novo:=private.aplicar_estoque_servico(p_conta,p_id,novo,false);
  end if;

  perform set_config('admpro.operacao_sistema','1',true);
  update public.dados set dados=novo,atualizado_em=clock_timestamp()
   where conta_id=p_conta and colecao='servicos' and id=p_id
  returning atualizado_em into salvo;
  perform set_config('admpro.operacao_sistema','0',true);
  return salvo;
exception when others then
  perform set_config('admpro.operacao_sistema','0',true);
  raise;
end $$;

revoke all on function public.salvar_atendimento_operacional(uuid,text,text,boolean,timestamptz) from public,anon;
grant execute on function public.salvar_atendimento_operacional(uuid,text,text,boolean,timestamptz) to authenticated;

create or replace function private.proteger_edicao_profissional() returns trigger
language plpgsql security definer set search_path='' as $$
declare permitido boolean;
begin
  if current_setting('admpro.operacao_sistema',true)='1' then return new; end if;
  if tg_op<>'UPDATE' or new.colecao<>'servicos' or (select auth.uid()) is null then return new; end if;
  if public.tem_permissao(new.conta_id,'agenda.editar') then return new; end if;
  permitido:=public.tem_permissao(new.conta_id,'atendimentos.atualizar_proprios')
    and public.meu_profissional(new.conta_id)=nullif(old.dados->>'profissionalId','')
    and public.meu_profissional(new.conta_id)=nullif(new.dados->>'profissionalId','');
  if not permitido then return new; end if;
  if (old.dados - 'status' - 'historico' - 'lembreteEnviadoEm')
     is distinct from (new.dados - 'status' - 'historico' - 'lembreteEnviadoEm') then
    raise exception 'PROFISSIONAL_SOMENTE_STATUS' using errcode='42501';
  end if;
  return new;
end $$;

create or replace function private.validar_dado() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  v_conta public.contas%rowtype; v_limites public.planos%rowtype; v_qtd int;
  v_prof text; v_inicio timestamp; v_fim timestamp; v_dur integer; v_simultaneo boolean:=false; v_validar_agenda boolean:=true;
begin
  select * into v_conta from public.contas where id=new.conta_id for update;
  if not found then raise exception 'Conta inválida'; end if;
  if v_conta.status_assinatura='bloqueada' then raise exception 'CONTA_BLOQUEADA' using errcode='P0001'; end if;
  select * into v_limites from public.planos where id=v_conta.plano_id;
  if tg_op='UPDATE' then
    v_validar_agenda :=
      old.excluido is distinct from new.excluido
      or nullif(old.dados->>'profissionalId','') is distinct from nullif(new.dados->>'profissionalId','')
      or old.dados->>'data' is distinct from new.dados->>'data'
      or old.dados->>'hora' is distinct from new.dados->>'hora'
      or coalesce(old.dados->>'duracaoMin','') is distinct from coalesce(new.dados->>'duracaoMin','')
      or (coalesce(old.dados->>'status','')='cancelado') is distinct from (coalesce(new.dados->>'status','')='cancelado');
    if new.conta_id<>old.conta_id or new.colecao<>old.colecao or new.id<>old.id or new.criado_em is distinct from old.criado_em then
      raise exception 'IDENTIDADE_IMUTAVEL' using errcode='42501';
    end if;
    if new.atualizado_em<=old.atualizado_em then raise exception 'STALE_WRITE' using errcode='P0001'; end if;
  end if;
  if new.atualizado_em>clock_timestamp()+interval '5 minutes' then raise exception 'RELOGIO_INVALIDO' using errcode='P0001'; end if;
  if new.colecao='clientes' and not new.excluido
    and (tg_op='INSERT' or (tg_op='UPDATE' and old.excluido)) and v_limites.limite_clientes is not null then
    select count(*) into v_qtd from public.dados where conta_id=new.conta_id and colecao='clientes' and not excluido;
    if v_qtd>=v_limites.limite_clientes then raise exception 'LIMITE_CLIENTES' using errcode='P0001'; end if;
  end if;
  if new.colecao='servicos' and not new.excluido
    and (tg_op='INSERT' or (tg_op='UPDATE' and old.excluido)) and v_limites.limite_servicos_mes is not null then
    select coalesce(sum(servicos_criados),0) into v_qtd from public.uso_diario
      where conta_id=new.conta_id and dia>=date_trunc('month',current_date)::date
      and dia<(date_trunc('month',current_date)+interval '1 month')::date;
    if v_qtd>=v_limites.limite_servicos_mes then raise exception 'LIMITE_SERVICOS_MES' using errcode='P0001'; end if;
  end if;
  if new.colecao='servicos' and not new.excluido and coalesce(new.dados->>'status','')<>'cancelado' and v_validar_agenda then
    v_prof:=nullif(new.dados->>'profissionalId','');
    if v_prof is not null and (new.dados->>'data') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and (new.dados->>'hora') ~ '^[0-9]{2}:[0-9]{2}$' then
      v_dur:=case when coalesce(new.dados->>'duracaoMin','') ~ '^[0-9]+$'
        then greatest(1,least(1440,(new.dados->>'duracaoMin')::integer)) else 60 end;
      if not exists(select 1 from public.dados where conta_id=new.conta_id and colecao='profissionais' and id=v_prof and not excluido) then
        if tg_op='INSERT' then raise exception 'PROFISSIONAL_INVALIDO' using errcode='P0001'; end if;
        if nullif(old.dados->>'profissionalId','') is distinct from v_prof then raise exception 'PROFISSIONAL_INVALIDO' using errcode='P0001'; end if;
      elsif not private.profissional_disponivel(new.conta_id,v_prof,(new.dados->>'data')::date,new.dados->>'hora',v_dur) then
        raise exception 'PROFISSIONAL_INDISPONIVEL' using errcode='P0001';
      end if;
      select coalesce((dados->>'atendimentoSimultaneo')::boolean,false) into v_simultaneo
      from public.dados where conta_id=new.conta_id and colecao='profissionais' and id=v_prof and not excluido;
      if not coalesce(v_simultaneo,false) then
        perform pg_advisory_xact_lock(hashtextextended(new.conta_id::text||':'||v_prof,0));
        v_dur:=case when coalesce(new.dados->>'duracaoMin','') ~ '^[0-9]+$'
          then greatest(1,least(1440,(new.dados->>'duracaoMin')::integer)) else 60 end;
        v_inicio:=(new.dados->>'data')::date + (new.dados->>'hora')::time;
        v_fim:=v_inicio + v_dur*interval '1 minute';
        if exists(
          select 1 from public.dados d
          where d.conta_id=new.conta_id and d.colecao='servicos' and not d.excluido and d.id<>new.id
            and coalesce(d.dados->>'status','')<>'cancelado' and nullif(d.dados->>'profissionalId','')=v_prof
            and (d.dados->>'data') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and (d.dados->>'hora') ~ '^[0-9]{2}:[0-9]{2}$'
            and ((d.dados->>'data')::date + (d.dados->>'hora')::time) < v_fim
            and v_inicio < ((d.dados->>'data')::date + (d.dados->>'hora')::time
              + (case when coalesce(d.dados->>'duracaoMin','') ~ '^[0-9]+$'
                 then greatest(1,least(1440,(d.dados->>'duracaoMin')::integer)) else 60 end)*interval '1 minute')
        ) then raise exception 'CONFLITO_PROFISSIONAL' using errcode='P0001'; end if;
      end if;
    end if;
  end if;
  return new;
end $$;
