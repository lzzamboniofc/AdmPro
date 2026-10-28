-- Garantir que o filtro de modelos não dependa da RLS administrativa.
create or replace function private.aviso_e_modelo_automatico(p_aviso uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.automacoes_alerta where aviso_id=p_aviso);
$$;
revoke all on function private.aviso_e_modelo_automatico(uuid) from public,anon;
grant execute on function private.aviso_e_modelo_automatico(uuid) to authenticated;
drop policy if exists avisos_ler on public.avisos;
create policy avisos_ler on public.avisos for select to authenticated
using ((select public.is_admin()) or (
  ativo and inicio <= now() and (fim is null or fim >= now())
  and not private.aviso_e_modelo_automatico(id)
  and (publico='todos' or exists (
    select 1 from public.contas c where (select public.eh_membro(c.id))
      and (publico=c.id::text or publico=c.status_assinatura)
  ))
));