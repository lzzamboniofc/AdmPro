-- Pré-publicação AdmPro multiusuário: somente leitura.
-- Cada verificação deve retornar TRUE; contagens devem corresponder ao valor esperado.
-- Executar SEPARADAMENTE em staging e, após backup, no ambiente escolhido para publicação.
select 'public.membros com RLS' verificacao,
       exists(select 1 from pg_tables where schemaname='public' and tablename='membros' and rowsecurity) aprovado
union all
select 'public.convites_membros com RLS',
       exists(select 1 from pg_tables where schemaname='public' and tablename='convites_membros' and rowsecurity)
union all
select 'public.dados com RLS',
       exists(select 1 from pg_tables where schemaname='public' and tablename='dados' and rowsecurity)
union all
select 'public.contas com RLS',
       exists(select 1 from pg_tables where schemaname='public' and tablename='contas' and rowsecurity)
union all
select 'RPC minhas_empresas',
       to_regprocedure('public.minhas_empresas()') is not null
union all
select 'RPC aceite de convite',
       to_regprocedure('public.aceitar_convite(uuid)') is not null
union all
select 'RPC sincronizacao isolada',
       to_regprocedure('public.sincronizar_dados(uuid,timestamp with time zone,integer,integer)') is not null
union all
select 'RPC escrita otimista',
       to_regprocedure('public.salvar_dado_otimista(uuid,text,text,jsonb,boolean,timestamp with time zone,boolean)') is not null
union all
select 'RPC recebimento transacional',
       to_regprocedure('public.registrar_recebimento_atendimento(uuid,text,text[],date,text,boolean)') is not null
union all
select 'RPC verificar assinatura',
       to_regprocedure('public.conta_gravavel(uuid)') is not null
union all
select 'Gatilho anti-alteracao de valores',
       exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
         join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='public' and c.relname='dados'
           and t.tgname='dados_proteger_valores_recepcao' and not t.tgisinternal)
union all
select 'Gatilho de cadastro de usuario',
       exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
         join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='auth' and c.relname='users'
           and t.tgname='admpro_novo_usuario' and not t.tgisinternal)
union all
select 'Colunas de limite futuras presentes',
       (select count(*)=3 from information_schema.columns
        where table_schema='public' and table_name='planos'
          and column_name in ('limite_profissionais','limite_usuarios','limite_unidades'))
order by verificacao;

-- Conferir isolamento de execucao da RPC (deve ser FALSE para anon):
select
  has_function_privilege('anon',
    'public.registrar_recebimento_atendimento(uuid,text,text[],date,text,boolean)','EXECUTE')
    as anon_pode_registrar_recebimento,
  has_function_privilege('authenticated',
    'public.registrar_recebimento_atendimento(uuid,text,text[],date,text,boolean)','EXECUTE')
    as autenticado_pode_registrar_recebimento;

-- Não habilitar limites comerciais agora: colunas devem permanecer NULL nos planos ativos,
-- exceto por configuração comercial EXPRESSAMENTE aprovada antes da publicação.
select nome,limite_profissionais,limite_usuarios,limite_unidades
from public.planos where ativo=true order by nome;
