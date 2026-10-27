# AdmPro — Preparação Supabase (versão de integração)

> **NÃO PUBLICAR SEM SEGUIR TODAS AS ETAPAS.** O esquema e o código foram preparados para revisão/testes, mas dependem de um projeto Supabase real, configuração de preço Pix, da biblioteca UMD e dos testes manuais indicados. Termos/privacidade são rascunhos jurídicos. **Nunca** publique a chave `service_role`/secret.

## 1. Aplicar os arquivos à versão original

O pacote contém os arquivos novos, o SQL e `instalar-integracao.mjs`, que transforma **arquivos existentes completos** da versão lida no repositório `lzzamboniofc/AdmPro` (branch `main` observada em 27/10/2026). Faça primeiro uma cópia/branch de trabalho, sem sobrescrever a versão em produção.

1. Obtenha o AdmPro original do repositório GitHub com `git clone` (ou baixe o ZIP do repositório).
2. Extraia este pacote em uma pasta separada.
3. Na pasta do pacote, execute `node instalar-integracao.mjs /caminho/para/AdmPro`. O instalador exige Node 18+ **apenas na máquina de desenvolvimento**. Não há build, webpack, npm, módulos ES ou dependências no site publicado (a aplicação permanece HTML/CSS/JS puro).
4. O script interrompe a operação se algum trecho original não corresponder ao esperado. Verifique `git diff` antes de publicar. Reexecutar não deve duplicar patches.
5. Arquivos originais modificados: `index.html`, `css/style.css`, `sw.js`, `js/app.js`, `js/storage.js`, `js/views/config.js`, `js/views/onboarding.js`. Arquivos originais **não modificados**: `js/utils.js`, `js/regras.js`, `js/modelos.js`, `js/ui.js`, `js/views/agenda.js`, `js/views/catalogo.js`, `js/views/clientes.js`, `js/views/servicos.js`, `js/views/financeiro.js`, `js/views/gestao.js`, `js/views/inicio.js`, `js/views/seguranca.js`, assets em `img/`, documentos antigos e testes antigos.

O `storage.js` permanece **a única porta** para coleções: mantém `obter`, `gravar`, `lista`, `adicionar`, `atualizar`, `excluir`, `importar`, `exportar` etc. com chamadas e resultados síncronos. O cache dá a resposta imediata e envia mutações ao servidor de forma assíncrona; novas funções async ficam em `A.storage`.

## 2. Criar e inicializar Supabase

1. Em [supabase.com](https://supabase.com), crie um projeto e selecione a região adequada, considerando LGPD e residência dos dados.
2. No **SQL Editor**, cole o arquivo completo `supabase/schema.sql` e execute com privilégios de proprietário. Ele cria todas as tabelas, seeds, índices, triggers, funções, políticas RLS e GRANTs. **Não execute como usuário comum.** Use um projeto de testes antes de executar em produção. O script usa `CREATE POLICY` sem `DROP POLICY`; execute **uma vez** em banco novo.
3. Execute SQL de verificação:
   ```sql
   select tablename, rowsecurity from pg_tables where schemaname='public'
     and tablename in ('planos','contas','membros','dados','pagamentos','uso_diario','avisos','feedbacks','config_sistema','admins');
   select nome,preco_mensal_centavos,limite_clientes,limite_servicos_mes from public.planos order by ordem;
   ```
   Todas as 10 tabelas devem retornar `rowsecurity = true`.
4. Em **Authentication > Providers > Email**, habilite Email e confirmação de e-mail (recomendado). Configure SMTP de produção, políticas de senha e proteção contra cadastros automáticos. A conta e o vínculo de membro são criados por trigger mesmo antes da confirmação do e-mail; o login só é permitido após o e-mail ser confirmado.
5. Em **Authentication > URL Configuration**, configure `Site URL` para o endereço de produção e `Redirect URLs` para o domínio publicado e o endereço local de testes, por exemplo `http://localhost:8080/**` e `https://SEUDOMINIO/**`. O reset de senha retorna ao `index.html`.
6. Em **Project Settings > API** (ou Connect), copie **Project URL** e somente a chave pública `anon`/publishable. Insira em `js/config.js`. Não coloque senha do banco, JWT secret, service_role ou chaves secretas no GitHub.
7. Em **Database > Extensions**, ative `pg_cron` se disponível e reexecute apenas o bloco `DO $cron$ ...` de `schema.sql` para agendar a atualização diária. O app também executa atualização de status por RPC no login. Se não houver `pg_cron`, configure uma chamada diária privada/cron externo autenticado ao banco (não exponha endpoint público para atualizar todos).

## 3. Biblioteca obrigatoriamente local (UMD)

Por limitação de download do ambiente de geração, a biblioteca **não está embutida neste pacote**. Faça o download **na máquina de desenvolvimento**, antes de publicar:

```bash
# Dentro do diretório do AdmPro, com Node/npm disponíveis apenas no desenvolvimento:
npm pack @supabase/supabase-js@2.117.3 --pack-destination .
mkdir -p /tmp/admpro-supabase-umd
tar -xzf supabase-supabase-js-2.117.3.tgz -C /tmp/admpro-supabase-umd
mkdir -p js/vendor
cp /tmp/admpro-supabase-umd/package/dist/umd/supabase.js js/vendor/supabase.js
rm supabase-supabase-js-2.117.3.tgz
```

Confirme `window.supabase.createClient` no navegador e que `js/vendor/supabase.js` está de fato no repositório/site publicado. **Não usar CDN, não carregar npm ou bundler em tempo de execução.** Verifique checksum e avisos de segurança antes do lançamento. Em Windows, use tar do Windows 10+ ou extrator de `.tgz`.

## 4. Preço do Pro, Pix e administrador

O seed Pro tem `preco_mensal_centavos = 0` e `recursos.preco_pendente = true`, pois a solicitação não informou preço. O app bloqueia instruções Pix até definir um preço REAL e desmarcar o pendente:

```sql
update public.planos set preco_mensal_centavos = 2990, recursos = recursos || '{"preco_pendente":false}'::jsonb
 where nome='Pro'; -- 2990 É APENAS EXEMPLO: substituir pelo preço aprovado.
update public.config_sistema set valor = to_jsonb('SUA_CHAVE_PIX'::text) where chave='pix_chave';
update public.config_sistema set valor = to_jsonb('NOME DO RECEBEDOR'::text) where chave='pix_nome_recebedor';
update public.config_sistema set valor = to_jsonb('5511999999999'::text) where chave='whatsapp_suporte';
```

Crie um usuário normal pelo aplicativo; em **Authentication > Users**, copie o UUID daquele usuário. Pelo SQL Editor (proprietário):

```sql
insert into public.admins(user_id) values ('UUID_DO_USUARIO_EXISTENTE'::uuid);
```

Não defina admin por `user_metadata`, `localStorage` ou código JavaScript. A RLS de `dados` **nega inclusive a administradores** ler coleções privadas; administradores consultam somente contas, planos, faturamento, métricas, avisos e feedbacks. Para gerenciar uma assinatura após confirmar manualmente o Pix:

```sql
-- Exemplo; executar exclusivamente com privilégios de admin, no painel futuro ou SQL Editor.
update public.contas set plano_id = (select id from public.planos where nome='Pro'),
  status_assinatura='ativa', proximo_vencimento=current_date+interval '30 days'
where id='UUID_DA_CONTA'::uuid;
insert into public.pagamentos(conta_id,valor_centavos,referencia,status,forma,pago_em)
values ('UUID_DA_CONTA'::uuid, 2990, to_char(current_date,'YYYY-MM'), 'pago', 'pix', now());
```

**Aprovação de Pix é MANUAL** nesta etapa. O botão "Já paguei, avisar" envia feedback tipo `pagamento` e nunca altera assinatura sozinho. Automação de pagamentos e painel de administração serão integrados depois.

## 5. Publicação e PWA

Teste sempre via servidor HTTP(S), não `file://`, por conta de Auth, recuperação de senha, clipboard e Service Worker. Desenvolvimento sem build: `python -m http.server 8080` na pasta do projeto. Publicação estática: GitHub Pages, Netlify ou Vercel (pasta raiz; sem build). Use HTTPS e configure as URLs de redirecionamento no Supabase para o domínio exato. O `sw.js` inclui `config.js`, biblioteca UMD e novos módulos para cache offline. **Nunca** configure cache do Service Worker para solicitações da API Supabase; o SW atual só trata recursos da mesma origem.

Em ambiente de produção, configure monitoramento de erros, backups automáticos do banco, políticas de retenção, política de exclusão, SMTP, proteção de abuso de Auth/feedback, controles de preços, autenticação forte para admins e revisão jurídica dos textos. Revise LGPD e a segurança das informações sensíveis mantidas offline no `localStorage` (cache não criptografado em repouso). O PIN é apenas bloqueio rápido, não impede leitura do `localStorage` por scripts no mesmo origin.

## 6. Teste de aceite

Siga `tests/supabase-manual.md`. Não liberar assinaturas reais antes de executar os testes contra um projeto Supabase de staging com pelo menos dois usuários e verificar políticas RLS. O instalador não aplica o esquema em um projeto remoto e não ativa cobrança automática.
## Testes locais

No pacote de integração disponível nesta conversa, execute `node tests/storage-sync-test.mjs`. Esse teste usa API simulada e **não substitui** testes RLS reais.
