-- Evita escalonamento de privilégios por requisições manipuladas.
-- Validação de concessões: nunca permitir poderes de proprietário via override.
create or replace function private.validar_concessao_permissoes(p_conta uuid,p_permissoes jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare k text; v jsonb; permissoes jsonb:=coalesce(p_permissoes,'{}'::jsonb);
begin
  if not public.tem_permissao(p_conta,'equipe.editar')
     and not public.tem_permissao(p_conta,'convites.gerenciar') then
    raise exception 'SEM_PERMISSAO' using errcode='42501';
  end if;
  if jsonb_typeof(permissoes)<>'object' then raise exception 'PERMISSOES_INVALIDAS'; end if;
  for k,v in select key,value from jsonb_each(permissoes) loop
    if k not in (
      'equipe.ver','equipe.editar','convites.gerenciar',
      'agenda.ver_todas','agenda.editar','agenda.propria',
      'atendimentos.ver_todos','atendimentos.proprios','atendimentos.atualizar_proprios',
      'clientes.ver','clientes.editar','clientes.vinculados','catalogo.ver','catalogo.editar',
      'financeiro.ver','financeiro.editar','financeiro.receber',
      'estoque.ver','estoque.editar','relatorios.operacionais','config.editar','auditoria.ver'
    ) then raise exception 'PERMISSAO_NAO_CONCEDIVEL' using errcode='42501'; end if;
    if jsonb_typeof(v)<>'boolean' then raise exception 'PERMISSAO_INVALIDA'; end if;
    if v='true'::jsonb and not public.tem_permissao(p_conta,k) then
      raise exception 'SEM_PERMISSAO_PARA_DELEGAR' using errcode='42501';
    end if;
  end loop;
  return permissoes;
end $$;
revoke all on function private.validar_concessao_permissoes(uuid,jsonb) from public,anon,authenticated;

create or replace function public.criar_convite(
 p_conta uuid,p_email text,p_papel text,p_profissional_id text default null,p_permissoes jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_email text; v_limite integer; v_ocupados integer; v_permissoes jsonb;
begin
  if not public.tem_permissao(p_conta,'convites.gerenciar') then raise exception 'SEM_PERMISSAO' using errcode='42501'; end if;
  if p_papel not in ('gerente','recepcionista','profissional') then raise exception 'PAPEL_INVALIDO'; end if;
  v_email:=lower(trim(coalesce(p_email,'')));
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'EMAIL_INVALIDO'; end if;
  v_permissoes:=private.validar_concessao_permissoes(p_conta,p_permissoes);

  perform 1 from public.contas where id=p_conta for update;
  if not found then raise exception 'CONTA_NAO_ENCONTRADA'; end if;

  if exists(select 1 from public.membros m join auth.users u on u.id=m.user_id
            where m.conta_id=p_conta and lower(u.email)=v_email and m.ativo) then
    raise exception 'USUARIO_JA_MEMBRO';
  end if;
  if p_profissional_id is not null and not exists(
    select 1 from public.dados where conta_id=p_conta and colecao='profissionais'
      and id=p_profissional_id and not excluido
  ) then raise exception 'PROFISSIONAL_INVALIDO'; end if;

  select p.limite_usuarios into v_limite
    from public.contas c join public.planos p on p.id=c.plano_id where c.id=p_conta;
  if v_limite is not null then
    select
      (select count(*) from public.membros where conta_id=p_conta and ativo)
      +(select count(*) from public.convites_membros
        where conta_id=p_conta and aceito_em is null and cancelado_em is null and expira_em>now())
    into v_ocupados;
    if v_ocupados>=v_limite then raise exception 'LIMITE_USUARIOS' using errcode='P0001'; end if;
  end if;

  insert into public.convites_membros(conta_id,email,papel,profissional_id,permissoes,criado_por)
  values(p_conta,v_email,p_papel,p_profissional_id,v_permissoes,(select auth.uid()))
  returning id into v_id;
  perform private.auditar_empresa(p_conta,'criar','convite',v_id::text,jsonb_build_object('email',v_email,'papel',p_papel));
  return v_id;
end $$;

create or replace function public.atualizar_membro(
 p_conta uuid,p_user uuid,p_papel text,p_profissional_id text default null,p_permissoes jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path='' as $$
declare v_atual text; v_permissoes jsonb;
begin
  if not public.tem_permissao(p_conta,'equipe.editar') then raise exception 'SEM_PERMISSAO' using errcode='42501'; end if;
  if p_user=(select auth.uid()) then raise exception 'AUTOALTERACAO_NEGADA' using errcode='42501'; end if;
  v_permissoes:=private.validar_concessao_permissoes(p_conta,p_permissoes);
  select papel into v_atual from public.membros where conta_id=p_conta and user_id=p_user for update;
  if not found then raise exception 'MEMBRO_NAO_ENCONTRADO'; end if;
  if v_atual='dono' or p_papel='dono' then raise exception 'PROPRIETARIO_PROTEGIDO' using errcode='42501'; end if;
  if p_papel not in ('gerente','recepcionista','profissional') then raise exception 'PAPEL_INVALIDO'; end if;
  if p_profissional_id is not null and not exists(
    select 1 from public.dados where conta_id=p_conta and colecao='profissionais' and id=p_profissional_id and not excluido
  ) then raise exception 'PROFISSIONAL_INVALIDO'; end if;
  update public.membros set papel=p_papel,profissional_id=p_profissional_id,
    permissoes=v_permissoes,atualizado_em=now()
  where conta_id=p_conta and user_id=p_user;
  perform private.auditar_empresa(p_conta,'atualizar','membro',p_user::text,jsonb_build_object('papel',p_papel));
end $$;
