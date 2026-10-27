-- HOMOLOGAÇÃO: executar somente no Supabase staging.
-- Simula criação de usuários Auth diretamente no PostgreSQL, sem enviar e-mails.
-- Todos os registros fictícios são revertidos pelo ROLLBACK, inclusive os de auth.users.
begin;
do $tests$
declare
  v_owner uuid:=gen_random_uuid();
  v_invited uuid:=gen_random_uuid();
  v_conta uuid;
  v_nome text;
  v_papel text;
  v_plano text;
  v_status text;
  v_trial int;
  v_count int;
begin
  -- Nova conta de proprietário recebe Easy e 14 dias (valor configurado no sistema).
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,
    email_confirmed_at,raw_user_meta_data)
  values('00000000-0000-0000-0000-000000000000',v_owner,
    'authenticated','authenticated',
    'admpro-owner-'||v_owner::text||'@example.test','INVALID-TEST-HASH',
    now(),'{"nome_negocio":"Teste de cadastro"}'::jsonb);

  select c.id,c.nome_negocio,m.papel,p.nome,c.status_assinatura,
         c.trial_ate-current_date
    into v_conta,v_nome,v_papel,v_plano,v_status,v_trial
    from public.membros m join public.contas c on c.id=m.conta_id
         join public.planos p on p.id=c.plano_id
    where m.user_id=v_owner;
  if v_conta is null or v_nome<>'Teste de cadastro' or v_papel<>'dono'
    or v_plano<>'Easy' or v_status<>'trial'
    or v_trial<>(select coalesce((valor #>> '{}')::int,14)
                 from public.config_sistema where chave='dias_teste')
  then raise exception 'FALHA_NOVO_PROPRIETARIO: %, %, %, %, %, %',
    v_conta,v_nome,v_papel,v_plano,v_status,v_trial;
  end if;

  -- Após o trial, voltar para Easy sem referenciar o plano Gratuito removido.
  update public.contas set trial_ate=current_date-1 where id=v_conta;
  perform private.atualizar_status(v_conta);
  select p.nome,c.status_assinatura into v_plano,v_status
    from public.contas c join public.planos p on p.id=c.plano_id where c.id=v_conta;
  if v_plano<>'Easy' or v_status<>'ativa'
    then raise exception 'FALHA_ENCERRAMENTO_TRIAL: %, %',v_plano,v_status;
  end if;

  -- O usuário que já recebeu um convite deve aproveitar a empresa existente.
  insert into public.convites_membros(conta_id,email,papel,criado_por)
  values(v_conta,'admpro-invited-'||v_invited::text||'@example.test',
    'recepcionista',v_owner);
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,
    email_confirmed_at,raw_user_meta_data)
  values('00000000-0000-0000-0000-000000000000',v_invited,
    'authenticated','authenticated',
    'admpro-invited-'||v_invited::text||'@example.test','INVALID-TEST-HASH',
    now(),'{"nome_negocio":"Não criar duplicata"}'::jsonb);
  select count(*) into v_count from public.membros where user_id=v_invited;
  if v_count<>0 then raise exception 'CONVIDADO_RECEBEU_EMPRESA_AUTOMATICA'; end if;
end $tests$;
rollback;
