-- Recepção não pode criar lançamentos financeiros arbitrários.
-- Recebimentos de parcelas são transacionais e gerados exclusivamente pelo servidor.
create or replace function public.pode_inserir_dado(p_conta uuid,p_colecao text,p_id text,p_dados jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if not public.eh_membro(p_conta) then return false; end if;
 if p_colecao='config' then return public.tem_permissao(p_conta,'config.editar'); end if;
 if p_colecao='catalogo' then return public.tem_permissao(p_conta,'catalogo.editar'); end if;
 if p_colecao='profissionais' then return public.tem_permissao(p_conta,'equipe.editar'); end if;
 if p_colecao='clientes' then return public.tem_permissao(p_conta,'clientes.editar'); end if;
 if p_colecao='servicos' then return public.tem_permissao(p_conta,'agenda.editar'); end if;
 if p_colecao='lancamentos' then return public.tem_permissao(p_conta,'financeiro.editar'); end if;
 if p_colecao='despesasFixas' then return public.tem_permissao(p_conta,'financeiro.editar'); end if;
 if p_colecao='movimentacoesEstoque' then return public.tem_permissao(p_conta,'estoque.editar'); end if;
 return false;
end $$;

create or replace function public.registrar_recebimento_atendimento(
 p_conta uuid,p_servico_id text,p_parcelas text[],p_data date,p_forma text,
 p_receber_tudo boolean default false
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v public.dados%rowtype; par jsonb; nova jsonb:='[]'::jsonb; srv jsonb;
 valor numeric; mov_id text; qtd integer:=0; esperadas integer; marcas integer:=0;
 destino_status text; anterior_status text; atualizado timestamptz;
begin
 if (select auth.uid()) is null or not (
   public.tem_permissao(p_conta,'financeiro.receber') or public.tem_permissao(p_conta,'financeiro.editar')
 ) then raise exception 'SEM_PERMISSAO' using errcode='42501'; end if;
 if p_forma not in ('pix','dinheiro','cartao','boleto','transferencia') or p_forma is null
   then raise exception 'FORMA_PAGAMENTO_INVALIDA'; end if;
 if p_data is null then raise exception 'DATA_PAGAMENTO_INVALIDA'; end if;
 if p_parcelas is null or cardinality(p_parcelas)=0 or cardinality(p_parcelas)>100 or
    exists(select 1 from unnest(p_parcelas) x where x is null or trim(x)='')
   then raise exception 'PARCELAS_INVALIDAS'; end if;
 select * into v from public.dados
   where conta_id=p_conta and colecao='servicos' and id=p_servico_id and not excluido
   for update;
 if not found then raise exception 'ATENDIMENTO_NAO_ENCONTRADO'; end if;
 srv:=v.dados;anterior_status:=coalesce(srv->>'status','');
 if anterior_status='cancelado' then raise exception 'ATENDIMENTO_CANCELADO'; end if;
 if jsonb_typeof(srv->'parcelas')<>'array' then raise exception 'PARCELAS_INVALIDAS'; end if;
 select count(*) into esperadas from jsonb_array_elements(srv->'parcelas') e
   where e->>'id'=any(p_parcelas);
 if esperadas<>(select count(distinct x) from unnest(p_parcelas) x)
   then raise exception 'PARCELA_NAO_ENCONTRADA'; end if;
 for par in select value from jsonb_array_elements(srv->'parcelas') loop
   if par->>'id'=any(p_parcelas) and not coalesce((par->>'pago')::boolean,false) then
     begin valor:=(par->>'valor')::numeric; exception when others then
       raise exception 'VALOR_PARCELA_INVALIDO'; end;
     if valor is null or valor<=0 then raise exception 'VALOR_PARCELA_INVALIDO'; end if;
     if exists(select 1 from public.dados l where l.conta_id=p_conta
       and l.colecao='lancamentos' and not l.excluido
       and l.dados->>'servicoId'=p_servico_id and l.dados->>'parcelaId'=par->>'id'
       and l.dados->>'tipo'='entrada') then
       raise exception 'RECEBIMENTO_INCONSISTENTE'; end if;
     mov_id:=gen_random_uuid()::text;
     insert into public.dados(conta_id,colecao,id,dados,excluido,atualizado_em)
     values(p_conta,'lancamentos',mov_id,
       jsonb_build_object('id',mov_id,'tipo','entrada',
         'descricao','Recebimento: '||coalesce(srv->>'titulo','Atendimento'),
         'valor',valor,'data',p_data::text,'categoria','Serviços',
         'formaPagamento',p_forma,'servicoId',p_servico_id,'parcelaId',par->>'id'),
       false,clock_timestamp());
     par:=par||jsonb_build_object('pago',true,'pagoEm',p_data::text,
       'formaPagamento',p_forma,'lancamentoId',mov_id);
     qtd:=qtd+1;
   end if;
   nova:=nova||jsonb_build_array(par);
 end loop;
 if qtd=0 then return jsonb_build_object('registrados',0,'atualizado_em',v.atualizado_em); end if;
 srv:=jsonb_set(srv,'{parcelas}',nova,true);
 destino_status:=anterior_status;
 if p_receber_tudo and anterior_status not in ('concluido','pago') then
   destino_status:='concluido';
   srv:=jsonb_set(srv,'{historico}',coalesce(srv->'historico','[]'::jsonb)||
     jsonb_build_array(jsonb_build_object('status','concluido','em',clock_timestamp())),true);
 end if;
 if jsonb_array_length(nova)>0 and not exists(
   select 1 from jsonb_array_elements(nova) x where not coalesce((x->>'pago')::boolean,false)
 ) then
   if destino_status<>'pago' then
     destino_status:='pago';
     srv:=jsonb_set(srv,'{historico}',coalesce(srv->'historico','[]'::jsonb)||
       jsonb_build_array(jsonb_build_object('status','pago','em',clock_timestamp())),true);
   end if;
 end if;
 if destino_status<>anterior_status then srv:=jsonb_set(srv,'{status}',to_jsonb(destino_status),true); end if;
 if anterior_status not in ('concluido','pago') and destino_status in ('concluido','pago') then
   srv:=private.aplicar_estoque_servico(p_conta,p_servico_id,srv,true);
   srv:=private.gerar_recorrencia_servico(p_conta,p_servico_id,srv);
 end if;
 perform set_config('admpro.operacao_sistema','1',true);
 update public.dados set dados=srv,atualizado_em=clock_timestamp()
 where conta_id=p_conta and colecao='servicos' and id=p_servico_id
 returning atualizado_em into atualizado;
 perform set_config('admpro.operacao_sistema','0',true);
 perform private.auditar_empresa(p_conta,'receber','servico',p_servico_id,
    jsonb_build_object('parcelas',p_parcelas,'quantidade',qtd));
 return jsonb_build_object('registrados',qtd,'atualizado_em',atualizado);
exception when others then
 perform set_config('admpro.operacao_sistema','0',true);
 raise;
end $$;

revoke all on function public.registrar_recebimento_atendimento(uuid,text,text[],date,text,boolean) from public,anon;
grant execute on function public.registrar_recebimento_atendimento(uuid,text,text[],date,text,boolean) to authenticated;