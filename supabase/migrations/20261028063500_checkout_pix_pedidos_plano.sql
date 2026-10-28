
-- Checkout Pix com confirmação manual. O cliente nunca pode ativar o plano pago por conta própria.
create table if not exists public.pedidos_plano (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas(id) on delete cascade,
  solicitado_por uuid not null references auth.users(id),
  plano_origem_id uuid not null references public.planos(id),
  plano_destino_id uuid not null references public.planos(id),
  valor_centavos integer not null check(valor_centavos>0),
  status text not null default 'aguardando_pagamento'
    check(status in ('aguardando_pagamento','em_analise','aprovado','recusado','cancelado')),
  pix_chave text not null,
  pix_beneficiario text not null,
  declaracao_cliente text,
  motivo_recusa text,
  decidido_por uuid references auth.users(id),
  pagamento_id uuid references public.pagamentos(id),
  criado_em timestamptz not null default now(),
  declarado_em timestamptz,
  decidido_em timestamptz,
  atualizado_em timestamptz not null default now()
);
create unique index if not exists pedidos_plano_um_aberto
 on public.pedidos_plano(conta_id)
 where status in ('aguardando_pagamento','em_analise');
create index if not exists pedidos_plano_console_idx
 on public.pedidos_plano(status,criado_em desc);
create index if not exists pedidos_plano_conta_idx
 on public.pedidos_plano(conta_id,criado_em desc);
alter table public.pedidos_plano enable row level security;
revoke all on public.pedidos_plano from public,anon,authenticated;
grant select on public.pedidos_plano to authenticated;
drop policy if exists pedidos_plano_leitura on public.pedidos_plano;
create policy pedidos_plano_leitura on public.pedidos_plano for select to authenticated
using ((select public.is_admin()) or exists (
 select 1 from public.membros m where m.conta_id=pedidos_plano.conta_id
 and m.user_id=(select auth.uid()) and m.papel='dono' and m.ativo
));
-- Associação permanente 1:1 pagamento ↔ pedido aprovado.
alter table public.pagamentos add column if not exists pedido_plano_id uuid
 references public.pedidos_plano(id) on delete restrict;
drop index if exists public.pagamentos_pagos_conta_referencia_uniq;
create unique index if not exists pagamentos_pagos_manuais_referencia_uniq
  on public.pagamentos(conta_id,referencia)
  where status='pago' and pedido_plano_id is null;
create unique index if not exists pagamentos_pedido_plano_unico
  on public.pagamentos(pedido_plano_id) where pedido_plano_id is not null;

-- Todos os RPCs realizam validação de dono ativo; nenhum grant de INSERT/UPDATE direto.
create or replace function public.solicitar_troca_plano(p_conta uuid,p_plano uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_conta public.contas%rowtype;v_plano public.planos%rowtype;
v_pix text;v_beneficiario text;v_aberto public.pedidos_plano%rowtype;v_id uuid;
begin
 if auth.uid() is null or not exists (
   select 1 from public.membros where conta_id=p_conta and user_id=auth.uid()
    and papel='dono' and ativo
 ) then raise exception 'Somente o proprietário pode contratar planos.' using errcode='42501';end if;
 select * into v_conta from public.contas where id=p_conta for update;
 if not found then raise exception 'Empresa não encontrada';end if;
 if v_conta.status_assinatura in ('bloqueada','cancelada')
   then raise exception 'Contate o suporte para regularizar a conta antes de contratar.';end if;
 select * into v_plano from public.planos where id=p_plano and ativo;
 if not found or v_plano.preco_mensal_centavos<=0
   then raise exception 'Escolha um plano pago disponível.';end if;
 if p_plano=v_conta.plano_id and v_conta.status_assinatura='ativa'
   then raise exception 'Você já utiliza este plano. Para renovar, use o pagamento de sua assinatura.';end if;
 select * into v_aberto from public.pedidos_plano where conta_id=p_conta
  and status in ('aguardando_pagamento','em_analise') for update;
 if found then
   if v_aberto.plano_destino_id=p_plano then return v_aberto.id;end if;
   if v_aberto.status='em_analise' then
     raise exception 'Seu Pix já foi informado. Aguarde a análise antes de escolher outro plano.';end if;
   update public.pedidos_plano set status='cancelado',atualizado_em=now()
    where id=v_aberto.id;
 end if;
 select nullif(trim(valor #>> '{}'),'') into v_pix
   from public.config_sistema where chave='pix_chave';
 select nullif(trim(valor #>> '{}'),'') into v_beneficiario
   from public.config_sistema where chave='pix_nome_recebedor';
 if v_pix is null or v_beneficiario is null then
   raise exception 'Pagamento Pix ainda indisponível. Entre em contato com o suporte.';end if;
 if (select count(*) from public.pedidos_plano where conta_id=p_conta
      and criado_em>now()-interval '1 day')>=12 then
   raise exception 'Muitas solicitações em um dia. Tente novamente mais tarde.';end if;
 insert into public.pedidos_plano
  (conta_id,solicitado_por,plano_origem_id,plano_destino_id,valor_centavos,
   pix_chave,pix_beneficiario)
 values (p_conta,auth.uid(),v_conta.plano_id,p_plano,v_plano.preco_mensal_centavos,
   v_pix,v_beneficiario) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.solicitar_troca_plano(uuid,uuid) from public,anon;
grant execute on function public.solicitar_troca_plano(uuid,uuid) to authenticated;

create or replace function public.informar_pix_plano(p_pedido uuid,p_detalhes text default '')
returns void language plpgsql security definer set search_path='' as $$
declare v_pedido public.pedidos_plano%rowtype;
begin
 if auth.uid() is null then raise exception 'Faça login.' using errcode='28000';end if;
 select * into v_pedido from public.pedidos_plano where id=p_pedido for update;
 if not found or not exists(
   select 1 from public.membros where conta_id=v_pedido.conta_id
    and user_id=auth.uid() and papel='dono' and ativo
 ) then raise exception 'Pedido não autorizado.' using errcode='42501';end if;
 if v_pedido.status<>'aguardando_pagamento' then
   raise exception 'Este Pix já foi informado ou o pedido não está disponível.';end if;
 if length(coalesce(p_detalhes,''))>500 then
   raise exception 'Os detalhes devem ter até 500 caracteres.';end if;
 update public.pedidos_plano set status='em_analise',
   declaracao_cliente=nullif(trim(p_detalhes),''),
   declarado_em=now(),atualizado_em=now() where id=p_pedido;
end $$;
revoke all on function public.informar_pix_plano(uuid,text) from public,anon;
grant execute on function public.informar_pix_plano(uuid,text) to authenticated;

create or replace function public.cancelar_pedido_plano(p_pedido uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_pedido public.pedidos_plano%rowtype;
begin
 if auth.uid() is null then raise exception 'Faça login.' using errcode='28000';end if;
 select * into v_pedido from public.pedidos_plano where id=p_pedido for update;
 if not found or not exists(
   select 1 from public.membros where conta_id=v_pedido.conta_id
    and user_id=auth.uid() and papel='dono' and ativo
 ) then raise exception 'Pedido não autorizado.' using errcode='42501';end if;
 if v_pedido.status<>'aguardando_pagamento' then
   raise exception 'Pedidos informados como pagos precisam de análise do suporte.';end if;
 update public.pedidos_plano set status='cancelado',atualizado_em=now()
   where id=p_pedido;
end $$;
revoke all on function public.cancelar_pedido_plano(uuid) from public,anon;
grant execute on function public.cancelar_pedido_plano(uuid) to authenticated;

create or replace function public.mudar_para_plano_gratis(p_conta uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_gratis uuid; v_status text;
begin
 if auth.uid() is null or not exists(
  select 1 from public.membros where conta_id=p_conta and user_id=auth.uid()
    and papel='dono' and ativo
 ) then raise exception 'Somente o proprietário pode alterar o plano.' using errcode='42501';end if;
 select status_assinatura into v_status from public.contas where id=p_conta for update;
 if not found then raise exception 'Empresa não encontrada';end if;
 if v_status in ('bloqueada','cancelada') then
   raise exception 'Contate o suporte para regularizar esta conta.';end if;
 if exists(select 1 from public.pedidos_plano where conta_id=p_conta and status='em_analise')
   then raise exception 'Há um Pix aguardando análise. Aguarde ou contate o suporte.';end if;
 select id into v_gratis from public.planos where nome='Grátis' and ativo limit 1;
 if v_gratis is null then raise exception 'Plano Grátis indisponível';end if;
 update public.pedidos_plano set status='cancelado',atualizado_em=now()
  where conta_id=p_conta and status='aguardando_pagamento';
 update public.contas set plano_id=v_gratis,preco_acordado_centavos=0,
   status_assinatura='ativa',trial_ate=null,proximo_vencimento=null
  where id=p_conta;
end $$;
revoke all on function public.mudar_para_plano_gratis(uuid) from public,anon;
grant execute on function public.mudar_para_plano_gratis(uuid) to authenticated;

create or replace function public.console_pedidos_plano(p_situacao text default 'pendentes',
 p_pagina integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 perform private.console_exigir_admin();
 if p_situacao not in ('pendentes','todos','aprovado','recusado','cancelado') then
    raise exception 'Filtro inválido';end if;
 with pedidos as (
  select ped.*,c.nome_negocio,c.telefone,orig.nome as plano_anterior,
     destino.nome as plano_solicitado,c.status_assinatura,c.plano_id as plano_atual_id
  from public.pedidos_plano ped
   join public.contas c on c.id=ped.conta_id
   join public.planos orig on orig.id=ped.plano_origem_id
   join public.planos destino on destino.id=ped.plano_destino_id
  where p_situacao='todos'
    or (p_situacao='pendentes' and ped.status in ('aguardando_pagamento','em_analise'))
    or ped.status=p_situacao
 ), pg as (
  select * from pedidos
  order by case when status='em_analise' then 0 when status='aguardando_pagamento' then 1 else 2 end,
  criado_em desc,id limit 25 offset (greatest(1,p_pagina)-1)*25
 )
 select jsonb_build_object(
   'total',(select count(*) from pedidos),
   'para_conferir',(select count(*) from public.pedidos_plano where status='em_analise'),
   'itens',coalesce((select jsonb_agg(to_jsonb(pg)) from pg),'[]'::jsonb))
 into v_result;
 return v_result;
end $$;
revoke all on function public.console_pedidos_plano(text,integer) from public,anon;
grant execute on function public.console_pedidos_plano(text,integer) to authenticated;

-- Confirmação segura: cobrança e troca são atômicas. Nunca confia em preço enviado pelo navegador.
create or replace function public.console_confirmar_pedido_plano(
 p_pedido uuid,p_pago_em timestamptz default now(),p_observacao text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_pedido public.pedidos_plano%rowtype;v_conta public.contas%rowtype;
 v_pagamento uuid;v_data date;
begin
 perform private.console_exigir_admin();
 if p_pago_em is null or p_pago_em>now()+interval '1 hour'
   then raise exception 'Data de confirmação inválida';end if;
 if length(coalesce(p_observacao,''))>1500 then raise exception 'Observação muito longa';end if;
 select * into v_pedido from public.pedidos_plano where id=p_pedido;
 if not found then raise exception 'Solicitação não encontrada';end if;
 select * into v_conta from public.contas where id=v_pedido.conta_id for update;
 select * into v_pedido from public.pedidos_plano where id=p_pedido for update;
 if v_pedido.status<>'em_analise' then
   raise exception 'O cliente ainda não informou o Pix ou a solicitação já foi processada';end if;
 if v_conta.status_assinatura in ('bloqueada','cancelada') then
   raise exception 'A conta foi bloqueada/cancelada. Regularize antes de aprovar.';end if;
 if v_conta.plano_id<>v_pedido.plano_origem_id then
   raise exception 'O plano atual mudou após a solicitação. Recuse o pedido e peça um novo.';end if;
 v_data:=(p_pago_em at time zone 'America/Sao_Paulo')::date;
 insert into public.pagamentos
  (conta_id,valor_centavos,referencia,status,forma,pago_em,observacao,criado_por,pedido_plano_id)
 values (v_pedido.conta_id,v_pedido.valor_centavos,
  to_char(v_data,'YYYY-MM'),'pago','pix',p_pago_em,
  nullif(trim(coalesce(p_observacao,'')),''),auth.uid(),v_pedido.id)
 returning id into v_pagamento;
 update public.contas set
  plano_id=v_pedido.plano_destino_id,preco_acordado_centavos=v_pedido.valor_centavos,
  status_assinatura='ativa',trial_ate=null,
  proximo_vencimento=(v_data+interval '1 month')::date
 where id=v_pedido.conta_id;
 update public.pedidos_plano set status='aprovado',decidido_por=auth.uid(),
  decidido_em=now(),pagamento_id=v_pagamento,atualizado_em=now() where id=v_pedido.id;
 return v_pagamento;
end $$;
revoke all on function public.console_confirmar_pedido_plano(uuid,timestamptz,text)
 from public,anon;
grant execute on function public.console_confirmar_pedido_plano(uuid,timestamptz,text)
 to authenticated;

create or replace function public.console_recusar_pedido_plano(p_pedido uuid,p_motivo text)
returns void language plpgsql security definer set search_path='' as $$
declare v_pedido public.pedidos_plano%rowtype;
begin
 perform private.console_exigir_admin();
 if length(trim(coalesce(p_motivo,''))) not between 5 and 1000 then
   raise exception 'Informe o motivo da recusa (5 a 1000 caracteres).';end if;
 select * into v_pedido from public.pedidos_plano where id=p_pedido for update;
 if not found or v_pedido.status not in ('aguardando_pagamento','em_analise') then
    raise exception 'Solicitação inexistente ou já finalizada';end if;
 update public.pedidos_plano set status='recusado',motivo_recusa=trim(p_motivo),
  decidido_por=auth.uid(),decidido_em=now(),atualizado_em=now()
  where id=p_pedido;
end $$;
revoke all on function public.console_recusar_pedido_plano(uuid,text) from public,anon;
grant execute on function public.console_recusar_pedido_plano(uuid,text) to authenticated;

-- Pedidos aprovados e recusados ficam auditados sem exibir dados financeiros a funcionários.
drop trigger if exists console_auditoria_pedidos_plano on public.pedidos_plano;
create trigger console_auditoria_pedidos_plano
 after insert or update or delete on public.pedidos_plano
 for each row execute function private.console_auditar();
