-- Pagamentos só podem ser gravados/ajustados pelas RPCs administrativas auditadas.
revoke insert,update,delete on public.pagamentos from authenticated;
-- Um lançamento pendente pode ter valor zero; cancelamento deve ser possível.
alter table public.pagamentos_ajustes drop constraint if exists pagamentos_ajustes_valor_centavos_check;
alter table public.pagamentos_ajustes add constraint pagamentos_ajustes_valor_centavos_check
 check(valor_centavos>=0);