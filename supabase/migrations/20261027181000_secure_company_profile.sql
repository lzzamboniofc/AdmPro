-- Separa configuração operacional da empresa de assinatura/plano.
create or replace function public.atualizar_dados_empresa(
  p_conta uuid,
  p_nome_negocio text default null,
  p_modelo_negocio text default null,
  p_tipo_negocio text default null,
  p_telefone text default null,
  p_cidade text default null,
  p_uf text default null
) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.tem_permissao(p_conta,'config.editar') then
    raise exception 'SEM_PERMISSAO' using errcode='42501';
  end if;
  update public.contas
     set nome_negocio=coalesce(nullif(trim(p_nome_negocio),''),nome_negocio),
         modelo_negocio=case when p_modelo_negocio is null then modelo_negocio else left(trim(p_modelo_negocio),80) end,
         tipo_negocio=case when p_tipo_negocio is null then tipo_negocio else left(trim(p_tipo_negocio),80) end,
         telefone=case when p_telefone is null then telefone else left(trim(p_telefone),40) end,
         cidade=case when p_cidade is null then cidade else left(trim(p_cidade),100) end,
         uf=case when p_uf is null then uf else upper(left(trim(p_uf),2)) end
   where id=p_conta;
  if not found then raise exception 'CONTA_NAO_ENCONTRADA'; end if;
  perform private.auditar_empresa(p_conta,'atualizar','conta',p_conta::text,
    jsonb_build_object('campos',jsonb_strip_nulls(jsonb_build_object(
      'nome_negocio',p_nome_negocio,'modelo_negocio',p_modelo_negocio,'tipo_negocio',p_tipo_negocio,
      'telefone',p_telefone,'cidade',p_cidade,'uf',p_uf
    ))));
end $$;

revoke all on function public.atualizar_dados_empresa(uuid,text,text,text,text,text,text) from public,anon;
grant execute on function public.atualizar_dados_empresa(uuid,text,text,text,text,text,text) to authenticated;

drop policy if exists contas_atualizar on public.contas;
create policy contas_atualizar on public.contas for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
