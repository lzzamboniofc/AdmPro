-- Aplica validação server-side de jornada, pausas e bloqueios individuais.
-- Validação server-side da jornada individual e bloqueios do profissional.
create or replace function private.hora_minutos(p_hora text) returns integer
language plpgsql immutable set search_path='' as $$
begin
  if p_hora is null or p_hora !~ '^[0-9]{2}:[0-9]{2}$' then return null; end if;
  if split_part(p_hora,':',1)::integer not between 0 and 23
     or split_part(p_hora,':',2)::integer not between 0 and 59 then return null; end if;
  return split_part(p_hora,':',1)::integer*60 + split_part(p_hora,':',2)::integer;
exception when others then return null;
end $$;

create or replace function private.profissional_disponivel(
  p_conta uuid,p_profissional text,p_data date,p_hora text,p_duracao integer
) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare
  v_prof jsonb; v_config jsonb; v_semana jsonb; v_dia jsonb;
  v_dow integer; v_ini integer; v_fim integer; v_inicio_turno integer; v_fim_turno integer;
  a jsonb; t jsonb;
begin
  select d.dados into v_prof from public.dados d
   where d.conta_id=p_conta and d.colecao='profissionais' and d.id=p_profissional and not d.excluido;
  if v_prof is null then return false; end if;

  v_ini:=private.hora_minutos(p_hora);
  if v_ini is null then return false; end if;
  v_fim:=v_ini+greatest(1,least(coalesce(p_duracao,60),1440));
  if v_fim>1440 then return false; end if;

  for a in select value from jsonb_array_elements(coalesce(v_prof->'ausencias','[]'::jsonb)) loop
    if a->>'data'=p_data::text then
      v_inicio_turno:=coalesce(private.hora_minutos(a->>'inicio'),0);
      v_fim_turno:=coalesce(private.hora_minutos(a->>'fim'),1440);
      if v_ini<v_fim_turno and v_inicio_turno<v_fim then return false; end if;
    end if;
  end loop;

  v_semana:=v_prof->'horariosSemana';
  if v_semana is null or jsonb_typeof(v_semana)<>'array' or jsonb_array_length(v_semana)<>7 then
    select d.dados into v_config from public.dados d
     where d.conta_id=p_conta and d.colecao='config' and not d.excluido
     order by d.atualizado_em desc limit 1;
    v_semana:=v_config->'horariosSemana';
  end if;

  v_dow:=extract(dow from p_data)::integer;
  if v_semana is not null and jsonb_typeof(v_semana)='array' and jsonb_array_length(v_semana)=7 then
    v_dia:=v_semana->v_dow;
    if not coalesce((v_dia->>'ativo')::boolean,false) then return false; end if;
    for t in select value from jsonb_array_elements(coalesce(v_dia->'turnos','[]'::jsonb)) loop
      v_inicio_turno:=private.hora_minutos(t->>'inicio');
      v_fim_turno:=private.hora_minutos(t->>'fim');
      if v_inicio_turno is not null and v_fim_turno is not null
         and v_ini>=v_inicio_turno and v_fim<=v_fim_turno then return true; end if;
    end loop;
    return false;
  end if;

  -- Compatibilidade com configurações antigas, anteriores a horariosSemana.
  if v_config is null then
    select d.dados into v_config from public.dados d
     where d.conta_id=p_conta and d.colecao='config' and not d.excluido
     order by d.atualizado_em desc limit 1;
  end if;
  if v_config is not null and jsonb_typeof(v_config->'diasAtendimento')='array' then
    if not exists(
      select 1 from jsonb_array_elements_text(v_config->'diasAtendimento') x(valor)
      where x.valor::integer=v_dow
    ) then return false; end if;
    v_inicio_turno:=private.hora_minutos(v_config->>'horaInicio');
    v_fim_turno:=private.hora_minutos(v_config->>'horaFim');
    if v_inicio_turno is not null and v_fim_turno is not null then
      return v_ini>=v_inicio_turno and v_fim<=v_fim_turno;
    end if;
  end if;

  return true;
exception when others then
  return false;
end $$;
revoke all on function private.hora_minutos(text),private.profissional_disponivel(uuid,text,date,text,integer)
from public,anon,authenticated;

create or replace function private.validar_dado() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  v_conta public.contas%rowtype; v_limites public.planos%rowtype; v_qtd int;
  v_prof text; v_inicio timestamp; v_fim timestamp; v_dur integer; v_simultaneo boolean:=false;
begin
  select * into v_conta from public.contas where id=new.conta_id for update;
  if not found then raise exception 'Conta inválida'; end if;
  if v_conta.status_assinatura='bloqueada' then raise exception 'CONTA_BLOQUEADA' using errcode='P0001'; end if;
  select * into v_limites from public.planos where id=v_conta.plano_id;
  if tg_op='UPDATE' then
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
  if new.colecao='servicos' and not new.excluido and coalesce(new.dados->>'status','')<>'cancelado' then
    v_prof:=nullif(new.dados->>'profissionalId','');
    if v_prof is not null and (new.dados->>'data') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and (new.dados->>'hora') ~ '^[0-9]{2}:[0-9]{2}$' then
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
