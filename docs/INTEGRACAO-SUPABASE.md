# Integração Supabase — staging

Branch separada da `main`. O esquema SQL está em `supabase/schema.sql`, há roteiro manual em `tests/supabase-manual.md`, e configurações e procedimentos em `SETUP.md`.

**Status:** documentação e schema versionados; os módulos de front-end e patches completos permanecem no pacote ZIP entregue na conversa e **ainda não foram aplicados a esta branch**. Não fazer deploy desta branch como produto por assinatura.

Nenhum projeto Supabase identificado como AdmPro está acessível na conexão atual. Não aplicar SQL em projetos não relacionados. O pacote inclui testes locais com backend simulado, mas RLS deve ser testada num projeto staging real.
