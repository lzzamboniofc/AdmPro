-- Ajustes financeiros devem aparecer na auditoria também por empresa.
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
  when tg_table_name in ('pagamentos','pagamentos_ajustes','feedbacks','notas_conta') then
    coalesce((v_new->>'conta_id')::uuid,(v_old->>'conta_id')::uuid)
  else null end;
 v_id:=coalesce(v_new->>'id',v_old->>'id',v_new->>'chave',v_old->>'chave',v_new->>'user_id',v_old->>'user_id');
 insert into public.auditoria(admin_id,acao,entidade,entidade_id,conta_id,antes,depois)
 values(auth.uid(),lower(tg_op),tg_table_name,v_id,v_conta,v_old,v_new);
 return coalesce(new,old);
end $$;
-- Retirar deleção direta: o painel usa cancelamento/estorno com trilha permanente.
revoke delete on public.pagamentos from authenticated;