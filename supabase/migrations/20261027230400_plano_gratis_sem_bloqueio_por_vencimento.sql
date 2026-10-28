-- Conta no plano gratuito não possui vencimento recorrente.
update public.contas set proximo_vencimento=null
where status_assinatura='ativa'
  and plano_id=(select id from public.planos where nome='Grátis' limit 1);

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
    where (p_conta is null or id=p_conta) and status_assinatura='trial' and trial_ate<current_date;
  update public.contas c set status_assinatura='atrasada'
    where (p_conta is null or c.id=p_conta) and status_assinatura='ativa'
      and c.proximo_vencimento<current_date
      and exists(select 1 from public.planos p where p.id=c.plano_id and p.preco_mensal_centavos>0);
  update public.contas c set status_assinatura='bloqueada'
    where (p_conta is null or c.id=p_conta) and status_assinatura='atrasada'
      and c.proximo_vencimento+v_tolerancia<current_date
      and exists(select 1 from public.planos p where p.id=c.plano_id and p.preco_mensal_centavos>0);
end $$;