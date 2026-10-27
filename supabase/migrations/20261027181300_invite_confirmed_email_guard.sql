-- Confirmação obrigatória de e-mail e proteção contra convite antigo
-- que sobrescreva o papel de um integrante ativo.
create or replace function public.aceitar_convite(p_convite uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.convites_membros%rowtype; v_email text; v_limite integer; v_ativos integer; v_confirmado boolean;
begin
  if (select auth.uid()) is null then raise exception 'AUTENTICACAO_OBRIGATORIA' using errcode='28000'; end if;
  select lower(email),(email_confirmed_at is not null) into v_email,v_confirmado
  from auth.users where id=(select auth.uid());
  if not coalesce(v_confirmado,false) then raise exception 'EMAIL_NAO_CONFIRMADO' using errcode='42501'; end if;
  select * into v from public.convites_membros where id=p_convite for update;
  if not found or v.aceito_em is not null or v.cancelado_em is not null then raise exception 'CONVITE_INVALIDO'; end if;
  if v.expira_em<=now() then raise exception 'CONVITE_EXPIRADO'; end if;
  if lower(v.email)<>v_email then raise exception 'CONVITE_OUTRO_EMAIL' using errcode='42501'; end if;

  -- Um convite antigo nunca deve rebaixar nem substituir um membro ativo,
  -- sobretudo o proprietário.
  if exists(select 1 from public.membros where conta_id=v.conta_id
    and user_id=(select auth.uid()) and ativo) then
    raise exception 'USUARIO_JA_MEMBRO' using errcode='42501';
  end if;

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
