-- Não permitir que pagamento manual contorne aprovação do pedido de mudança de plano.

create or replace function public.console_acao_conta(p_conta uuid,p_acao text,p_valor text default '')
returns void language plpgsql security definer set search_path='' as $$
declare v_plano uuid;v_preco integer;v_dias integer;v_anterior public.contas%rowtype;
begin
  perform private.console_exigir_admin();
  select * into v_anterior from public.contas where id=p_conta for update;
  if not found then raise exception 'Conta não encontrada';end if;
  if p_acao='plano' then
    if exists(select 1 from public.pedidos_plano
       where conta_id=p_conta and status in ('aguardando_pagamento','em_analise')) then
      raise exception 'Existe pedido de Pix em aberto. Conclua ou recuse o pedido em Pagamentos antes de alterar este plano manualmente.';
    end if;
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
 if exists(select 1 from public.pedidos_plano
   where conta_id=p_conta and status in ('aguardando_pagamento','em_analise')) then
   raise exception 'Esta conta possui pedido de troca de plano via Pix. Confirme-o em Pagamentos > Solicitações de planos.';
 end if;
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

create or replace function private.console_auditar() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_old jsonb; v_new jsonb; v_conta uuid; v_id text;
begin
 if auth.uid() is null or not public.is_admin() then
   return coalesce(new,old);
 end if;
 if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new; end if;
 v_old:=case when tg_op <> 'INSERT' then to_jsonb(old) end;
 v_new:=case when tg_op <> 'DELETE' then to_jsonb(new) end;
 v_conta:=case when tg_table_name='contas' then coalesce((v_new->>'id')::uuid,(v_old->>'id')::uuid)
  when tg_table_name in ('pagamentos','pagamentos_ajustes','pedidos_plano','feedbacks','notas_conta') then
    coalesce((v_new->>'conta_id')::uuid,(v_old->>'conta_id')::uuid)
  else null end;
 v_id:=coalesce(v_new->>'id',v_old->>'id',v_new->>'chave',v_old->>'chave',v_new->>'user_id',v_old->>'user_id');
 insert into public.auditoria(admin_id,acao,entidade,entidade_id,conta_id,antes,depois)
 values(auth.uid(),lower(tg_op),tg_table_name,v_id,v_conta,v_old,v_new);
 return coalesce(new,old);
end $$;