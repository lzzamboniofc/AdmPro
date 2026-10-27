# AdmPro Staging — status de 27/10/2026

Projeto Supabase: `admpro-staging`, ref `stvenawjeyyhpvwvpjkm`, região `sa-east-1`.
URL pública: https://stvenawjeyyhpvwvpjkm.supabase.co

**Migrações aplicadas e verificadas:** `admpro_initial_schema`, `admpro_harden_access`, `admpro_enable_daily_subscription_cron`.
As dez tabelas possuem RLS ativo. Os seeds Gratuito e Pro estão presentes. Preço do Pro e Pix ainda não foram definidos.

**Agendamento:** `cron.job` contém `admpro_atualizar_assinaturas` ativo, com horário `17 3 * * *`.

**Testes transacionais aprovados no banco real (tudo revertido por ROLLBACK):**
- criação automática de conta/membro após INSERT de usuário Auth;
- leitura e escrita de outra conta negadas por RLS;
- atualização do próprio plano negada;
- limites de 30 clientes e 40 serviços no mês;
- conta bloqueada em somente leitura, com feedback de pagamento permitido;
- RPC registrar_acesso limitada a uma chamada em 30 minutos;
- administrador sem leitura na tabela dados.

**Pendências:** testes Auth reais com confirmação de e-mail, configuração de URL de redirecionamento e SMTP, biblioteca UMD local, integração completa do front-end na branch, teste offline no navegador e revisão jurídica. O preço do Pro deve ser definido antes de vender assinaturas. Não executar novamente o schema completo neste projeto já migrado.

**Avisos de segurança:** o Supabase aponta funções SECURITY DEFINER autenticadas (projetadas para operar na própria conta); são avisos a revisar continuamente. Os testes transacionais não substituem uma auditoria de segurança ou testes de ponta a ponta.
