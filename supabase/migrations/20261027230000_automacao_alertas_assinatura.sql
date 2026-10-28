
-- Automação de avisos do AdmPro. Reaproveita public.avisos, sem duplicar mensagens.
create table if not exists public.automacoes_alerta (
  id uuid primary key default gen_random_uuid(),
  aviso_id uuid not null references public.avisos(id) on delete cascade,
  evento text not null check (evento in (
    'teste_inicio','teste_antes','teste_encerrado','vencimento_antes','vencimento_hoje',
    'pagamento_pendente','pagamento_atrasado','risco_suspensao','suspensa',
    'pagamento_confirmado','renovada','restabelecida','plano_alterado','cancelada')),
  dias integer not null default 0 check(dias between 0 and 90),
  ativo boolean not null default true,
  prioridade text not null default 'normal' check(prioridade in ('baixa','normal','alta','critica')),
  permite_fechar boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique(aviso_id,evento,dias)
);
create index if not exists automacoes_alerta_evento_idx on public.automacoes_alerta(ativo,evento);
create table if not exists public.alertas_entregas (
  id uuid primary key default gen_random_uuid(),
  automacao_id uuid not null references public.automacoes_alerta(id) on delete cascade,
  conta_id uuid not null references public.contas(id) on delete cascade,
  referencia date not null,
  criado_em timestamptz not null default now(),
  visualizado_em timestamptz,
  fechado_em timestamptz,
  unique(automacao_id,conta_id,referencia)
);
create index if not exists alertas_entregas_conta_idx on public.alertas_entregas(conta_id,referencia desc);
alter table public.automacoes_alerta enable row level security;
alter table public.alertas_entregas enable row level security;
revoke all on public.automacoes_alerta,public.alertas_entregas from public,anon,authenticated;
grant select,insert,update,delete on public.automacoes_alerta to authenticated;
grant select on public.alertas_entregas to authenticated;
drop policy if exists automacoes_admin on public.automacoes_alerta;
create policy automacoes_admin on public.automacoes_alerta for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists entregas_admin_select on public.alertas_entregas;
create policy entregas_admin_select on public.alertas_entregas for select to authenticated
  using ((select public.is_admin()));

-- Um aviso vinculado a alguma automação é um modelo; nunca vira comunicado genérico.
drop policy if exists avisos_ler on public.avisos;
create policy avisos_ler on public.avisos for select to authenticated
using ((select public.is_admin()) or (
  ativo and inicio <= now() and (fim is null or fim >= now())
  and not exists (select 1 from public.automacoes_alerta x where x.aviso_id = avisos.id)
  and (publico='todos' or exists (
    select 1 from public.contas c where (select public.eh_membro(c.id))
      and (publico=c.id::text or publico=c.status_assinatura)
  ))
));

-- A data de competência é a data local do Brasil. Não depende do horário do navegador.
create or replace function private.alerta_elegivel(
  p_evento text,p_dias integer,p_conta public.contas,p_hoje date,p_tolerancia integer
) returns boolean language plpgsql stable security definer set search_path='' as $fn$
begin
  case p_evento
    when 'teste_inicio' then
      return p_conta.status_assinatura='trial' and (p_conta.criado_em at time zone 'America/Sao_Paulo')::date=p_hoje;
    when 'teste_antes' then
      return p_conta.status_assinatura='trial' and p_conta.trial_ate=p_hoje+p_dias;
    when 'teste_encerrado' then
      return p_conta.status_assinatura<>'trial' and p_conta.trial_ate=p_hoje-1;
    when 'vencimento_antes' then
      return p_conta.status_assinatura='ativa' and p_conta.proximo_vencimento=p_hoje+p_dias;
    when 'vencimento_hoje' then
      return p_conta.status_assinatura='ativa' and p_conta.proximo_vencimento=p_hoje;
    when 'pagamento_pendente' then
      return p_conta.status_assinatura='atrasada' and p_conta.proximo_vencimento=p_hoje-1;
    when 'pagamento_atrasado' then
      return p_conta.status_assinatura='atrasada' and p_conta.proximo_vencimento=p_hoje-greatest(1,p_dias);
    when 'risco_suspensao' then
      return p_conta.status_assinatura='atrasada' and p_conta.proximo_vencimento+p_tolerancia=p_hoje+p_dias;
    when 'suspensa' then
      return p_conta.status_assinatura='bloqueada' and
        (p_conta.proximo_vencimento+p_tolerancia+1=p_hoje or exists (
          select 1 from public.auditoria au where au.conta_id=p_conta.id
            and au.entidade='contas' and au.antes->>'status_assinatura' is distinct from 'bloqueada'
            and au.depois->>'status_assinatura'='bloqueada'
            and (au.criado_em at time zone 'America/Sao_Paulo')::date=p_hoje));
    when 'pagamento_confirmado' then
      return exists(select 1 from public.pagamentos pa
        where pa.conta_id=p_conta.id and pa.status='pago'
          and (pa.pago_em at time zone 'America/Sao_Paulo')::date=p_hoje);
    when 'renovada' then
      return p_conta.status_assinatura='ativa' and exists(select 1 from public.pagamentos pa
        where pa.conta_id=p_conta.id and pa.status='pago'
          and (pa.pago_em at time zone 'America/Sao_Paulo')::date=p_hoje);
    when 'restabelecida' then
      return p_conta.status_assinatura<>'bloqueada' and exists(
        select 1 from public.auditoria au where au.conta_id=p_conta.id and au.entidade='contas'
          and au.antes->>'status_assinatura'='bloqueada'
          and au.depois->>'status_assinatura'<>'bloqueada'
          and (au.criado_em at time zone 'America/Sao_Paulo')::date=p_hoje);
    when 'plano_alterado' then
      return exists(select 1 from public.auditoria au where au.conta_id=p_conta.id
        and au.entidade='contas' and au.antes->>'plano_id' is distinct from au.depois->>'plano_id'
        and (au.criado_em at time zone 'America/Sao_Paulo')::date=p_hoje);
    when 'cancelada' then
      return p_conta.status_assinatura='cancelada' and exists(
        select 1 from public.auditoria au where au.conta_id=p_conta.id
          and au.entidade='contas' and au.antes->>'status_assinatura' is distinct from 'cancelada'
          and au.depois->>'status_assinatura'='cancelada'
          and (au.criado_em at time zone 'America/Sao_Paulo')::date=p_hoje);
    else return false;
  end case;
end $fn$;
revoke all on function private.alerta_elegivel(text,integer,public.contas,date,integer) from public,anon,authenticated;

-- Inserção idempotente: várias abas/logins/cron não geram duplicatas.
create or replace function private.processar_alertas(p_conta uuid default null)
returns integer language plpgsql security definer set search_path='' as $fn$
declare v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
        v_tol integer := 10; v_n integer;
begin
  select greatest(0,coalesce((valor #>> '{}')::integer,10))
    into v_tol from public.config_sistema where chave='dias_tolerancia';
  v_tol:=coalesce(v_tol,10);
  insert into public.alertas_entregas(automacao_id,conta_id,referencia)
  select r.id,c.id,v_hoje from public.automacoes_alerta r
  join public.avisos a on a.id=r.aviso_id
  cross join public.contas c
  where r.ativo and (p_conta is null or c.id=p_conta)
    and a.inicio<=now() and (a.fim is null or a.fim>=now())
    and private.alerta_elegivel(r.evento,r.dias,c,v_hoje,v_tol)
  on conflict(automacao_id,conta_id,referencia) do nothing;
  get diagnostics v_n=row_count;
  return v_n;
end $fn$;
revoke all on function private.processar_alertas(uuid) from public,anon,authenticated;

-- RPC autorizada para os proprietários. Funcionários não veem alertas de cobrança.
create or replace function public.meus_alertas_automaticos(p_conta uuid)
returns table(id uuid,titulo text,mensagem text,tipo text,prioridade text,permite_fechar boolean,
              referencia date,visualizado boolean)
language plpgsql security definer set search_path='' as $fn$
declare v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if auth.uid() is null or not exists (
    select 1 from public.membros m where m.conta_id=p_conta and m.user_id=auth.uid()
      and m.ativo and m.papel='dono'
  ) then raise exception 'Acesso restrito ao responsável pela assinatura' using errcode='42501'; end if;
  perform private.processar_alertas(p_conta);
  return query select d.id,a.titulo,a.mensagem,a.tipo,r.prioridade,r.permite_fechar,d.referencia,
    d.visualizado_em is not null
    from public.alertas_entregas d
    join public.automacoes_alerta r on r.id=d.automacao_id
    join public.avisos a on a.id=r.aviso_id
    join public.contas c on c.id=d.conta_id
    where d.conta_id=p_conta and r.ativo and d.fechado_em is null
      and (d.referencia=v_hoje or (r.evento in ('pagamento_confirmado','renovada','restabelecida','plano_alterado','cancelada')
         and d.referencia=v_hoje-1))
      and (a.fim is null or a.fim>=now())
      and (case when r.evento like 'teste_%' then c.trial_ate is not null and (
            r.evento='teste_encerrado' or c.status_assinatura='trial')
        when r.evento in ('vencimento_antes','vencimento_hoje') then c.status_assinatura='ativa' and c.proximo_vencimento>=v_hoje
        when r.evento in ('pagamento_pendente','pagamento_atrasado','risco_suspensao') then c.status_assinatura='atrasada'
        when r.evento='suspensa' then c.status_assinatura='bloqueada'
        else true end)
    order by case r.prioridade when 'critica' then 0 when 'alta' then 1 when 'normal' then 2 else 3 end,d.criado_em desc
    limit 20;
end $fn$;
revoke all on function public.meus_alertas_automaticos(uuid) from public,anon;
grant execute on function public.meus_alertas_automaticos(uuid) to authenticated;

create or replace function public.registrar_leitura_alerta(p_entrega uuid,p_fechar boolean default false)
returns void language plpgsql security definer set search_path='' as $fn$
declare v_conta uuid; v_pode boolean;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória' using errcode='28000'; end if;
  select d.conta_id,r.permite_fechar into v_conta,v_pode
    from public.alertas_entregas d join public.automacoes_alerta r on r.id=d.automacao_id
    where d.id=p_entrega;
  if v_conta is null or not exists(
    select 1 from public.membros m where m.conta_id=v_conta and m.user_id=auth.uid() and m.ativo and m.papel='dono'
  ) then raise exception 'Alerta não autorizado' using errcode='42501'; end if;
  if p_fechar and not v_pode then raise exception 'Este alerta não pode ser dispensado' using errcode='42501';end if;
  update public.alertas_entregas set
    visualizado_em=coalesce(visualizado_em,now()),
    fechado_em=case when p_fechar then coalesce(fechado_em,now()) else fechado_em end
    where id=p_entrega;
end $fn$;
revoke all on function public.registrar_leitura_alerta(uuid,boolean) from public,anon;
grant execute on function public.registrar_leitura_alerta(uuid,boolean) to authenticated;

-- Templates previamente cadastrados. Não altera ativo nem público dos avisos existentes.
with configuracao(titulo,evento,dias,prioridade,permite_fechar) as (
 values
 ('Seu período de teste começou!','teste_inicio',0,'baixa',true),
 ('Seu período de teste está passando!','teste_antes',7,'normal',true),
 ('Seu teste gratuito termina em 3 dias!','teste_antes',3,'alta',true),
 ('Último dia do seu teste gratuito!','teste_antes',1,'alta',true),
 ('Seu período de teste chegou ao fim!','teste_encerrado',0,'alta',true),
 ('Sua assinatura vence em 7 dias!','vencimento_antes',7,'normal',true),
 ('Faltam 3 dias para o vencimento!','vencimento_antes',3,'normal',true),
 ('Sua assinatura vence amanhã!','vencimento_antes',1,'alta',true),
 ('Sua assinatura vence hoje!','vencimento_hoje',0,'alta',true),
 ('Identificamos um pagamento pendente!','pagamento_pendente',1,'alta',true),
 ('Sua assinatura está em atraso!','pagamento_atrasado',3,'alta',true),
 ('Atenção: seu acesso poderá ser suspenso!','risco_suspensao',1,'critica',false),
 ('Sua assinatura foi suspensa temporariamente!','suspensa',0,'critica',false),
 ('Pagamento confirmado com sucesso!','pagamento_confirmado',0,'baixa',true),
 ('Sua assinatura foi renovada!','renovada',0,'baixa',true),
 ('Seu acesso foi restabelecido!','restabelecida',0,'normal',true),
 ('Seu plano foi atualizado!','plano_alterado',0,'normal',true),
 ('Sua assinatura foi cancelada!','cancelada',0,'alta',true)
)
insert into public.automacoes_alerta(aviso_id,evento,dias,prioridade,permite_fechar)
select a.id,c.evento,c.dias,c.prioridade,c.permite_fechar
from configuracao c join public.avisos a on lower(trim(a.titulo))=lower(c.titulo)
on conflict (aviso_id,evento,dias) do nothing;

-- Se pg_cron estiver disponível, entrega mesmo sem login, sem envio de e-mails.
do $cron$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('admpro_gerar_alertas','5 9 * * *','select private.processar_alertas(null::uuid)');
  else raise notice 'pg_cron indisponível: geração continua no acesso do proprietário.'; end if;
exception when others then raise notice 'Agendamento de alertas não instalado: %',sqlerrm;
end $cron$;
