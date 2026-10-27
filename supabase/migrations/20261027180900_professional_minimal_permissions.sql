-- Mantém o perfil profissional mínimo; catálogo só aparece quando concedido explicitamente.
create or replace function public.permissoes_membro(p_conta uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare m public.membros%rowtype; base jsonb;
begin
  if (select auth.uid()) is null then return '{}'::jsonb; end if;
  select * into m from public.membros where conta_id=p_conta and user_id=(select auth.uid()) and ativo;
  if not found then return '{}'::jsonb; end if;
  base := case m.papel
    when 'dono' then '{"equipe.ver":true,"equipe.editar":true,"convites.gerenciar":true,"agenda.ver_todas":true,"agenda.editar":true,"agenda.propria":true,"atendimentos.ver_todos":true,"atendimentos.proprios":true,"atendimentos.atualizar_proprios":true,"clientes.ver":true,"clientes.editar":true,"clientes.vinculados":true,"catalogo.ver":true,"catalogo.editar":true,"financeiro.ver":true,"financeiro.editar":true,"financeiro.receber":true,"estoque.ver":true,"estoque.editar":true,"relatorios.operacionais":true,"config.editar":true,"auditoria.ver":true,"assinatura.gerenciar":true}'::jsonb
    when 'gerente' then '{"equipe.ver":true,"equipe.editar":true,"convites.gerenciar":true,"agenda.ver_todas":true,"agenda.editar":true,"atendimentos.ver_todos":true,"clientes.ver":true,"clientes.editar":true,"catalogo.ver":true,"catalogo.editar":true,"estoque.ver":true,"estoque.editar":true,"relatorios.operacionais":true,"config.editar":true,"auditoria.ver":true}'::jsonb
    when 'recepcionista' then '{"equipe.ver":true,"agenda.ver_todas":true,"agenda.editar":true,"atendimentos.ver_todos":true,"clientes.ver":true,"clientes.editar":true,"catalogo.ver":true,"financeiro.receber":true}'::jsonb
    when 'profissional' then '{"agenda.propria":true,"atendimentos.proprios":true,"atendimentos.atualizar_proprios":true,"clientes.vinculados":true}'::jsonb
    else '{}'::jsonb
  end;
  return base || coalesce(m.permissoes,'{}'::jsonb);
end $$;
