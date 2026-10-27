-- Não exigir SELECT direto em public.contas para o funcionário gravar dados.
-- A verificação de assinatura continua do lado do servidor.
create or replace function public.conta_gravavel(p_conta uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.eh_membro(p_conta) and exists(
    select 1 from public.contas c
    where c.id=p_conta and c.status_assinatura<>'bloqueada'
  );
$$;
revoke all on function public.conta_gravavel(uuid) from public,anon;
grant execute on function public.conta_gravavel(uuid) to authenticated;

drop policy if exists dados_privados_inserir on public.dados;
create policy dados_privados_inserir on public.dados for insert to authenticated
with check(public.pode_inserir_dado(conta_id,colecao,id,dados)
  and public.conta_gravavel(conta_id));

drop policy if exists dados_privados_atualizar on public.dados;
create policy dados_privados_atualizar on public.dados for update to authenticated
using(public.pode_ler_dado(conta_id,colecao,id,dados))
with check(public.pode_atualizar_dado(conta_id,colecao,id,dados)
  and public.conta_gravavel(conta_id));