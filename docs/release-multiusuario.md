# Preparação de publicação — AdmPro multiusuário e Console

**Estado:** homologação técnica concluída em parte. **Não aprovado para produção** enquanto o aceite de convite com e-mail real confirmado e a revisão do ambiente de publicação estiverem pendentes.

**Repositórios / PRs:**
- AdmPro: `lzzamboniofc/AdmPro` PR #1; destino do PR é **`feature/supabase-assinaturas-staging`**, **não `main`**.
- Console: `lzzamboniofc/admpro-console` PR #1; destino é **`main`**.
- O Console possui GitHub Actions que **publica automaticamente GitHub Pages quando `main` recebe um push/merge**. Por isso, **não mesclar o PR do Console** até concluir a etapa de testes e escolher a configuração do ambiente.
- O `js/config.js` da branch do AdmPro e o `js/config.js` do Console apontam para **`stvenawjeyyhpvwvpjkm` (staging)**. Não usar essas configurações para o ambiente real por engano.

## 1. Estado verificado no staging

- Migrations aplicadas somente em `admpro-staging`: 16 arquivos da evolução multiusuário, além das migrations de base/Console.
- Pré-validação de leitura: `supabase/preflight-multiusuario.sql` — 13 verificações de RLS/funções/gatilhos aprovadas, acesso anônimo à RPC de recebimento negado.
- Planos Easy e Pro: os limites de profissionais, usuários e unidades estão `NULL` (inativos).
- Testes em transações `ROLLBACK` cobrindo permissões de gerente e recepção, recebimento idempotente, proteção dos valores, convite não substituindo proprietário, revogação do vínculo e isolamento.
- Testes automatizados GitHub Actions: JavaScript, integridade da biblioteca Supabase, horários/sincronização e Chromium desktop/mobile. **O Chromium usa Supabase/Auth simulados**; não é prova de entrega SMTP nem de autenticação real.
- O gatilho `auth.users -> private.criar_conta_usuario()` detecta convite válido e pendente por e-mail e não cria automaticamente uma segunda empresa para esse novo usuário.

## 2. Homologação final de convite com Auth real (bloqueante)

Executar **somente em staging**, com caixa de e-mail de homologação controlada por quem vai testar; nenhuma senha deve ser enviada por chat ou armazenada no GitHub.

1. Escolher uma URL HTTPS de **preview/homologação**, que hospede os arquivos desta branch. Não usar `file://` para o teste de confirmação por e-mail. Conferir no navegador que `js/config.js` aponta exclusivamente para o staging.
2. No dashboard do **Supabase staging**, conferir **Authentication → URL Configuration**, `Site URL` e `Redirect URLs`. Autorizar o endereço exato da página `index.html` do preview e o fluxo com `?convite=<uuid>`; não abrir o allowlist indiscriminadamente. Testar também o redirecionamento de redefinição de senha.
3. Em **Authentication → Providers → Email**, confirmar que o fluxo exige e-mail confirmado; verificar template/SMTP de testes e redirecionamento para `{{ .RedirectTo }}` quando aplicável. No banco, `aceitar_convite` recusa e-mail ainda não confirmado.
4. Entrar no preview com a conta proprietária de homologação, cadastrar um profissional **sem login** e emitir um convite de papel recepcionista, preferencialmente vinculando-o somente se necessário.
5. Em **janela anônima diferente**, abrir o link como o destinatário real. Cadastrar-se usando **exatamente o e-mail convidado**; confirmar na caixa postal; concluir o callback e verificar que aparece a empresa do proprietário — e **nenhuma empresa automática extra**.
6. Confirmar que a recepcionista pode criar cliente, ajustar agenda e receber uma parcela pela tela de atendimento, mas **não** consegue criar lançamento avulso, visualizar Financeiro ou estornar parcelas sem permissão.
7. Em sessão do proprietário, rebaixar a permissão de edição ou revogar a recepcionista. Em uma aba que estava offline, voltar à internet e ao foco; confirmar que o aplicativo revalida as permissões e limpa os dados anteriores. Revogação **não é instantânea em dispositivo sem rede**.
8. Testar uma conta convidada com papel profissional (com `profissional_id` correto). Validar própria agenda, ocultação de valores financeiros e atualização operacional de status.
9. Testar aceitar convite expirado, cancelado, outro e-mail e convite já aceito. Nenhuma ação deve conceder acesso.
10. Registrar resultado, navegador/versão e data sem anexar senhas, tokens JWT, dados pessoais ou links de convite válidos.

Se o passo de confirmação de e-mail falhar, revisar `Redirect URLs`, SMTP e template; **não contornar a exigência de confirmação no banco**.

**Não executado automaticamente:** não há uma segunda conta Auth confirmada no staging nem acesso à caixa postal dela; os cenários de email/SMTP exigem uma pessoa com acesso ao e-mail de teste.

## 3. Preparação controlada para produção (ainda não executar)

1. Identificar e registrar claramente o Supabase **de produção**, endereço real da aplicação, endereço real do Console, equipe responsável e plano de comunicação. Não deduzir esses endereços a partir das branches de staging.
2. Realizar e **validar a recuperação** de um backup do banco real. Confirmar também políticas de backup/retention de Auth/Storage aplicáveis. Não copiar registros de clientes para preview.
3. Comparar schema e histórico de migrations entre produção e staging; aplicar **migrations aditivas em ordem** e com revisão, sem depender de nomes históricos gerados por `apply_migration` em staging. Evitar aplicar migrations duplicadas; o histórico do staging tem versões próprias porque foram executadas pelo Supabase MCP. Conferir efeitos DDL/dados, não apenas nomes.
4. Antes de habilitar frontend multiusuário contra produção, executar **somente leitura** `supabase/preflight-multiusuario.sql` no banco alvo e exigir todas as verificações `aprovado=true`; validar também que `anon_pode_registrar_recebimento=false` e `autenticado_pode_registrar_recebimento=true`.
5. Habilitar proteção contra senhas vazadas, revisar URL allowlist de Auth, SMTP, acesso ao Supabase e avisos do Security Advisor. As RPCs `SECURITY DEFINER` do sistema são chamadas por usuários autenticados e exigem revisão de cada guarda de permissão.
6. Preparar explicitamente **configurações públicas de produção** para AdmPro e Console. Nunca usar o URL Supabase staging, nem qualquer chave `service_role`, no front de produção. As chaves de navegador são *publishable*.
7. Atualizar a versão de cache do `sw.js` no commit de release e testar a atualização de PWA instalada. Conferir que alterações locais pendentes são sincronizadas antes da atualização/reconexão.
8. Publicar primeiro as migrations e o **AdmPro** com a configuração correta. Somente depois publicar o **Console**, pois as novas métricas dependem do backend atualizado.
9. Atenção ao fluxo Git: o PR AdmPro #1 termina na **branch de staging**, não vai automaticamente para `main`; o PR Console #1 em `main` pode disparar deploy automático pelo workflow `publicar-pages.yml`.
10. Executar smoke test real de login, convite, troca de empresas, profissional, agenda, recebimentos, bloqueio de permissões, pagamento de assinatura, Console, PWA mobile/desktop e backup/exportação antes de liberar assinantes.
11. Observar logs de Auth/API/SQL, indicadores de falha de sincronização, limites de recursos e comportamento de clientes existentes durante a ativação.

## 4. Recuperação se algo der errado

- **Falha de frontend/estilo/PWA:** desativar entrega da nova versão/reverter commit de frontend ao build anterior aprovado, **sem reverter o banco por conta própria**. Comunicar usuários que tenham filas offline pendentes; preservar backups. Verificar o cache do service worker para não deixar clientes executando JS antigo indefinidamente.
- **Falha de migrations/RLS:** interromper novas publicações e gravações afetadas; usar backup testado e plano de correção **forward-only** aprovado. Reverter apenas o frontend **não desfaz schema/roles**; restore de produção exige planejamento para não perder transações posteriores.
- **Erro de convite/Auth:** desativar fluxo externo e investigar URLs, templates e e-mail confirmado; não liberar convite sem checagem de e-mail. Nunca divulgar dados, senhas ou tokens do usuário.
- **Erro de recebimento:** suspender recebimentos no frontend e preservar os registros originais para conciliação; não executar operações de limpeza financeira automáticas.

## 5. Critérios para autorizar publicação

| Verificação | Resultado conhecido |
|---|---|
| Schema/RLS/RPCs no Supabase staging | Concluído |
| Limites de equipe inativos nos planos | Concluído |
| Checks de JavaScript e Chromium (backend simulado) | Concluído |
| Controle de recebimento, revogação e finanças no banco staging | Concluído |
| Segundo usuário Auth real + confirmação via e-mail | **Pendente** |
| Callback HTTPS + templates/SMTP no preview | **Pendente** |
| Identificação, backup testado e revisão do Supabase de produção | **Pendente** |
| Configuração de produção em ambos os frontends | **Pendente** |
| Merge/deploy em produção | **Não executado** |

A discussão de preços e eventuais limites comerciais dos planos Easy/Pro fica **fora do escopo** da publicação multiusuário.

## Fontes operacionais oficiais

- Supabase: [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- Supabase: [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- Supabase: [Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- Supabase: [Database Backups](https://supabase.com/docs/guides/platform/backups)
- Supabase: [Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations)
