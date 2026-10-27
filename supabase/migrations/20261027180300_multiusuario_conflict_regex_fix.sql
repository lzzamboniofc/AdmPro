-- Corrige validação de data/hora do bloqueio concorrente de agenda.
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
