-- AdmPro: modelo multi-tenant, PostgreSQL/Supabase.
-- Executar no SQL Editor como proprietário do projeto. Não usar service_role no navegador.
-- Pro começa com preço 0 apenas como marcador; configurar ANTES de comercializar.
-- gen_random_uuid() é nativo no PostgreSQL 13+; sem extensão obrigatória.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.planos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  preco_mensal_centavos integer not null default 0 check(preco_mensal_centavos >= 0),
  limite_clientes integer check (limite_clientes is null or limite_clientes >= 0),
  limite_servicos_mes integer check(limite_servicos_mes is null or limite_servicos_mes >= 0),
  recursos jsonb not null default '{}'::jsonb check(jsonb_typeof(recursos) = 'object'),
  ativo boolean not null default true,
  ordem integer not null default 0
);
insert into public.planos (nome,preco_mensal_centavos,limite_clientes,limite_servicos_mes,recursos,ativo,ordem)
values ('Gratuito',0,30,40,'{"sem_preco":false}'::jsonb,true,0),
       ('Pro',0,null,null,'{"preco_pendente":true}'::jsonb,true,1)
on conflict (nome) do nothing;

create table if not exists public.contas (
  id uuid primary key default gen_random_uuid(),
  nome_negocio text not null default 'Meu negócio',
  modelo_negocio text not null default 'outro',
  tipo_negocio text not null default 'rapido',
  telefone text not null default '', cidade text not null default '', uf text not null default '',
  plano_id uuid not null references public.planos(id),
  status_assinatura text not null default 'trial' check(status_assinatura in ('trial','ativa','atrasada','cancelada','bloqueada')),
  trial_ate date, proximo_vencimento date,
  criado_em timestamptz not null default now(), ultimo_acesso_em timestamptz,
  versao_app text not null default ''
);
create index if not exists contas_plano_status_idx on public.contas(plano_id,status_assinatura);

create table if not exists public.membros (
  conta_id uuid not null references public.contas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'dono' check(papel in ('dono')),
  primary key (conta_id,user_id)
);
create index if not exists membros_usuario_idx on public.membros(user_id,conta_id);

create table if not exists public.dados (
  id text not null check(length(id) between 1 and 160),
  conta_id uuid not null references public.contas(id) on delete cascade,
  colecao text not null check (colecao in ('clientes','servicos','lancamentos','catalogo','profissionais','despesasFixas','movimentacoesEstoque','config')),
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(), -- adicional: data imutável para limite mensal confiável
  atualizado_em timestamptz not null default now(),
  excluido boolean not null default false,
  primary key(conta_id,colecao,id),
  check (jsonb_typeof(dados) = 'object')
);
create index if not exists dados_sync_idx on public.dados(conta_id,colecao,atualizado_em);
create index if not exists dados_ativos_idx on public.dados(conta_id,colecao,criado_em) where not excluido;

create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas(id) on delete cascade,
  valor_centavos integer not null check(valor_centavos >= 0),
  referencia text not null check(referencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'pendente' check(status in ('pendente','pago','cancelado')),
  forma text, pago_em timestamptz, observacao text,
  criado_por uuid references auth.users(id),
  criado_em timestamptz not null default now()
);
create index if not exists pagamentos_conta_idx on public.pagamentos(conta_id,criado_em desc);
create index if not exists pagamentos_criado_por_idx on public.pagamentos(criado_por);

create table if not exists public.uso_diario (
  conta_id uuid not null references public.contas(id) on delete cascade,
  dia date not null,
  acessos integer not null default 0 check(acessos >= 0),
  clientes_total integer not null default 0 check(clientes_total >= 0),
  servicos_criados integer not null default 0 check(servicos_criados >= 0),
  lancamentos_criados integer not null default 0 check(lancamentos_criados >= 0),
  primary key(conta_id,dia)
);
create index if not exists uso_diario_dia_idx on public.uso_diario(dia desc);

create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null, mensagem text not null,
  tipo text not null default 'info' check(tipo in ('info','alerta')),
  publico text not null default 'todos' check(publico in ('todos','trial','atrasada') or publico ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'),
  inicio timestamptz not null default now(), fim timestamptz,
  ativo boolean not null default true,
  check(fim is null or fim >= inicio)
);
create index if not exists avisos_ativos_idx on public.avisos(ativo,inicio,fim);

create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas(id) on delete cascade,
  tipo text not null check(tipo in ('duvida','problema','sugestao','pagamento')),
  mensagem text not null check(length(trim(mensagem)) between 1 and 5000),
  status text not null default 'aberto' check(status in ('aberto','respondido','fechado')),
  resposta text, criado_em timestamptz not null default now(), respondido_em timestamptz
);
create index if not exists feedbacks_conta_idx on public.feedbacks(conta_id,criado_em desc);

create table if not exists public.config_sistema (
  chave text primary key,
  valor jsonb not null
);
insert into public.config_sistema(chave,valor) values
  ('pix_chave','null'::jsonb),('pix_nome_recebedor','null'::jsonb),
  ('whatsapp_suporte','null'::jsonb),('dias_teste','14'::jsonb),('dias_tolerancia','10'::jsonb)
on conflict(chave) do nothing;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- SECURITY DEFINER imprescindível para consultar membresia sem RLS recursiva.
-- search_path fixo e sem EXECUTE público; nunca aceitar user_id informado pelo cliente.
create or replace function public.is_admin() returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from public.admins where user_id = (select auth.uid()));
$$;
create or replace function public.eh_membro(p_conta uuid) returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from public.membros where conta_id = p_conta and user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public,anon;
revoke all on function public.eh_membro(uuid) from public,anon;
grant execute on function public.is_admin(),public.eh_membro(uuid) to authenticated;

-- Um usuário novo ganha conta Gratuita e trial (cadastro via Auth).
create or replace function private.criar_conta_usuario() returns trigger language plpgsql security definer
set search_path = '' as $$
declare v_plano uuid; v_dias int; v_conta uuid; v_nome text;
begin
  select id into v_plano from public.planos where nome = 'Gratuito';
  if v_plano is null then raise exception 'Plano Gratuito não encontrado'; end if;
  select coalesce((valor #>> '{}')::int,14) into v_dias from public.config_sistema where chave = 'dias_teste';
  v_dias := greatest(coalesce(v_dias,14),0);
  v_nome := left(coalesce(nullif(trim(new.raw_user_meta_data->>'nome_negocio'),''),'Meu negócio'),150);
  insert into public.contas(nome_negocio,plano_id,status_assinatura,trial_ate)
    values(v_nome,v_plano,'trial',current_date + v_dias) returning id into v_conta;
  insert into public.membros(conta_id,user_id,papel) values(v_conta,new.id,'dono');
  return new;
end $$;
drop trigger if exists admpro_novo_usuario on auth.users;
create trigger admpro_novo_usuario after insert on auth.users for each row execute function private.criar_conta_usuario();

-- Nunca permitir que um membro promova sua assinatura pelo console/API.
create or replace function private.proteger_conta() returns trigger language plpgsql
set search_path = '' as $$
begin
  if current_user not in ('postgres','service_role') and not public.is_admin() and (
     new.id is distinct from old.id or
     new.plano_id is distinct from old.plano_id or
     new.status_assinatura is distinct from old.status_assinatura or
     new.trial_ate is distinct from old.trial_ate or
     new.proximo_vencimento is distinct from old.proximo_vencimento or
     new.criado_em is distinct from old.criado_em or
     new.ultimo_acesso_em is distinct from old.ultimo_acesso_em or
     new.versao_app is distinct from old.versao_app
  ) then raise exception 'CAMPOS_ASSINATURA_PROTEGIDOS' using errcode = '42501'; end if;
  if current_user not in ('postgres','service_role') and not public.is_admin()
     and old.status_assinatura = 'bloqueada' then
    raise exception 'CONTA_BLOQUEADA' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists admpro_proteger_conta on public.contas;
create trigger admpro_proteger_conta before update on public.contas for each row execute function private.proteger_conta();

-- Atualizar status via rotina interna, acessada apenas por RPC autenticada ou cron.
create or replace function private.atualizar_status(p_conta uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_gratis uuid; v_tolerancia int;
begin
  select id into v_gratis from public.planos where nome = 'Gratuito';
  select greatest(coalesce((valor #>> '{}')::int,10),0) into v_tolerancia
    from public.config_sistema where chave = 'dias_tolerancia';
  v_tolerancia := coalesce(v_tolerancia,10);
  update public.contas set plano_id = v_gratis, status_assinatura = 'ativa', proximo_vencimento = null
   where (p_conta is null or id = p_conta)
     and status_assinatura = 'trial' and trial_ate < current_date;
  update public.contas set status_assinatura = 'atrasada'
   where (p_conta is null or id = p_conta)
     and status_assinatura = 'ativa' and proximo_vencimento < current_date;
  update public.contas set status_assinatura = 'bloqueada'
   where (p_conta is null or id = p_conta)
     and status_assinatura = 'atrasada' and proximo_vencimento + v_tolerancia < current_date;
end $$;
revoke all on function private.atualizar_status(uuid) from public,anon,authenticated;

create or replace function public.atualizar_minha_assinatura() returns void
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória' using errcode='28000'; end if;
  select conta_id into v_conta from public.membros where user_id = auth.uid() order by conta_id limit 1;
  if v_conta is null then raise exception 'Conta não encontrada'; end if;
  perform private.atualizar_status(v_conta);
end $$;
revoke all on function public.atualizar_minha_assinatura() from public,anon;
grant execute on function public.atualizar_minha_assinatura() to authenticated;

-- Quotas confiáveis: serializa as criações por conta e usa contadores mantidos só por triggers.
create or replace function private.validar_dado() returns trigger language plpgsql security definer
set search_path = '' as $$
declare v_conta public.contas%rowtype; v_limites public.planos%rowtype; v_qtd int;
begin
  select * into v_conta from public.contas where id=new.conta_id for update;
  if not found then raise exception 'Conta inválida'; end if;
  if v_conta.status_assinatura = 'bloqueada' then
    raise exception 'CONTA_BLOQUEADA' using errcode='P0001';
  end if;
  select * into v_limites from public.planos where id=v_conta.plano_id;
  if tg_op='UPDATE' then
    if new.conta_id <> old.conta_id or new.colecao <> old.colecao or new.id <> old.id
       or new.criado_em is distinct from old.criado_em then
      raise exception 'IDENTIDADE_IMUTAVEL' using errcode='42501';
    end if;
    if new.atualizado_em <= old.atualizado_em then
      raise exception 'STALE_WRITE' using errcode='P0001';
    end if;
  end if;
  if new.atualizado_em > clock_timestamp() + interval '5 minutes' then
    raise exception 'RELOGIO_INVALIDO' using errcode='P0001';
  end if;
  if new.colecao='clientes' and not new.excluido and
      (tg_op='INSERT' or (tg_op='UPDATE' and old.excluido)) and v_limites.limite_clientes is not null then
    select count(*) into v_qtd from public.dados
     where conta_id=new.conta_id and colecao='clientes' and not excluido;
    if v_qtd >= v_limites.limite_clientes then
      raise exception 'LIMITE_CLIENTES' using errcode='P0001';
    end if;
  end if;
  if (tg_op='INSERT' or (tg_op='UPDATE' and old.excluido)) and new.colecao='servicos' and not new.excluido
      and v_limites.limite_servicos_mes is not null then
    select coalesce(sum(servicos_criados),0) into v_qtd from public.uso_diario
    where conta_id=new.conta_id and dia >= date_trunc('month',current_date)::date
      and dia < (date_trunc('month',current_date) + interval '1 month')::date;
    if v_qtd >= v_limites.limite_servicos_mes then
      raise exception 'LIMITE_SERVICOS_MES' using errcode='P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists admpro_validar_dado on public.dados;
create trigger admpro_validar_dado before insert or update on public.dados
for each row execute function private.validar_dado();

create or replace function private.contabilizar_dado() returns trigger language plpgsql security definer
set search_path = '' as $$
declare v_total int;
begin
  if new.colecao = 'clientes' then
    select count(*) into v_total from public.dados
     where conta_id = new.conta_id and colecao='clientes' and not excluido;
    insert into public.uso_diario(conta_id,dia,clientes_total)
      values(new.conta_id,current_date,v_total)
    on conflict(conta_id,dia) do update set clientes_total=excluded.clientes_total;
  end if;
  if (tg_op='INSERT' or (tg_op='UPDATE' and old.excluido)) and new.colecao in ('servicos','lancamentos') and not new.excluido then
    insert into public.uso_diario(conta_id,dia,servicos_criados,lancamentos_criados)
      values(new.conta_id,current_date, (new.colecao='servicos')::int,(new.colecao='lancamentos')::int)
    on conflict(conta_id,dia) do update set
      servicos_criados=public.uso_diario.servicos_criados + excluded.servicos_criados,
      lancamentos_criados=public.uso_diario.lancamentos_criados + excluded.lancamentos_criados;
  end if;
  return new;
end $$;
drop trigger if exists admpro_contabilizar_dado on public.dados;
create trigger admpro_contabilizar_dado after insert or update of excluido on public.dados
for each row execute function private.contabilizar_dado();

create or replace function private.proteger_feedback() returns trigger language plpgsql
set search_path = '' as $$
begin
  if not public.is_admin() and (
    new.conta_id is distinct from old.conta_id or new.id is distinct from old.id or
    new.status is distinct from old.status or new.resposta is distinct from old.resposta or
    new.respondido_em is distinct from old.respondido_em or new.criado_em is distinct from old.criado_em
  ) then raise exception 'RESPOSTA_SUPORTE_PROTEGIDA' using errcode='42501'; end if;
  return new;
end $$;
drop trigger if exists admpro_feedback on public.feedbacks;
create trigger admpro_feedback before update on public.feedbacks
for each row execute function private.proteger_feedback();

-- RPC: própria conta, intervalo controlado no browser (30min); contador só no servidor.
create or replace function public.registrar_acesso(p_versao_app text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid; v_total int; v_ultimo timestamptz;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória' using errcode='28000'; end if;
  select conta_id into v_conta from public.membros where user_id=auth.uid() order by conta_id limit 1;
  if v_conta is null then raise exception 'Conta não encontrada'; end if;
  perform private.atualizar_status(v_conta);
  select ultimo_acesso_em into v_ultimo from public.contas where id=v_conta for update;
  if v_ultimo is not null and v_ultimo > now() - interval '30 minutes' then return; end if;
  update public.contas set ultimo_acesso_em=now(), versao_app=left(coalesce(p_versao_app,''),80)
  where id=v_conta;
  select count(*) into v_total from public.dados
    where conta_id=v_conta and colecao='clientes' and not excluido;
  insert into public.uso_diario(conta_id,dia,acessos,clientes_total)
    values(v_conta,current_date,1,v_total)
  on conflict(conta_id,dia) do update set
    acessos=public.uso_diario.acessos+1,clientes_total=excluded.clientes_total;
end $$;
revoke all on function public.registrar_acesso(text) from public,anon;
grant execute on function public.registrar_acesso(text) to authenticated;

-- RLS em TODAS as tabelas, inclusive tabelas só de controle.
alter table public.planos enable row level security;
alter table public.contas enable row level security;
alter table public.membros enable row level security;
alter table public.dados enable row level security;
alter table public.pagamentos enable row level security;
alter table public.uso_diario enable row level security;
alter table public.avisos enable row level security;
alter table public.feedbacks enable row level security;
alter table public.config_sistema enable row level security;
alter table public.admins enable row level security;

create policy "planos_visiveis" on public.planos for select to authenticated
using (ativo or (select public.is_admin()));
create policy "planos_admin_escrita" on public.planos for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "contas_ler" on public.contas for select to authenticated
using ((select public.is_admin()) or (select public.eh_membro(id)));
create policy "contas_atualizar" on public.contas for update to authenticated
using ((select public.is_admin()) or (select public.eh_membro(id)))
with check ((select public.is_admin()) or (select public.eh_membro(id)));
create policy "contas_admin_criar" on public.contas for insert to authenticated
with check ((select public.is_admin()));
create policy "contas_admin_apagar" on public.contas for delete to authenticated
using ((select public.is_admin()));

create policy "membros_ler" on public.membros for select to authenticated
using ((select public.is_admin()) or user_id=(select auth.uid()));
-- Só a função interna de cadastro (ou o painel futuro com fluxo protegido) cria membresias.

create policy "dados_privados_ler" on public.dados for select to authenticated
using (not (select public.is_admin()) and (select public.eh_membro(conta_id)));
create policy "dados_privados_inserir" on public.dados for insert to authenticated
with check (not (select public.is_admin()) and (select public.eh_membro(conta_id))
  and exists(select 1 from public.contas where id=conta_id and status_assinatura <> 'bloqueada'));
create policy "dados_privados_atualizar" on public.dados for update to authenticated
using (not (select public.is_admin()) and (select public.eh_membro(conta_id)))
with check (not (select public.is_admin()) and (select public.eh_membro(conta_id))
  and exists(select 1 from public.contas where id=conta_id and status_assinatura <> 'bloqueada'));
-- exclusão sempre lógica; não conceder DELETE físico.

create policy "pagamentos_ler" on public.pagamentos for select to authenticated
using ((select public.is_admin()) or (select public.eh_membro(conta_id)));
create policy "pagamentos_admin_escrita" on public.pagamentos for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "uso_ler" on public.uso_diario for select to authenticated
using ((select public.is_admin()) or (select public.eh_membro(conta_id)));
-- Os contadores só podem ser atualizados por triggers/RPC: cliente não falsifica métricas.

create policy "avisos_ler" on public.avisos for select to authenticated
using ((select public.is_admin()) or (
  ativo and inicio <= now() and (fim is null or fim >= now()) and
  (publico='todos' or exists (
    select 1 from public.contas c where (select public.eh_membro(c.id)) and
      (publico=c.id::text or publico=c.status_assinatura)
  ))
));
create policy "avisos_admin_escrita" on public.avisos for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "feedback_ler" on public.feedbacks for select to authenticated
using ((select public.is_admin()) or (select public.eh_membro(conta_id)));
create policy "feedback_criar" on public.feedbacks for insert to authenticated
with check ((select public.is_admin()) or ((select public.eh_membro(conta_id)) and
 status='aberto' and resposta is null and respondido_em is null));
create policy "feedback_atualizar" on public.feedbacks for update to authenticated
using ((select public.is_admin()) or (select public.eh_membro(conta_id)))
with check ((select public.is_admin()) or (select public.eh_membro(conta_id)));
create policy "feedback_admin_apagar" on public.feedbacks for delete to authenticated
using ((select public.is_admin()));

create policy "config_ler" on public.config_sistema for select to authenticated using (true);
create policy "config_admin_escrita" on public.config_sistema for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins_admin_ler" on public.admins for select to authenticated
using ((select public.is_admin()));
create policy "admins_admin_escrita" on public.admins for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

-- GRANTs explícitos independentes da configuração "Data API" do projeto.
revoke all on public.planos,public.contas,public.membros,public.dados,public.pagamentos,
  public.uso_diario,public.avisos,public.feedbacks,public.config_sistema,public.admins from anon;
grant usage on schema public to authenticated;
grant select on public.planos,public.contas,public.membros,public.dados,public.pagamentos,
  public.uso_diario,public.avisos,public.feedbacks,public.config_sistema,public.admins to authenticated;
grant insert,update,delete on public.planos,public.contas,public.pagamentos,
  public.avisos,public.feedbacks,public.config_sistema,public.admins to authenticated;
grant insert,update on public.dados to authenticated;
-- Sem GRANT de delete em dados; sem escrita direta em uso_diario.

-- pg_cron opcional: confirmar em Dashboard > Database > Extensions.
do $cron$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    begin
      perform cron.schedule('admpro_atualizar_assinaturas','17 3 * * *',
        'select private.atualizar_status(null::uuid)');
    exception when others then
      raise notice 'Agendamento pg_cron requer ajuste manual: %',sqlerrm;
    end;
  else
    raise notice 'pg_cron não disponível; status também atualizado no login.';
  end if;
end $cron$;