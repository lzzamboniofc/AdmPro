-- Após os dias de teste, rebaixar para o Easy gratuito (plano ativo).
-- Evita erro NOT NULL em contas.plano_id quando o plano legado
-- "Gratuito" não existe mais.
create or replace function private.atualizar_status(p_conta uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_easy uuid; v_tolerancia int;
begin
  select id into v_easy from public.planos
    where lower(nome)='easy' and ativo=true
    order by ordem,id limit 1;
  if v_easy is null then
    raise exception 'Plano Easy ativo não encontrado para encerrar o teste';
  end if;

  select greatest(coalesce((valor #>> '{}')::int,10),0) into v_tolerancia
    from public.config_sistema where chave='dias_tolerancia';
  v_tolerancia:=coalesce(v_tolerancia,10);

  update public.contas
    set plano_id=v_easy,status_assinatura='ativa',proximo_vencimento=null
    where (p_conta is null or id=p_conta)
      and status_assinatura='trial' and trial_ate<current_date;

  update public.contas set status_assinatura='atrasada'
    where (p_conta is null or id=p_conta)
      and status_assinatura='ativa' and proximo_vencimento<current_date;

  update public.contas set status_assinatura='bloqueada'
    where (p_conta is null or id=p_conta)
      and status_assinatura='atrasada' and proximo_vencimento+v_tolerancia<current_date;
end $$;
