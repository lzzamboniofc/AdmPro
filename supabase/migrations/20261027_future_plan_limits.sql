-- Limites comerciais futuros. Todos permanecem inativos enquanto as colunas forem NULL.
-- A migration apenas prepara a aplicação para respeitar limites quando configurados no banco/Console.

create or replace function public.criar_convite(
 p_conta uuid,p_email text,p_papel text,p_profissional_id text default null,p_permissoes jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_email text; v_limite integer; v_ocupados integer;
begin
  if not public.tem_permissao(p_conta,'convites.gerenciar') then raise exception 'SEM_PERMISSAO' using errcode='42501'; end if;
  if p_papel not in ('gerente','recepcionista','profissional') then raise exception 'PAPEL_INVALIDO'; end if;
  v_email:=lower(trim(coalesce(p_email,'')));
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'EMAIL_INVALIDO'; end if;
  if jsonb_typeof(coalesce(p_permissoes,'{}'::jsonb))<>'object' then raise exception 'PERMISSOES_INVALIDAS'; end if;

  perform 1 from public.contas where id=p_conta for update;
  if not found then raise exception 'CONTA_NAO_ENCONTRADA'; end if;

  if exists(select 1 from public.membros m join auth.users u on u.id=m.user_id
            where m.conta_id=p_conta and lower(u.email)=v_email and m.ativo) then
    raise exception 'USUARIO_JA_MEMBRO';
  end if;
  if p_profissional_id is not null and not exists(
    select 1 from public.dados where conta_id=p_conta and colecao='profissionais'
      and id=p_profissional_id and not excluido
  ) then raise exception 'PROFISSIONAL_INVALIDO'; end if;

  select p.limite_usuarios into v_limite
    from public.contas c join public.planos p on p.id=c.plano_id where c.id=p_conta;
  if v_limite is not null then
    select
      (select count(*) from public.membros where conta_id=p_conta and ativo)
      +(select count(*) from public.convites_membros
        where conta_id=p_conta and aceito_em is null and cancelado_em is null and expira_em>now())
    into v_ocupados;
    if v_ocupados>=v_limite then raise exception 'LIMITE_USUARIOS' using errcode='P0001'; end if;
  end if;

  insert into public.convites_membros(conta_id,email,papel,profissional_id,permissoes,criado_por)
  values(p_conta,v_email,p_papel,p_profissional_id,coalesce(p_permissoes,'{}'::jsonb),(select auth.uid()))
  returning id into v_id;
  perform private.auditar_empresa(p_conta,'criar','convite',v_id::text,jsonb_build_object('email',v_email,'papel',p_papel));
  return v_id;
end $$;

create or replace function public.aceitar_convite(p_convite uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.convites_membros%rowtype; v_email text; v_limite integer; v_ativos integer;
begin
  if (select auth.uid()) is null then raise exception 'AUTENTICACAO_OBRIGATORIA' using errcode='28000'; end if;
  select lower(email) into v_email from auth.users where id=(select auth.uid());
  select * into v from public.convites_membros where id=p_convite for update;
  if not found or v.aceito_em is not null or v.cancelado_em is not null then raise exception 'CONVITE_INVALIDO'; end if;
  if v.expira_em<=now() then raise exception 'CONVITE_EXPIRADO'; end if;
  if lower(v.email)<>v_email then raise exception 'CONVITE_OUTRO_EMAIL' using errcode='42501'; end if;

  perform 1 from public.contas where id=v.conta_id for update;
  select p.limite_usuarios into v_limite
    from public.contas c join public.planos p on p.id=c.plano_id where c.id=v.conta_id;
  if v_limite is not null then
    select count(*) into v_ativos from public.membros where conta_id=v.conta_id and ativo;
    if v_ativos>=v_limite and not exists(
      select 1 from public.membros where conta_id=v.conta_id and user_id=(select auth.uid()) and ativo
    ) then raise exception 'LIMITE_USUARIOS' using errcode='P0001'; end if;
  end if;

  insert into public.membros(conta_id,user_id,papel,profissional_id,permissoes,ativo)
  values(v.conta_id,(select auth.uid()),v.papel,v.profissional_id,v.permissoes,true)
  on conflict(conta_id,user_id) do update set
    papel=excluded.papel,profissional_id=excluded.profissional_id,permissoes=excluded.permissoes,
    ativo=true,atualizado_em=now();
  update public.convites_membros set aceito_em=now(),atualizado_em=now() where id=v.id;
  perform private.auditar_empresa(v.conta_id,'aceitar','convite',v.id::text,jsonb_build_object('papel',v.papel));
  return v.conta_id;
end $$;

revoke all on function public.criar_convite(uuid,text,text,text,jsonb),public.aceitar_convite(uuid) from public,anon;
grant execute on function public.criar_convite(uuid,text,text,text,jsonb),public.aceitar_convite(uuid) to authenticated;

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
  if new.colecao='profissionais' and not new.excluido
    and (tg_op='INSERT' or (tg_op='UPDATE' and old.excluido)) and v_limites.limite_profissionais is not null then
    select count(*) into v_qtd from public.dados
      where conta_id=new.conta_id and colecao='profissionais' and not excluido;
    if v_qtd>=v_limites.limite_profissionais then raise exception 'LIMITE_PROFISSIONAIS' using errcode='P0001'; end if;
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
