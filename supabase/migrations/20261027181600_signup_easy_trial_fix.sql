-- Corrige erro 500 no Supabase Auth: o trigger ainda exigia um plano
-- 'Gratuito' que deixou de existir. Os planos atuais são Easy e Pro.
-- O novo proprietário começa em Easy com o trial já configurado;
-- usuários convidados não recebem empresa automática.
create or replace function private.criar_conta_usuario()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_plano uuid;
  v_dias int;
  v_conta uuid;
  v_nome text;
begin
  if exists(select 1 from public.convites_membros
    where lower(email)=lower(coalesce(new.email,''))
      and aceito_em is null and cancelado_em is null and expira_em>now()) then
    return new;
  end if;

  select id into v_plano from public.planos
    where lower(nome)='easy' and ativo=true
    order by ordem,id limit 1;
  if v_plano is null then
    raise exception 'Plano Easy ativo não encontrado para cadastro';
  end if;

  select coalesce((valor #>> '{}')::int,14) into v_dias
    from public.config_sistema where chave='dias_teste';
  v_dias:=greatest(coalesce(v_dias,14),0);
  v_nome:=left(coalesce(nullif(trim(new.raw_user_meta_data->>'nome_negocio'),''),'Meu negócio'),150);

  insert into public.contas(nome_negocio,plano_id,status_assinatura,trial_ate)
    values(v_nome,v_plano,'trial',current_date+v_dias)
    returning id into v_conta;
  insert into public.membros(conta_id,user_id,papel)
    values(v_conta,new.id,'dono');

  return new;
end $$;
