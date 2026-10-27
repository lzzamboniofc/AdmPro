-- A recepção altera data, hora e atribuição, mas não modifica valores
-- ou parcelas já emitidas. Recebimentos passam exclusivamente pela RPC.
create or replace function private.proteger_valores_atendimento_recepcao()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if current_setting('admpro.operacao_sistema',true)='1' then return new; end if;
 if tg_op<>'UPDATE' or new.colecao<>'servicos' then return new; end if;
 if public.tem_permissao(new.conta_id,'financeiro.receber')
    and not public.tem_permissao(new.conta_id,'financeiro.editar') then
   if old.dados->'parcelas' is distinct from new.dados->'parcelas'
      or old.dados->'total' is distinct from new.dados->'total'
      or old.dados->'desconto' is distinct from new.dados->'desconto'
      or old.dados->'reciboNumero' is distinct from new.dados->'reciboNumero'
      or old.dados->'itens' is distinct from new.dados->'itens'
   then raise exception 'ALTERACAO_FINANCEIRA_NAO_AUTORIZADA' using errcode='42501';
   end if;
 end if;
 return new;
end $$;
drop trigger if exists dados_proteger_valores_recepcao on public.dados;
create trigger dados_proteger_valores_recepcao before update on public.dados
for each row execute function private.proteger_valores_atendimento_recepcao();
revoke all on function private.proteger_valores_atendimento_recepcao() from public,anon,authenticated;