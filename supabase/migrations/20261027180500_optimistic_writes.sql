-- Escritas otimistas: evita que uma edição baseada em versão antiga sobrescreva
-- alterações já salvas por outro usuário/dispositivo.
create or replace function public.salvar_dado_otimista(
  p_conta uuid,
  p_colecao text,
  p_id text,
  p_dados jsonb,
  p_excluido boolean,
  p_base_atualizado_em timestamptz default null,
  p_novo boolean default false
) returns timestamptz
language plpgsql security invoker set search_path='' as $$
declare
  v_agora timestamptz:=clock_timestamp();
  v_salvo timestamptz;
begin
  if p_novo then
    begin
      insert into public.dados(conta_id,colecao,id,dados,excluido,atualizado_em)
      values(p_conta,p_colecao,p_id,coalesce(p_dados,'{}'::jsonb),coalesce(p_excluido,false),v_agora)
      returning atualizado_em into v_salvo;
    exception when unique_violation then
      raise exception 'STALE_WRITE' using errcode='P0001';
    end;
  else
    if p_base_atualizado_em is null then
      raise exception 'STALE_WRITE' using errcode='P0001';
    end if;
    update public.dados
       set dados=coalesce(p_dados,'{}'::jsonb),
           excluido=coalesce(p_excluido,false),
           atualizado_em=v_agora
     where conta_id=p_conta and colecao=p_colecao and id=p_id
       and atualizado_em=p_base_atualizado_em
    returning atualizado_em into v_salvo;
    if not found then raise exception 'STALE_WRITE' using errcode='P0001'; end if;
  end if;
  return v_salvo;
end $$;

revoke all on function public.salvar_dado_otimista(uuid,text,text,jsonb,boolean,timestamptz,boolean)
from public,anon;
grant execute on function public.salvar_dado_otimista(uuid,text,text,jsonb,boolean,timestamptz,boolean)
to authenticated;
