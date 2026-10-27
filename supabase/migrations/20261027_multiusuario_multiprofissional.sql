-- AdmPro multiusuário/multiprofissional. Migração aditiva, sem alterar preços.
alter table public.planos
  add column if not exists limite_profissionais integer check (limite_profissionais is null or limite_profissionais >= 0),
  add column if not exists limite_usuarios integer check (limite_usuarios is null or limite_usuarios >= 0),
  add column if not exists limite_unidades integer check (limite_unidades is null or limite_unidades >= 0);

alter table public.membros drop constraint if exists membros_papel_check;
alter table public.membros
  add column if not exists profissional_id text,
  add column if not exists permissoes jsonb not null default '{}'::jsonb,
  add column if not exists ativo boolean not null default true,
  add column if not exists criado_em timestamptz not null default now(),
  add column if not exists atualizado_em timestamptz not null default now();
alter table public.membros add constraint membros_papel_check check (papel in ('dono','gerente','recepcionista','profissional'));
alter table public.membros add constraint membros_permissoes_objeto_check check (jsonb_typeof(permissoes)='object');
alter table public.membros add constraint membros_profissional_id_check check (profissional_id is null or length(profissional_id) between 1 and 160);
create index if not exists membros_conta_ativos_idx on public.membros(conta_id,ativo,papel);
create index if not exists membros_profissional_idx on public.membros(conta_id,profissional_id) where profissional_id is not null;

create table if not exists public.convites_membros (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  papel text not null check (papel in ('gerente','recepcionista','profissional')),
  profissional_id text,
  permissoes jsonb not null default '{}'::jsonb check (jsonb_typeof(permissoes)='object'),
  expira_em timestamptz not null default (now() + interval '7 days'),
  aceito_em timestamptz,
  cancelado_em timestamptz,
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (profissional_id is null or length(profissional_id) between 1 and 160)
);
create unique index if not exists convites_membros_pendente_email_idx
  on public.convites_membros(conta_id,lower(email)) where aceito_em is null and cancelado_em is null;
create index if not exists convites_membros_email_idx
  on public.convites_membros(lower(email),expira_em) where aceito_em is null and cancelado_em is null;
create index if not exists convites_membros_conta_idx on public.convites_membros(conta_id,criado_em desc);

create table if not exists public.auditoria_empresa (
  id bigint generated always as identity primary key,
  conta_id uuid not null references public.contas(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  acao text not null,
  entidade text not null,
  entidade_id text,
  detalhes jsonb not null default '{}'::jsonb check (jsonb_typeof(detalhes)='object'),
  criado_em timestamptz not null default now()
);
create index if not exists auditoria_empresa_conta_idx on public.auditoria_empresa(conta_id,criado_em desc);
create index if not exists auditoria_empresa_user_idx on public.auditoria_empresa(user_id,criado_em desc);

create or replace function public.eh_membro(p_conta uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and exists(
    select 1 from public.membros where conta_id=p_conta and user_id=(select auth.uid()) and ativo
  );
$$;

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
    when 'profissional' then '{"agenda.propria":true,"atendimentos.proprios":true,"atendimentos.atualizar_proprios":true,"clientes.vinculados":true,"catalogo.ver":true}'::jsonb
    else '{}'::jsonb
  end;
  return base || coalesce(m.permissoes,'{}'::jsonb);
end $$;

create or replace function public.tem_permissao(p_conta uuid,p_permissao text) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((public.permissoes_membro(p_conta)->>p_permissao)::boolean,false);
$$;

create or replace function public.meu_profissional(p_conta uuid) returns text
language sql stable security definer set search_path='' as $$
  select profissional_id from public.membros
  where conta_id=p_conta and user_id=(select auth.uid()) and ativo limit 1;
$$;

create or replace function public.cliente_vinculado_ao_profissional(p_conta uuid,p_cliente text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.dados d
    where d.conta_id=p_conta and d.colecao='servicos' and not d.excluido
      and d.dados->>'clienteId'=p_cliente
      and nullif(d.dados->>'profissionalId','')=public.meu_profissional(p_conta)
  );
$$;

create or replace function public.pode_ler_dado(p_conta uuid,p_colecao text,p_id text,p_dados jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare prof text;
begin
  if not public.eh_membro(p_conta) then return false; end if;
  if p_colecao='config' then return true; end if;
  if p_colecao='catalogo' then return public.tem_permissao(p_conta,'catalogo.ver'); end if;
  if p_colecao='profissionais' then return public.tem_permissao(p_conta,'equipe.ver') or public.meu_profissional(p_conta)=p_id; end if;
  if p_colecao='clientes' then
    return public.tem_permissao(p_conta,'clientes.ver')
      or (public.tem_permissao(p_conta,'clientes.vinculados') and public.cliente_vinculado_ao_profissional(p_conta,p_id));
  end if;
  if p_colecao='servicos' then
    if public.tem_permissao(p_conta,'agenda.ver_todas') or public.tem_permissao(p_conta,'atendimentos.ver_todos') then return true; end if;
    prof:=public.meu_profissional(p_conta);
    return prof is not null and nullif(p_dados->>'profissionalId','')=prof
      and (public.tem_permissao(p_conta,'agenda.propria') or public.tem_permissao(p_conta,'atendimentos.proprios'));
  end if;
  if p_colecao in ('lancamentos','despesasFixas') then return public.tem_permissao(p_conta,'financeiro.ver'); end if;
  if p_colecao='movimentacoesEstoque' then return public.tem_permissao(p_conta,'estoque.ver'); end if;
  return false;
end $$;

create or replace function public.pode_inserir_dado(p_conta uuid,p_colecao text,p_id text,p_dados jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
  if not public.eh_membro(p_conta) then return false; end if;
  if p_colecao='config' then return public.tem_permissao(p_conta,'config.editar'); end if;
  if p_colecao='catalogo' then return public.tem_permissao(p_conta,'catalogo.editar'); end if;
  if p_colecao='profissionais' then return public.tem_permissao(p_conta,'equipe.editar'); end if;
  if p_colecao='clientes' then return public.tem_permissao(p_conta,'clientes.editar'); end if;
  if p_colecao='servicos' then return public.tem_permissao(p_conta,'agenda.editar'); end if;
  if p_colecao='lancamentos' then return public.tem_permissao(p_conta,'financeiro.editar') or public.tem_permissao(p_conta,'financeiro.receber'); end if;
  if p_colecao='despesasFixas' then return public.tem_permissao(p_conta,'financeiro.editar'); end if;
  if p_colecao='movimentacoesEstoque' then return public.tem_permissao(p_conta,'estoque.editar'); end if;
  return false;
end $$;

create or replace function public.pode_atualizar_dado(p_conta uuid,p_colecao text,p_id text,p_dados jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare prof text;
begin
  if not public.eh_membro(p_conta) then return false; end if;
  if p_colecao='servicos' then
    if public.tem_permissao(p_conta,'agenda.editar') then return true; end if;
    prof:=public.meu_profissional(p_conta);
    return prof is not null and nullif(p_dados->>'profissionalId','')=prof
      and public.tem_permissao(p_conta,'atendimentos.atualizar_proprios');
  end if;
  return public.pode_inserir_dado(p_conta,p_colecao,p_id,p_dados);
end $$;

revoke all on function public.permissoes_membro(uuid),public.tem_permissao(uuid,text),
 public.meu_profissional(uuid),public.cliente_vinculado_ao_profissional(uuid,text),
 public.pode_ler_dado(uuid,text,text,jsonb),public.pode_inserir_dado(uuid,text,text,jsonb),
 public.pode_atualizar_dado(uuid,text,text,jsonb) from public,anon;
grant execute on function public.permissoes_membro(uuid),public.tem_permissao(uuid,text),
 public.meu_profissional(uuid),public.cliente_vinculado_ao_profissional(uuid,text),
 public.pode_ler_dado(uuid,text,text,jsonb),public.pode_inserir_dado(uuid,text,text,jsonb),
 public.pode_atualizar_dado(uuid,text,text,jsonb) to authenticated;

create or replace function private.auditar_empresa(
 p_conta uuid,p_acao text,p_entidade text,p_entidade_id text,p_detalhes jsonb default '{}'::jsonb
) returns void language sql security definer set search_path='' as $$
  insert into public.auditoria_empresa(conta_id,user_id,acao,entidade,entidade_id,detalhes)
  values(p_conta,(select auth.uid()),p_acao,p_entidade,p_entidade_id,coalesce(p_detalhes,'{}'::jsonb));
$$;
revoke all on function private.auditar_empresa(uuid,text,text,text,jsonb) from public,anon,authenticated;

create or replace function public.listar_equipe(p_conta uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
  if not public.tem_permissao(p_conta,'equipe.ver') then raise exception 'SEM_PERMISSAO' using errcode='42501'; end if;
  select jsonb_build_object(
    'membros',coalesce((select jsonb_agg(jsonb_build_object(
      'user_id',m.user_id,'email',u.email,'papel',m.papel,'profissional_id',m.profissional_id,
      'permissoes',m.permissoes,'ativo',m.ativo,'criado_em',m.criado_em
    ) order by case m.papel when 'dono' then 0 when 'gerente' then 1 when 'recepcionista' then 2 else 3 end,u.email)
      from public.membros m join auth.users u on u.id=m.user_id where m.conta_id=p_conta),'[]'::jsonb),
    'convites',coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'email',c.email,'papel',c.papel,'profissional_id',c.profissional_id,
      'permissoes',c.permissoes,'expira_em',c.expira_em,'criado_em',c.criado_em
    ) order by c.criado_em desc)
      from public.convites_membros c where c.conta_id=p_conta and c.aceito_em is null and c.cancelado_em is null),'[]'::jsonb)
  ) into v;
  return v;
end $$;

create or replace function public.criar_convite(
 p_conta uuid,p_email text,p_papel text,p_profissional_id text default null,p_permissoes jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_email text;
begin
  if not public.tem_permissao(p_conta,'convites.gerenciar') then raise exception 'SEM_PERMISSAO' using errcode='42501'; end if;
  if p_papel not in ('gerente','recepcionista','profissional') then raise exception 'PAPEL_INVALIDO'; end if;
  v_email:=lower(trim(coalesce(p_email,'')));
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'EMAIL_INVALIDO'; end if;
  if jsonb_typeof(coalesce(p_permissoes,'{}'::jsonb))<>'object' then raise exception 'PERMISSOES_INVALIDAS'; end if;
  if exists(select 1 from public.membros m join auth.users u on u.id=m.user_id
            where m.conta_id=p_conta and lower(u.email)=v_email and m.ativo) then raise exception 'USUARIO_JA_MEMBRO'; end if;
  if p_profissional_id is not null and not exists(
    select 1 from public.dados where conta_id=p_conta and colecao='profissionais' and id=p_profissional_id and not excluido
  ) then raise exception 'PROFISSIONAL_INVALIDO'; end if;
  insert into public.convites_membros(conta_id,email,papel,profissional_id,permissoes,criado_por)
  values(p_conta,v_email,p_papel,p_profissional_id,coalesce(p_permissoes,'{}'::jsonb),(select auth.uid()))
  returning id into v_id;
  perform private.auditar_empresa(p_conta,'criar','convite',v_id::text,jsonb_build_object('email',v_email,'papel',p_papel));
  return v_id;
end $$;

create or replace function public.reenviar_convite(p_conta uuid,p_convite uuid) returns uuid
language plpgsql security definer set search_path='' as $$
begin
  if not public.tem_permissao(p_conta,'convites.gerenciar') then raise exception 'SEM_PERMISSAO' using errcode='42501'; end if;
  update public.convites_membros set expira_em=now()+interval '7 days',atualizado_em=now()
   where id=p_convite and conta_id=p_conta and aceito_em is null and cancelado_em is null;
  if not found then raise exception 'CONVITE_NAO_ENCONTRADO'; end if;
  perform private.auditar_empresa(p_conta,'reenviar','convite',p_convite::text);
  return p_convite;
end $$;

create or replace function public.cancelar_convite(p_conta uuid,p_convite uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.tem_permissao(p_conta,'convites.gerenciar') then raise exception 'SEM_PERMISSAO' using errcode='42501'; end if;
  update public.convites_membros set cancelado_em=now(),atualizado_em=now()
   where id=p_convite and conta_id=p_conta and aceito_em is null and cancelado_em is null;
  if not found then raise exception 'CONVITE_NAO_ENCONTRADO'; end if;
  perform private.auditar_empresa(p_conta,'cancelar','convite',p_convite::text);
end $$;

create or replace function public.meus_convites_pendentes() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_email text;
begin
  select lower(email) into v_email from auth.users where id=(select auth.uid());
  if v_email is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'conta_id',i.conta_id,'nome_negocio',c.nome_negocio,'papel',i.papel,
      'profissional_id',i.profissional_id,'expira_em',i.expira_em
    ) order by i.criado_em)
    from public.convites_membros i join public.contas c on c.id=i.conta_id
    where lower(i.email)=v_email and i.aceito_em is null and i.cancelado_em is null and i.expira_em>now()),'[]'::jsonb);
end $$;

create or replace function public.aceitar_convite(p_convite uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.convites_membros%rowtype; v_email text;
begin
  if (select auth.uid()) is null then raise exception 'AUTENTICACAO_OBRIGATORIA' using errcode='28000'; end if;
  select lower(email) into v_email from auth.users where id=(select auth.uid());
  select * into v from public.convites_membros where id=p_convite for update;
  if not found or v.aceito_em is not null or v.cancelado_em is not null then raise exception 'CONVITE_INVALIDO'; end if;
  if v.expira_em<=now() then raise exception 'CONVITE_EXPIRADO'; end if;
  if lower(v.email)<>v_email then raise exception 'CONVITE_OUTRO_EMAIL' using errcode='42501'; end if;
  insert into public.membros(conta_id,user_id,papel,profissional_id,permissoes,ativo)
  values(v.conta_id,(select auth.uid()),v.papel,v.profissional_id,v.permissoes,true)
  on conflict(conta_id,user_id) do update set papel=excluded.papel,profissional_id=excluded.profissional_id,
    permissoes=excluded.permissoes,ativo=true,atualizado_em=now();
  update public.convites_membros set aceito_em=now(),atualizado_em=now() where id=v.id;
  perform private.auditar_empresa(v.conta_id,'aceitar','convite',v.id::text,jsonb_build_object('papel',v.papel));
  return v.conta_id;
end $$;

create or replace function public.atualizar_membro(
 p_conta uuid,p_user uuid,p_papel text,p_profissional_id text default null,p_permissoes jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path='' as $$
declare v_atual text;
begin
  if not public.tem_permissao(p_conta,'equipe.editar') then raise exception 'SEM_PERMISSAO' using errcode='42501'; end if;
  select papel into v_atual from public.membros where conta_id=p_conta and user_id=p_user for update;
  if not found then raise exception 'MEMBRO_NAO_ENCONTRADO'; end if;
  if v_atual='dono' or p_papel='dono' then raise exception 'PROPRIETARIO_PROTEGIDO' using errcode='42501'; end if;
  if p_papel not in ('gerente','recepcionista','profissional') then raise exception 'PAPEL_INVALIDO'; end if;
  if p_profissional_id is not null and not exists(
    select 1 from public.dados where conta_id=p_conta and colecao='profissionais' and id=p_profissional_id and not excluido
  ) then raise exception 'PROFISSIONAL_INVALIDO'; end if;
  update public.membros set papel=p_papel,profissional_id=p_profissional_id,
    permissoes=coalesce(p_permissoes,'{}'::jsonb),atualizado_em=now()
  where conta_id=p_conta and user_id=p_user;
  perform private.auditar_empresa(p_conta,'atualizar','membro',p_user::text,jsonb_build_object('papel',p_papel));
end $$;

create or replace function public.revogar_membro(p_conta uuid,p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_papel text;
begin
  if not public.tem_permissao(p_conta,'equipe.editar') then raise exception 'SEM_PERMISSAO' using errcode='42501'; end if;
  select papel into v_papel from public.membros where conta_id=p_conta and user_id=p_user for update;
  if not found then raise exception 'MEMBRO_NAO_ENCONTRADO'; end if;
  if v_papel='dono' then raise exception 'PROPRIETARIO_PROTEGIDO' using errcode='42501'; end if;
  update public.membros set ativo=false,atualizado_em=now() where conta_id=p_conta and user_id=p_user;
  perform private.auditar_empresa(p_conta,'revogar','membro',p_user::text);
end $$;

revoke all on function public.listar_equipe(uuid),public.criar_convite(uuid,text,text,text,jsonb),
 public.reenviar_convite(uuid,uuid),public.cancelar_convite(uuid,uuid),
 public.meus_convites_pendentes(),public.aceitar_convite(uuid),
 public.atualizar_membro(uuid,uuid,text,text,jsonb),public.revogar_membro(uuid,uuid) from public,anon;
grant execute on function public.listar_equipe(uuid),public.criar_convite(uuid,text,text,text,jsonb),
 public.reenviar_convite(uuid,uuid),public.cancelar_convite(uuid,uuid),
 public.meus_convites_pendentes(),public.aceitar_convite(uuid),
 public.atualizar_membro(uuid,uuid,text,text,jsonb),public.revogar_membro(uuid,uuid) to authenticated;

create or replace function private.criar_conta_usuario() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_plano uuid; v_dias int; v_conta uuid; v_nome text;
begin
  if exists(select 1 from public.convites_membros
    where lower(email)=lower(coalesce(new.email,'')) and aceito_em is null and cancelado_em is null and expira_em>now()) then
    return new;
  end if;
  select id into v_plano from public.planos where nome='Gratuito';
  if v_plano is null then raise exception 'Plano Gratuito não encontrado'; end if;
  select coalesce((valor #>> '{}')::int,14) into v_dias from public.config_sistema where chave='dias_teste';
  v_dias:=greatest(coalesce(v_dias,14),0);
  v_nome:=left(coalesce(nullif(trim(new.raw_user_meta_data->>'nome_negocio'),''),'Meu negócio'),150);
  insert into public.contas(nome_negocio,plano_id,status_assinatura,trial_ate)
  values(v_nome,v_plano,'trial',current_date+v_dias) returning id into v_conta;
  insert into public.membros(conta_id,user_id,papel) values(v_conta,new.id,'dono');
  return new;
end $$;

create or replace function public.atualizar_minha_assinatura(p_conta uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.eh_membro(p_conta) then raise exception 'CONTA_NAO_AUTORIZADA' using errcode='42501'; end if;
  perform private.atualizar_status(p_conta);
end $$;
revoke all on function public.atualizar_minha_assinatura(uuid) from public,anon;
grant execute on function public.atualizar_minha_assinatura(uuid) to authenticated;

create or replace function public.atualizar_minha_assinatura() returns void
language plpgsql security definer set search_path='' as $$
declare v_conta uuid; v_qtd int;
begin
  select count(*),min(conta_id) into v_qtd,v_conta from public.membros
   where user_id=(select auth.uid()) and ativo;
  if v_qtd<>1 then raise exception 'CONTA_EXPLICITA_OBRIGATORIA'; end if;
  perform private.atualizar_status(v_conta);
end $$;

create or replace function public.registrar_acesso(p_conta uuid,p_versao_app text default '') returns void
language plpgsql security definer set search_path='' as $$
declare v_total int; v_ultimo timestamptz;
begin
  if not public.eh_membro(p_conta) then raise exception 'CONTA_NAO_AUTORIZADA' using errcode='42501'; end if;
  perform private.atualizar_status(p_conta);
  select ultimo_acesso_em into v_ultimo from public.contas where id=p_conta for update;
  if v_ultimo is not null and v_ultimo>now()-interval '30 minutes' then return; end if;
  update public.contas set ultimo_acesso_em=now(),versao_app=left(coalesce(p_versao_app,''),80) where id=p_conta;
  select count(*) into v_total from public.dados where conta_id=p_conta and colecao='clientes' and not excluido;
  insert into public.uso_diario(conta_id,dia,acessos,clientes_total)
  values(p_conta,current_date,1,v_total)
  on conflict(conta_id,dia) do update set acessos=public.uso_diario.acessos+1,clientes_total=excluded.clientes_total;
end $$;
revoke all on function public.registrar_acesso(uuid,text) from public,anon;
grant execute on function public.registrar_acesso(uuid,text) to authenticated;

create or replace function public.registrar_acesso(p_versao_app text default '') returns void
language plpgsql security definer set search_path='' as $$
declare v_conta uuid; v_qtd int;
begin
  select count(*),min(conta_id) into v_qtd,v_conta from public.membros where user_id=(select auth.uid()) and ativo;
  if v_qtd<>1 then raise exception 'CONTA_EXPLICITA_OBRIGATORIA'; end if;
  perform public.registrar_acesso(v_conta,p_versao_app);
end $$;

create or replace function private.proteger_edicao_profissional() returns trigger
language plpgsql security definer set search_path='' as $$
declare permitido boolean;
begin
  if tg_op<>'UPDATE' or new.colecao<>'servicos' or (select auth.uid()) is null then return new; end if;
  if public.tem_permissao(new.conta_id,'agenda.editar') then return new; end if;
  permitido:=public.tem_permissao(new.conta_id,'atendimentos.atualizar_proprios')
    and public.meu_profissional(new.conta_id)=nullif(old.dados->>'profissionalId','')
    and public.meu_profissional(new.conta_id)=nullif(new.dados->>'profissionalId','');
  if not permitido then return new; end if;
  if (old.dados - 'status' - 'historico' - 'lembreteEnviadoEm')
     is distinct from (new.dados - 'status' - 'historico' - 'lembreteEnviadoEm') then
    raise exception 'PROFISSIONAL_SOMENTE_STATUS' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists admpro_proteger_edicao_profissional on public.dados;
create trigger admpro_proteger_edicao_profissional before update on public.dados
for each row execute function private.proteger_edicao_profissional();

create or replace function private.validar_dado() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  v_conta public.contas%rowtype; v_limites public.planos%rowtype; v_qtd int;
  v_prof text; v_inicio timestamp; v_fim timestamp; v_dur integer; v_simultaneo boolean:=false;
begin
  select * into v_conta from public.contas where id=new.conta_id for update;
  if not found then raise exception 'Conta inválida'; end if;
  if v_conta.status_assinatura='bloqueada' then raise exception 'CONTA_BLOQUEADA' using errcode='P0001'; end if;
  select * into v_limites from public.planos where id=v_conta.plano_id;
  if tg_op='UPDATE' then
    if new.conta_id<>old.conta_id or new.colecao<>old.colecao or new.id<>old.id or new.criado_em is distinct from old.criado_em then
      raise exception 'IDENTIDADE_IMUTAVEL' using errcode='42501';
    end if;
    if new.atualizado_em<=old.atualizado_em then raise exception 'STALE_WRITE' using errcode='P0001'; end if;
  end if;
  if new.atualizado_em>clock_timestamp()+interval '5 minutes' then raise exception 'RELOGIO_INVALIDO' using errcode='P0001'; end if;
  if new.colecao='clientes' and not new.excluido
    and (tg_op='INSERT' or (tg_op='UPDATE' and old.excluido)) and v_limites.limite_clientes is not null then
    select count(*) into v_qtd from public.dados where conta_id=new.conta_id and colecao='clientes' and not excluido;
    if v_qtd>=v_limites.limite_clientes then raise exception 'LIMITE_CLIENTES' using errcode='P0001'; end if;
  end if;
  if new.colecao='servicos' and not new.excluido
    and (tg_op='INSERT' or (tg_op='UPDATE' and old.excluido)) and v_limites.limite_servicos_mes is not null then
    select coalesce(sum(servicos_criados),0) into v_qtd from public.uso_diario
      where conta_id=new.conta_id and dia>=date_trunc('month',current_date)::date
      and dia<(date_trunc('month',current_date)+interval '1 month')::date;
    if v_qtd>=v_limites.limite_servicos_mes then raise exception 'LIMITE_SERVICOS_MES' using errcode='P0001'; end if;
  end if;
  if new.colecao='servicos' and not new.excluido and coalesce(new.dados->>'status','')<>'cancelado' then
    v_prof:=nullif(new.dados->>'profissionalId','');
    if v_prof is not null and (new.dados->>'data') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and (new.dados->>'hora') ~ '^[0-9]{2}:[0-9]{2}$' then
      select coalesce((dados->>'atendimentoSimultaneo')::boolean,false) into v_simultaneo
      from public.dados where conta_id=new.conta_id and colecao='profissionais' and id=v_prof and not excluido;
      if not coalesce(v_simultaneo,false) then
        perform pg_advisory_xact_lock(hashtextextended(new.conta_id::text||':'||v_prof,0));
        v_dur:=case when coalesce(new.dados->>'duracaoMin','') ~ '^[0-9]+$'
          then greatest(1,least(1440,(new.dados->>'duracaoMin')::integer)) else 60 end;
        v_inicio:=(new.dados->>'data')::date + (new.dados->>'hora')::time;
        v_fim:=v_inicio + v_dur*interval '1 minute';
        if exists(
          select 1 from public.dados d
          where d.conta_id=new.conta_id and d.colecao='servicos' and not d.excluido and d.id<>new.id
            and coalesce(d.dados->>'status','')<>'cancelado' and nullif(d.dados->>'profissionalId','')=v_prof
            and (d.dados->>'data') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and (d.dados->>'hora') ~ '^[0-9]{2}:[0-9]{2}$'
            and ((d.dados->>'data')::date + (d.dados->>'hora')::time) < v_fim
            and v_inicio < ((d.dados->>'data')::date + (d.dados->>'hora')::time
              + (case when coalesce(d.dados->>'duracaoMin','') ~ '^[0-9]+$'
                 then greatest(1,least(1440,(d.dados->>'duracaoMin')::integer)) else 60 end)*interval '1 minute')
        ) then raise exception 'CONFLITO_PROFISSIONAL' using errcode='P0001'; end if;
      end if;
    end if;
  end if;
  return new;
end $$;

alter table public.convites_membros enable row level security;
alter table public.auditoria_empresa enable row level security;
drop policy if exists contas_atualizar on public.contas;
create policy contas_atualizar on public.contas for update to authenticated
using ((select public.is_admin()) or public.tem_permissao(id,'config.editar'))
with check ((select public.is_admin()) or public.tem_permissao(id,'config.editar'));
drop policy if exists membros_ler on public.membros;
create policy membros_ler on public.membros for select to authenticated
using ((select public.is_admin()) or user_id=(select auth.uid()) or public.tem_permissao(conta_id,'equipe.ver'));
drop policy if exists dados_privados_ler on public.dados;
drop policy if exists dados_privados_inserir on public.dados;
drop policy if exists dados_privados_atualizar on public.dados;
create policy dados_privados_ler on public.dados for select to authenticated
using (public.pode_ler_dado(conta_id,colecao,id,dados));
create policy dados_privados_inserir on public.dados for insert to authenticated
with check (public.pode_inserir_dado(conta_id,colecao,id,dados)
  and exists(select 1 from public.contas where id=conta_id and status_assinatura<>'bloqueada'));
create policy dados_privados_atualizar on public.dados for update to authenticated
using (public.pode_ler_dado(conta_id,colecao,id,dados))
with check (public.pode_atualizar_dado(conta_id,colecao,id,dados)
  and exists(select 1 from public.contas where id=conta_id and status_assinatura<>'bloqueada'));
drop policy if exists pagamentos_ler on public.pagamentos;
create policy pagamentos_ler on public.pagamentos for select to authenticated
using ((select public.is_admin()) or public.tem_permissao(conta_id,'financeiro.ver'));
drop policy if exists uso_ler on public.uso_diario;
create policy uso_ler on public.uso_diario for select to authenticated
using ((select public.is_admin()) or public.tem_permissao(conta_id,'relatorios.operacionais'));
drop policy if exists convites_membros_ler on public.convites_membros;
create policy convites_membros_ler on public.convites_membros for select to authenticated
using (public.tem_permissao(conta_id,'equipe.ver'));
drop policy if exists auditoria_empresa_ler on public.auditoria_empresa;
create policy auditoria_empresa_ler on public.auditoria_empresa for select to authenticated
using (public.tem_permissao(conta_id,'auditoria.ver'));
revoke all on public.convites_membros,public.auditoria_empresa from public,anon,authenticated;
grant select on public.convites_membros,public.auditoria_empresa to authenticated;
grant select on public.membros to authenticated;

create or replace function public.console_equipe_metricas() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.console_exigir_admin();
  return jsonb_build_object(
    'usuarios',(select count(*) from public.membros),
    'usuarios_ativos',(select count(*) from public.membros where ativo),
    'profissionais',(select count(*) from public.dados where colecao='profissionais' and not excluido),
    'contas_multiprofissionais',(select count(*) from (
      select conta_id from public.dados where colecao='profissionais' and not excluido group by conta_id having count(*)>1
    ) x)
  );
end $$;
create or replace function public.console_equipe_conta(p_conta uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.console_exigir_admin();
  if not exists(select 1 from public.contas where id=p_conta) then raise exception 'Conta não encontrada'; end if;
  return jsonb_build_object(
    'usuarios',(select count(*) from public.membros where conta_id=p_conta),
    'usuarios_ativos',(select count(*) from public.membros where conta_id=p_conta and ativo),
    'profissionais',(select count(*) from public.dados where conta_id=p_conta and colecao='profissionais' and not excluido),
    'convites_pendentes',(select count(*) from public.convites_membros
      where conta_id=p_conta and aceito_em is null and cancelado_em is null and expira_em>now())
  );
end $$;
revoke all on function public.console_equipe_metricas(),public.console_equipe_conta(uuid) from public,anon;
grant execute on function public.console_equipe_metricas(),public.console_equipe_conta(uuid) to authenticated;
