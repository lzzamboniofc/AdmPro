-- Planos oficiais AdmPro: preservar IDs e contratos existentes.
update public.planos set nome='Grátis',preco_mensal_centavos=0,limite_clientes=5,
  limite_servicos_mes=10,ativo=true,ordem=0,recursos=coalesce(recursos,'{}'::jsonb)-'preco_pendente'
where lower(nome) in ('free','grátis','gratis');
insert into public.planos(nome,preco_mensal_centavos,limite_clientes,limite_servicos_mes,ativo,ordem,recursos)
values ('Grátis',0,5,10,true,0,'{}'::jsonb) on conflict(nome) do update
set preco_mensal_centavos=0,limite_clientes=5,limite_servicos_mes=10,ativo=true,ordem=0;
insert into public.planos(nome,preco_mensal_centavos,limite_clientes,limite_servicos_mes,ativo,ordem,recursos)
values ('Easy',1499,15,25,true,1,'{}'::jsonb) on conflict(nome) do update
set preco_mensal_centavos=1499,limite_clientes=15,limite_servicos_mes=25,ativo=true,ordem=1,
recursos=coalesce(public.planos.recursos,'{}'::jsonb)-'preco_pendente';
insert into public.planos(nome,preco_mensal_centavos,limite_clientes,limite_servicos_mes,ativo,ordem,recursos)
values ('Pro',2199,50,60,true,2,'{}'::jsonb) on conflict(nome) do update
set preco_mensal_centavos=2199,limite_clientes=50,limite_servicos_mes=60,ativo=true,ordem=2,
recursos=coalesce(public.planos.recursos,'{}'::jsonb)-'preco_pendente';
insert into public.planos(nome,preco_mensal_centavos,limite_clientes,limite_servicos_mes,ativo,ordem,recursos)
values ('Pro+',2999,null,null,true,3,'{}'::jsonb) on conflict(nome) do update
set preco_mensal_centavos=2999,limite_clientes=null,limite_servicos_mes=null,ativo=true,ordem=3,
recursos=coalesce(public.planos.recursos,'{}'::jsonb)-'preco_pendente';
-- Cadastro antigo em teste no Free passa a experimentar Easy sem perder a data original.
update public.contas c set plano_id=(select id from public.planos where nome='Easy')
where c.status_assinatura='trial'
  and c.plano_id=(select id from public.planos where nome='Grátis');

-- Encerramento do teste: entrar no Grátis, nunca deixar Easy pago sem pagamento.
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
  update public.contas set status_assinatura='atrasada'
    where (p_conta is null or id=p_conta) and status_assinatura='ativa'
      and proximo_vencimento<current_date;
  update public.contas set status_assinatura='bloqueada'
    where (p_conta is null or id=p_conta) and status_assinatura='atrasada'
      and proximo_vencimento+v_tolerancia<current_date;
end $$;

-- A troca administrativa de plano precisa efetivar as permissões e não ser revertida no teste.
create or replace function public.console_acao_conta(p_conta uuid,p_acao text,p_valor text default '')
returns void language plpgsql security definer set search_path='' as $$
declare v_plano uuid;v_preco integer;v_dias integer;v_anterior public.contas%rowtype;
begin
  perform private.console_exigir_admin();
  select * into v_anterior from public.contas where id=p_conta for update;
  if not found then raise exception 'Conta não encontrada';end if;
  if p_acao='plano' then
    begin v_plano:=p_valor::uuid; exception when invalid_text_representation then raise exception 'Plano inválido'; end;
    select preco_mensal_centavos into v_preco from public.planos where id=v_plano and ativo;
    if not found then raise exception 'Plano inativo ou inexistente';end if;
    update public.contas set
      plano_id=v_plano,preco_acordado_centavos=v_preco,
      status_assinatura=case
        when v_anterior.status_assinatura='trial' then 'ativa'
        else v_anterior.status_assinatura end,
      proximo_vencimento=case
        when v_preco=0 then null
        when v_anterior.proximo_vencimento is null and v_anterior.status_assinatura in ('trial','ativa')
          then (current_date + interval '1 month')::date
        else v_anterior.proximo_vencimento end,
      trial_ate=case when v_anterior.status_assinatura='trial' then null else trial_ate end
      where id=p_conta;
  elsif p_acao='estender' then
    v_dias:=p_valor::integer;
    if v_dias not in (7,14,30) then raise exception 'Extensão inválida';end if;
    update public.contas set trial_ate=greatest(coalesce(trial_ate,current_date),current_date)+v_dias,
      status_assinatura='trial' where id=p_conta;
  elsif p_acao='bloquear' then
    update public.contas set status_assinatura='bloqueada' where id=p_conta;
  elsif p_acao='desbloquear' then
    update public.contas set status_assinatura=case when proximo_vencimento<current_date
      then 'atrasada' else 'ativa' end where id=p_conta;
  elsif p_acao='cancelar' then
    update public.contas set status_assinatura='cancelada' where id=p_conta;
  else raise exception 'Ação não permitida'; end if;
end $$;
revoke all on function public.console_acao_conta(uuid,text,text) from public,anon;
grant execute on function public.console_acao_conta(uuid,text,text) to authenticated;

-- Estorno e cancelamento são registros contábeis; pagamentos não são apagados.
alter table public.pagamentos drop constraint if exists pagamentos_status_check;
alter table public.pagamentos add constraint pagamentos_status_check
  check(status in ('pendente','pago','cancelado','estornado'));
create table if not exists public.pagamentos_ajustes (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid not null references public.pagamentos(id) on delete restrict,
  conta_id uuid not null references public.contas(id) on delete restrict,
  acao text not null check(acao in ('cancelar','estornar')),
  valor_centavos integer not null check(valor_centavos>0),
  motivo text not null check(length(trim(motivo)) between 5 and 1500),
  registrado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  unique(pagamento_id)
);
create index if not exists pagamentos_ajustes_conta_idx on public.pagamentos_ajustes(conta_id,criado_em desc);
alter table public.pagamentos_ajustes enable row level security;
revoke all on public.pagamentos_ajustes from public,anon,authenticated;
grant select on public.pagamentos_ajustes to authenticated;
create policy pagamentos_ajustes_admin_ler on public.pagamentos_ajustes
 for select to authenticated using ((select public.is_admin()));
drop trigger if exists console_auditoria_trigger on public.pagamentos_ajustes;
create trigger console_auditoria_trigger after insert or update or delete on public.pagamentos_ajustes
 for each row execute function private.console_auditar();

create or replace function public.console_ajustar_pagamento(p_pagamento uuid,p_acao text,p_motivo text)
returns text language plpgsql security definer set search_path='' as $$
declare v_pagamento public.pagamentos%rowtype;
begin
  perform private.console_exigir_admin();
  if p_acao not in ('cancelar','estornar') then raise exception 'Ação inválida';end if;
  if length(trim(coalesce(p_motivo,''))) not between 5 and 1500
    then raise exception 'Informe o motivo (5 a 1500 caracteres)'; end if;
  select * into v_pagamento from public.pagamentos where id=p_pagamento for update;
  if not found then raise exception 'Pagamento não encontrado';end if;
  if v_pagamento.status not in ('pago','pendente') then
    raise exception 'Este pagamento já foi ajustado'; end if;
  if p_acao='estornar' and v_pagamento.status<>'pago' then
    raise exception 'Somente pagamentos recebidos podem ser estornados'; end if;
  insert into public.pagamentos_ajustes(
    pagamento_id,conta_id,acao,valor_centavos,motivo,registrado_por)
  values(v_pagamento.id,v_pagamento.conta_id,p_acao,v_pagamento.valor_centavos,trim(p_motivo),auth.uid());
  update public.pagamentos set status=case when p_acao='estornar' then 'estornado' else 'cancelado' end
    where id=v_pagamento.id;
  -- Não altera automaticamente a próxima cobrança: outros pagamentos/acordos
  -- podem existir. Administrador deve rever a assinatura separadamente.
  return case when p_acao='estornar' then
    'Estorno registrado no AdmPro. A devolução real deve ser efetuada no meio de pagamento.'
    else 'Registro cancelado sem exclusão do histórico.' end;
end $$;
revoke all on function public.console_ajustar_pagamento(uuid,text,text) from public,anon;
grant execute on function public.console_ajustar_pagamento(uuid,text,text) to authenticated;

create or replace function public.console_pagamentos(p_aba text default 'pago',p_mes text default '',p_pagina integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
 perform private.console_exigir_admin();
 if p_aba not in ('pago','pendente','atrasado','estornado','cancelado') then raise exception 'Aba inválida';end if;
 if coalesce(p_mes,'')<>'' and p_mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Mês inválido';end if;
 with f as (select p.*,c.nome_negocio,c.telefone
    from public.pagamentos p join public.contas c on c.id=p.conta_id
    where (case when p_aba='atrasado' then p.status='pendente'
      and (p.referencia<to_char(current_date,'YYYY-MM') or c.proximo_vencimento<current_date)
      else p.status=p_aba end)
    and (coalesce(p_mes,'')='' or p.referencia=p_mes)),
 pg as (select * from f order by criado_em desc,id limit 25 offset (greatest(1,coalesce(p_pagina,1))-1)*25)
 select jsonb_build_object('total',(select count(*) from f),
   'total_centavos',(select coalesce(sum(valor_centavos),0) from f),
   'itens',coalesce((select jsonb_agg(to_jsonb(pg)) from pg),'[]'::jsonb)) into v;
 return v;
end $$;
revoke all on function public.console_pagamentos(text,text,integer) from public,anon;
grant execute on function public.console_pagamentos(text,text,integer) to authenticated;
