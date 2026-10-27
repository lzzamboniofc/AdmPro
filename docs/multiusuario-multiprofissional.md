# AdmPro — evolução multiusuário e multiprofissional

Implementação realizada sobre a arquitetura existente do AdmPro, sem reconstrução do produto e sem alterar preços ou criar novos planos comerciais.

## Estado da implementação

A evolução mantém o modelo atual de dados por empresa e acrescenta identidade de membro, autorização centralizada, equipe multiprofissional, convites, seleção de empresa e agenda por profissional. Um profissional cadastrado continua sendo uma entidade operacional e **não precisa possuir login**.

O AdmPro Console permanece uma aplicação separada. Ele recebe apenas métricas agregadas de equipe e não passa a ter acesso aos dados privados operacionais de uma empresa por meio das permissões internas dessa empresa.

As migrations foram validadas e aplicadas somente no projeto Supabase **staging**. Nenhuma alteração desta entrega foi aplicada automaticamente em produção.

## Relacionamentos

- `contas`: empresa assinante.
- `membros`: vínculo N:N entre `auth.users` e `contas`; contém `papel`, `profissional_id` opcional, permissões adicionais e status ativo.
- `dados / profissionais`: profissional operacional. Pode existir sem usuário autenticado.
- `dados / servicos`: atendimento/agendamento. `profissionalId` é o responsável principal atual; `profissionalIds` já é gravado como array nos novos registros para não bloquear uma evolução futura para vários profissionais por atendimento.
- `convites_membros`: convite por empresa/e-mail, com perfil, profissional opcional, expiração, aceite e cancelamento.
- `auditoria_empresa`: auditoria interna das ações sensíveis de equipe, separada da auditoria administrativa do Console.

Um usuário pode possuir vários registros em `membros`, um para cada empresa da qual participa. O contexto ativo é sempre um `conta_id` explícito.

## Papéis e autorização

Os papéis iniciais são `dono`, `gerente`, `recepcionista` e `profissional`.

A autorização efetiva é centralizada em `permissoes_membro(conta_id)` e `tem_permissao(conta_id, permissao)`. Overrides adicionais ficam em `membros.permissoes`.

O frontend usa `js/permissoes.js` apenas para experiência e navegação. A autoridade final continua no PostgreSQL/RLS/RPCs.

Pontos de segurança:

- administrador do AdmPro Console não recebe acesso aos dados privados de uma empresa somente por ser admin;
- o mesmo usuário que também seja membro legítimo usa as permissões do papel empresarial;
- profissional recebe uma sincronização sanitizada, sem valores, parcelas, comissão ou configuração financeira;
- caches offline são separados por usuário + empresa e são limpos/sanitizados quando o escopo de permissão diminui;
- gerente não consegue atualizar diretamente campos de assinatura/plano da tabela `contas`;
- gravações usam controle otimista por `atualizado_em`, impedindo sobrescrita silenciosa de uma versão mais nova.

## Profissionais e disponibilidade

A tela **Configurações → Equipe e Profissionais** permite:

- nome, telefone e e-mail opcional;
- foto opcional;
- função e especialidade;
- serviços executados;
- cor na agenda;
- ativo/inativo;
- horários diferentes por dia;
- quantidade variável de períodos por dia;
- folga, férias, ausência e bloqueios por uma data ou intervalo de datas;
- atendimento simultâneo opcional;
- vínculo opcional entre profissional e usuário autenticado.

Desativar um profissional não apaga seu histórico. A interface nova não oferece exclusão física.

A disponibilidade é validada no frontend e também no PostgreSQL. O backend rejeita profissional inexistente, horário fora da jornada, intervalos, férias/ausências e sobreposição do mesmo profissional. A trava usa `pg_advisory_xact_lock` para continuar confiável quando duas pessoas tentam agendar simultaneamente.

## Agenda multiprofissional

- desktop: visualização diária de todos os profissionais em colunas;
- individual: filtro por profissional e jornada própria;
- semanal: filtro por profissional;
- celular: seletor de profissional e opção Todos;
- contas com um único profissional continuam com fluxo simplificado;
- ao criar atendimento com apenas um profissional ativo, ele é selecionado automaticamente;
- agendamentos antigos sem profissional continuam como “Sem profissional”; não há reatribuição silenciosa.

## Convites e acesso

O proprietário/usuário autorizado pode criar convite por e-mail, papel e profissional associado.

O convite possui expiração, bloqueio contra duplicidade pendente, cancelamento, renovação de validade e aceite somente pelo usuário autenticado com o mesmo e-mail. O frontend gera um link de convite seguro para copiar/enviar. Não existe uso de `service_role` no navegador.

Quando um usuário cria conta a partir de um convite pendente, o trigger de cadastro não cria uma empresa paralela automaticamente. O vínculo empresarial é criado somente no aceite.

## Planos e limites futuros

Nenhum preço foi alterado. Nenhum plano novo foi criado. Nenhum limite de equipe foi ativado.

Foram adicionados campos anuláveis:

- `limite_profissionais`;
- `limite_usuarios`;
- `limite_unidades`.

`NULL` significa sem limite. Se `limite_usuarios` ou `limite_profissionais` forem configurados futuramente, o backend já aplica a validação de forma transacional. Recursos adicionais continuam podendo ser expressos por permissões/recursos configuráveis, sem valores fixos espalhados pelo frontend.

## AdmPro Console

O Console passa a exibir:

- usuários vinculados;
- usuários ativos;
- profissionais;
- contas multiprofissionais;
- métricas de equipe por conta;
- convites pendentes por conta.

As RPCs do Console continuam exigindo `is_admin()`. Papéis internos de uma empresa não concedem acesso ao Console.

## Migrations

Aplicar as migrations do diretório `supabase/migrations/` em ordem de nome, após o schema/base já utilizado pelo AdmPro. As migrations desta evolução são aditivas e usam `create or replace`, `add column if not exists`, índices e políticas específicas.

Principais arquivos:

1. `20261027180000_multiusuario_multiprofissional.sql`
2. `20261027180100_multiusuario_indexes.sql`
3. `20261027180200_multiusuario_membership_rls_fix.sql`
4. `20261027180300_multiusuario_conflict_regex_fix.sql`
5. `20261027180400_professional_availability_guard.sql`
6. `20261027180500_optimistic_writes.sql`
7. `20261027180600_professional_private_sync.sql`
8. `20261027180700_future_plan_limits.sql`
9. `20261027180800_professional_absence_ranges.sql`
10. `20261027180900_professional_minimal_permissions.sql`
11. `20261027181000_secure_company_profile.sql`
12. `20261027181100_guard_permission_grants.sql`
13. `20261027181200_atomic_reception_payments.sql`
14. `20261027181300_invite_confirmed_email_guard.sql`
15. `20261027181400_protect_reception_service_values.sql`
16. `20261027181500_account_status_rls_write_guard.sql`

Algumas migrations posteriores também consolidam correções feitas durante a validação no staging. Elas devem permanecer na sequência para que ambientes que já receberam uma versão anterior cheguem ao mesmo estado final.

## Implantação

1. Fazer backup do banco e confirmar o projeto Supabase alvo.
2. Aplicar as migrations acima no banco de staging/produção conforme o fluxo de deploy adotado.
3. Publicar primeiro o AdmPro da branch/PR correspondente.
4. Publicar o AdmPro Console com as novas métricas.
5. Fazer login como proprietário e conferir Equipe e Profissionais.
6. Criar um profissional sem login e um convite de teste.
7. Testar o aceite com uma segunda conta de usuário.
8. Validar agenda, recebimento, status e troca de empresa.
9. Somente depois promover para produção.

## Testes executados no staging

Todos os testes de banco abaixo foram executados dentro de transações com `ROLLBACK` quando criavam dados temporários:

- proprietário mantém permissões completas de equipe;
- criação e cancelamento de convite;
- recepcionista possui agenda operacional e não possui `financeiro.ver`;
- profissional enxerga somente seu atendimento e cliente vinculado;
- profissional não consegue ler atendimento/configuração/profissional em formato bruto;
- sincronização do profissional remove total, desconto, parcelas, preço unitário, comissão e configuração financeira;
- profissional consegue atualizar o status do próprio atendimento;
- conclusão pelo profissional preserva efeitos de estoque e geração de recorrência via backend seguro;
- profissional não atualiza atendimento de outro profissional;
- conflito do mesmo profissional é bloqueado;
- profissionais diferentes podem atender no mesmo horário;
- jornada individual, almoço, ausência e horário externo são bloqueados;
- férias por intervalo de datas são bloqueadas e a disponibilidade volta após o período;
- profissional inexistente é rejeitado;
- acesso cruzado a outra empresa é bloqueado;
- escrita baseada em versão antiga recebe `STALE_WRITE`;
- limites futuros de usuários/profissionais bloqueiam quando temporariamente configurados e não atuam quando `NULL`;
- gerente consegue alterar dados operacionais da empresa pela RPC segura e não consegue alterar assinatura diretamente;
- gerente não consegue conceder permissões que não possui, conceder privilégios exclusivos de assinatura, atribuir tipos de permissões inválidos nem alterar o próprio papel;
- autenticação do AdmPro Console continua válida para admin;
- `console_resumo`, métricas globais de equipe e métricas por conta continuam respondendo;
- sintaxe dos módulos JavaScript modificados foi validada;
- não foram encontrados usos nativos de `alert()`, `confirm()` ou `prompt()` nos módulos/testes JavaScript revisados.

## Testes automáticos no GitHub Actions

O workflow `.github/workflows/staging-tests.yml` verifica sintaxe de todos os módulos JavaScript, integridade do vendor Supabase, regras de horários/modelos e as operações reais do adaptador de armazenamento usando mocks das RPCs (incluindo `STALE_WRITE` e separação de cache por usuário + empresa).

O workflow `.github/workflows/browser-multiusuario.yml` usa **Chromium real com Playwright**, sem acesso a dados de clientes ou usuários de staging/produção. Os testes de navegador cobrem:

- proprietário entrando com PIN local e cadastrando profissional, ausência e convite;
- agenda geral por profissional em desktop e ausência de overflow horizontal no mobile;
- profissional criando PIN sem precisar de `config.editar`, consultando agenda própria e recebendo acesso restrito às áreas proibidas;
- usuário convidado aceitando convite autenticado e recebendo o vínculo correto;
- usuário com duas empresas trocando de contexto, criando PIN local na segunda empresa e consultando somente os dados da empresa ativa.

No AdmPro Console, `.github/workflows/test-pr.yml` executa os testes estáticos, de templates e de integridade da biblioteca Supabase no PR sem disparar publicação em produção.

**Limitação destes testes:** o navegador utiliza um Supabase simulado. Regras de RLS e RPCs foram testadas separadamente no banco de staging com transações revertidas, mas não houve uma sessão E2E completa contra o Auth real com e-mail de confirmação.

## Homologação adicional de recebimentos e revogação (staging)

- `financeiro.receber` não concede permissão para criar ou alterar lançamentos financeiros genéricos. Para registrar pagamentos de atendimento, a recepção usa `registrar_recebimento_atendimento`, que grava receita e parcela dentro de **uma única transação PostgreSQL**.
- O backend valida vínculo ativo, parcelas, valor, status e método de pagamento, impedindo duplicação do mesmo recebimento. Nos testes transacionais, duas parcelas produziram exatamente duas entradas e o atendimento ficou `pago`.
- Perfis com apenas permissão de recebimento não podem estornar pagamentos nem editar livremente lançamentos financeiros. A operação exige internet; se houver mudanças locais pendentes, elas precisam ser sincronizadas primeiro.
- A recepção também não pode alterar o total, desconto, itens ou parcelas de um atendimento existente; ainda pode editar dados operacionais como o horário. O pagamento pela RPC preserva essas restrições e atualiza as parcelas com um contexto transacional autorizado.
- A RLS de `public.dados` agora verifica a assinatura por `conta_gravavel`, sem depender de uma consulta direta do funcionário à tabela `contas`. Isso preserva a privacidade dos dados comerciais e permite os registros operacionais legítimos.
- Um convite não pode substituir as permissões de um membro já ativo (incluindo proprietário). O aceite exige e-mail confirmado no Supabase Auth.
- A revalidação de vínculo/permissões acontece na reconexão e quando a aba volta ao primeiro plano. Ao detectar revogação, o cache da empresa é apagado. Ao detectar alteração de permissões, dados antigos são descartados e relidos pelas RPCs sanitizadas. **Enquanto o dispositivo estiver realmente offline, não existe revogação instantânea de uma sessão previamente armazenada; a revogação passa a valer após reconexão.**
- Todos os testes SQL de recebimento, duplicidade, permissão de recepção, proteção de preços e parcelas, alteração legítima do horário, bloqueio de convite antigo, revogação de vínculo e negação das RPCs foram executados com `ROLLBACK`.
- O E2E em Chromium com mock agora inclui recepção, tentativa de acesso a Financeiro, revogação na reconexão e rebaixamento de permissões com limpeza do cache.

**Limite de homologação Auth:** o staging possui apenas um usuário Auth confirmado, portanto o teste com dois usuários reais e confirmação de um novo e-mail ainda não foi executado. O E2E de aceite funciona com Auth simulado, e as validações de aceite e autorização do banco foram testadas com SQL transacional. Para homologação real completa, usar um segundo usuário de testes controlado, com e-mail acessível, e verificar a confirmação e o aceite na aplicação publicada em ambiente de staging.

## Validação ainda recomendada antes de produção

Antes de promover, executar testes finais com contas reais de homologação e sem dados de assinantes reais, em desktop e celular: confirmação de e-mail do convite, vinculação real no Auth, troca entre empresas com permissões distintas, foto do profissional, recebimento pela recepção e modo offline após alterações de permissão. Os testes automáticos de navegador e de banco não substituem essa homologação.

O advisor de segurança do staging também informa que a proteção contra senhas vazadas está desabilitada na configuração de Auth. Isso é configuração do projeto Supabase, não código desta evolução, e deve ser habilitado antes da promoção quando compatível com a política de autenticação adotada.
