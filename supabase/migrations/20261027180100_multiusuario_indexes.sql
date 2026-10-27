-- Índice recomendado pelo advisor após a migração multiusuário.
create index if not exists convites_membros_criado_por_idx on public.convites_membros(criado_por);
