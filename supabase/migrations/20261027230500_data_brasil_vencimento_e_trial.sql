-- Faturamento e trial em data civil brasileira, sem diferenca de um dia apos 21h BRT.
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
    values(v_nome,v_plano,'trial',(now() at time zone 'America/Sao_Paulo')::date+v_dias)
    returning id into v_conta;
  insert into public.membros(conta_id,user_id,papel)
    values(v_conta,new.id,'dono');

  return new;
end $$;

create or replace function private.atualizar_status(p_conta uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_gratis uuid;v_tolerancia integer;
begin
  select id into v_gratis from public.planos where nome='Grátis' and ativo limit 1;
  if v_gratis is null then raise exception 'Plano Grátis indisponível'; end if;
  select greatest(coalesce((valor #>> '{}')::integer,10),0) into v_tolerancia
    from public.config_sistema where chave='dias_tolerancia';
  v_tolerancia:=coalesce(v_tolerancia,10);
  update public.contas set plano_id=v_gratis,status_assinatura='ativa',
      preco_acordado_centavos=0,proximo_vencimento=null
    where (p_conta is null or id=p_conta) and status_assinatura='trial' and trial_ate<(now() at time zone 'America/Sao_Paulo')::date;
  update public.contas c set status_assinatura='atrasada'
    where (p_conta is null or c.id=p_conta) and status_assinatura='ativa'
      and c.proximo_vencimento<(now() at time zone 'America/Sao_Paulo')::date
      and exists(select 1 from public.planos p where p.id=c.plano_id and p.preco_mensal_centavos>0);
  update public.contas c set status_assinatura='bloqueada'
    where (p_conta is null or c.id=p_conta) and status_assinatura='atrasada'
      and c.proximo_vencimento+v_tolerancia<(now() at time zone 'America/Sao_Paulo')::date
      and exists(select 1 from public.planos p where p.id=c.plano_id and p.preco_mensal_centavos>0);
end $$;

create or replace function public.console_acao_conta(p_conta uuid,p_acao text,p_valor text default '')
returns void language plpgsql security definer set search_path='' as $$
declare v_plano uuid;v_preco integer;v_dias integer;v_anterior public.contas%rowtype;
begin
  perform private.console_exigir_admin();
  select * into v_anterior from public.contas where id=p_conta for update;
  if not found then raise exception 'Conta não encontrada';end if;
  if p_acao='plano' then
    begin v_plano:=p_valor::uuid; exception when invalid_text_representation then raise exception 'Plano inválido'; end;
    select preco_mensal_centavos into v_preco from public.planos where id=v_plano and ativo;
    if not found then raise exception 'Plano inativo ou inexistente';end if;
    update public.contas set
      plano_id=v_plano,preco_acordado_centavos=v_preco,
      status_assinatura=case
        when v_anterior.status_assinatura='trial' then 'ativa'
        else v_anterior.status_assinatura end,
      proximo_vencimento=case
        when v_preco=0 then null
        when v_anterior.proximo_vencimento is null and v_anterior.status_assinatura in ('trial','ativa')
          then ((now() at time zone 'America/Sao_Paulo')::date + interval '1 month')::date
        else v_anterior.proximo_vencimento end,
      trial_ate=case when v_anterior.status_assinatura='trial' then null else trial_ate end
      where id=p_conta;
  elsif p_acao='estender' then
    v_dias:=p_valor::integer;
    if v_dias not in (7,14,30) then raise exception 'Extensão inválida';end if;
    update public.contas set trial_ate=greatest(coalesce(trial_ate,(now() at time zone 'America/Sao_Paulo')::date),(now() at time zone 'America/Sao_Paulo')::date)+v_dias,
      status_assinatura='trial' where id=p_conta;
  elsif p_acao='bloquear' then
    update public.contas set status_assinatura='bloqueada' where id=p_conta;
  elsif p_acao='desbloquear' then
    update public.contas set status_assinatura=case when proximo_vencimento<(now() at time zone 'America/Sao_Paulo')::date
      then 'atrasada' else 'ativa' end where id=p_conta;
  elsif p_acao='cancelar' then
    update public.contas set status_assinatura='cancelada' where id=p_conta;
  else raise exception 'Ação não permitida'; end if;
end $$;

create or replace function public.console_registrar_pagamento(
 p_conta uuid,p_valor integer,p_referencia text,p_forma text,
 p_pago_em timestamptz default now(),p_observacao text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_preco integer;
begin
 perform private.console_exigir_admin();
 if p_valor is null or p_valor<=0 then raise exception 'Valor inválido';end if;
 if p_referencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Referência inválida';end if;
 if trim(coalesce(p_forma,''))='' then raise exception 'Forma obrigatória';end if;
 if p_pago_em>now()+interval '1 day' then raise exception 'Data futura inválida';end if;
 perform 1 from public.contas where id=p_conta for update;
 if not found then raise exception 'Conta não encontrada';end if;
 if exists(select 1 from public.pagamentos where conta_id=p_conta and referencia=p_referencia and status='pago')
   then raise exception 'Esta referência já possui pagamento confirmado';end if;
 insert into public.pagamentos(conta_id,valor_centavos,referencia,status,forma,pago_em,observacao,criado_por)
 values(p_conta,p_valor,p_referencia,'pago',left(p_forma,80),coalesce(p_pago_em,now()),nullif(trim(p_observacao),''),auth.uid())
 returning id into v_id;
 update public.contas set status_assinatura='ativa',
   proximo_vencimento=(greatest(coalesce(proximo_vencimento,(now() at time zone 'America/Sao_Paulo')::date),(now() at time zone 'America/Sao_Paulo')::date)+interval '1 month')::date
 where id=p_conta;
 return v_id;
end $$;
