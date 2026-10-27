# AdmPro

Aplicativo de gestão para autônomos, profissionais e empresas com equipes — HTML, CSS e JavaScript sem build, com **Supabase Auth, banco compartilhado entre o app e o AdmPro Console, permissões por empresa e sincronização**.

> **Estado em outubro de 2026:** a evolução multiusuário e multiprofissional está em homologação no branch `feature/multiusuario-multiprofissional`. Esta branch usa **somente o Supabase staging**. Não publicar nem promover dados de produção antes do procedimento em [docs/release-multiusuario.md](docs/release-multiusuario.md).

## Como testar a versão atual

1. Disponibilize a pasta via HTTPS ou servidor local para permitir Auth, callbacks de e-mail e PWA. O arquivo `index.html` preserva arquivos relativos, mas **o fluxo de login/sincronização depende de acesso à rede**.
2. Confira `js/config.js`: a versão do PR aponta exclusivamente para `admpro-staging`. Não inserir a chave `service_role` no navegador, Console ou repositório.
3. Abra o aplicativo, faça login com uma conta de homologação autorizada. O PIN de quatro dígitos é uma **proteção local complementar**, não substitui o Supabase Auth.
4. Em **Equipe e Profissionais**, cadastre os profissionais (podem trabalhar sem login), configure jornadas e ausências e convide usuários para papéis de dono, gerente, recepcionista ou profissional. Atribuições e acesso são separados.
5. Use a Agenda por profissional. Usuários podem participar de mais de uma empresa e alternar entre elas; dados locais são segregados por usuário/empresa. Revogações e mudanças de permissão exigem reconexão para atualizar o acesso offline.

**Responsabilidade dos dados:** alterações locais são sincronizadas com Supabase, sujeitas a permissões e resolução de conflitos. Ação sensível como recebimento da recepção requer internet e uma RPC transacional; o modo offline não equivale a um backup ou a um controle de acesso instantâneo após revogação.

## Estrutura atual

- `index.html`, `css/style.css`, `js/views/`: aplicação responsiva sem build.
- `js/auth.js`, `js/permissoes.js`: Auth, convite, papéis, seleção e revalidação de empresas.
- `js/storage.js`: adaptador de persistência, cache local, fila offline e sincronização com RPCs.
- `js/config.js`: endereço e **chave pública** do projeto Supabase do ambiente.
- `supabase/migrations/`: migrations aditivas e correções da evolução; **aplicar na ordem documentada**, somente após backup e homologação.
- `tests/browser-multiusuario.mjs`: fluxos em Chromium com Supabase simulado (não realiza confirmação de e-mail real).
- `tests/staging-storage.mjs`, `tests/horarios.js`: testes de regressão e sincronização.
- `.github/workflows/`: verificações de JavaScript e Chromium nos PRs.
- `docs/multiusuario-multiprofissional.md`: arquitetura, permissões, SQL e cenários validados.
- `docs/release-multiusuario.md`: passos de homologação, publicação e recuperação.

O **AdmPro Console** está em repositório separado, publicado independentemente. Deve receber as migrations do mesmo Supabase **antes de ser publicado com métricas multiusuário**.

## Testes desta branch

As verificações executadas pelo GitHub Actions são:

```bash
find js -name '*.js' -print0 | xargs -0 -n1 node --check
node --check sw.js
node --test tests/horarios.js
node tests/staging-storage.mjs
# Suíte Chromium no CI (Playwright instalado somente no ambiente de testes):
node tests/browser-multiusuario.mjs
```

Os testes de navegador usam dados simulados, enquanto autorização/RLS, financeiro, convites e revogação são verificados separadamente no Supabase **staging**, com transações de teste revertidas. O aceite completo do convite com **segundo usuário Auth e e-mail real confirmado** permanece como etapa de homologação antes da produção.

---

## Histórico técnico das versões locais

As seções seguintes documentam o legado offline v2/v3 e evoluções de interface. Algumas descrições de funcionamento local sem autenticação, cache e comandos de teste correspondem **somente a essas versões anteriores** e **não substituem as instruções da versão Supabase acima**.

## Marca AdmPro

Os arquivos oficiais enviados foram preservados em `img/logo/`. O cabeçalho e o onboarding alternam as versões da marca conforme o tema (claro, escuro ou automático), sem bibliotecas. O orçamento impresso usa a assinatura monocromática do AdmPro; a logo opcional de cada negócio permanece independente. Ícones e imagens usam caminhos relativos para abrir por `file://`. O manifesto pode ser ignorado pelo navegador em `file://` sem afetar a SPA.

## Segurança e migração (v2)

A migração automática `versaoDados: 2` conserva clientes, catálogo, serviços, lançamentos e demais campos antigos. O hash do PIN fica em `config.pinHash`; `sessionStorage` é utilizado exclusivamente dentro de `storage.js` e dura enquanto a aba estiver aberta. PIN de quatro números e hash local **não protegem contra alguém com acesso ao armazenamento do navegador**. Em contextos com Web Crypto, usa SHA-256; em `file://` sem Web Crypto, usa um hash FNV-1a documentado (não criptográfico). Migrar para autenticação de servidor em produção.

Manrope está listada na pilha CSS como fonte opcional; não se baixa fonte externa, preservando uso offline e sem CDN. Para recuperar um PIN perdido é necessário limpar dados e recadastrar (um backup com PIN também restaura o PIN).

## Versão 3 — Gestão complementar

A migração para `versaoDados: 3` acontece automaticamente na inicialização, preservando clientes, catálogo, serviços, parcelas, lançamentos e PIN anteriores. Foram adicionadas as coleções `profissionais`, `despesasFixas` e `movimentacoesEstoque`. As novas coleções fazem parte do backup JSON; backups antigos continuam aceitos e são migrados depois de importados.

Os cálculos de metas, relatórios, recorrência, estoque, despesas fixas e comissões ficam em `js/regras.js` (funções puras). `js/storage.js` continua sendo o único arquivo autorizado a usar `localStorage` e `sessionStorage` e coordena as baixas, estornos, lançamentos e criação idempotente de registros. O cadastro de profissionais não cria login nem substitui o PIN local.

### Novidades

- **Lembretes:** no detalhe do serviço, na Agenda e no Início. Abrem o WhatsApp do cliente; o registro indica que a mensagem foi preparada. O usuário ainda precisa enviá-la no WhatsApp.
- **Recibos:** disponíveis para parcelas pagas, com numeração sequencial guardada na configuração, impressão pelo navegador e resumo para WhatsApp.
- **Recorrência:** configure dias, semanas ou meses; a próxima ocorrência nasce na primeira conclusão/quitação, uma só vez. O fim de mês é ajustado ao calendário.
- **Metas:** Configurações → Gestão → Meta mensal. O Início mostra progresso e projeção linear pelo dia do mês.
- **Relatórios:** terceira aba no Financeiro. Valores financeiros de faturamento vêm dos lançamentos de entrada. Quantidade de serviços considera a data do serviço. O ranking por quantidade soma unidades dos itens (`qtd`), e não linhas de venda.
- **Despesas fixas:** lançamento automático da competência corrente, uma vez por despesa, mesmo que o lançamento tenha sido excluído depois.
- **Comissões:** valor calculado sobre as parcelas pagas no mês; o botão de pagamento gera saída financeira avulsa.
- **Estoque:** quantidades e mínimo no catálogo; movimentos e ajustes em Gestão → Estoque. A conclusão baixa itens do tipo produto controlado; reabrir/cancelar estorna.
- **Modelos:** oito perfis em `js/modelos.js`. Alterar o modelo não apaga catálogo ou serviços anteriores. Itens demonstrativos adicionais dependem de confirmação.

### PWA: instalar e testar offline

O aplicativo continua abrindo por `file://` (sem service worker). O service worker tem fallback para `index.html`: a navegação pela raiz do projeto também funciona offline após a instalação, mesmo que a URL `/` nunca tenha sido acessada com o worker ativo. Para instalar e testar o cache offline, é necessário servi-lo sob `http://localhost` ou HTTPS:

1. Abra esta pasta no VS Code e escolha **Live Server → Open with Live Server**, ou execute `npx serve .` no terminal (o segundo comando exige Node/npm e pode baixar o pacote `serve`, mas **não é uma dependência do AdmPro**).
2. Acesse o endereço local informado pelo servidor (por exemplo, `http://localhost:5500/index.html`).
3. Abra uma vez com conexão de rede disponível. Confirme em DevTools → Application → Service Workers que `sw.js` está ativo. Em Application → Cache Storage, confira `admpro-estaticos-v3-5`.
4. Vá a Configurações → Instalação e escolha **Instalar app**, se disponível. No Safari do iPhone use **Compartilhar → Adicionar à Tela de Início**.
5. Em DevTools → Network, ative **Offline** e recarregue: os arquivos estáticos devem permanecer disponíveis. Os dados continuam exclusivamente neste navegador.
6. Ao atualizar o projeto, altere o valor de `CACHE` em `sw.js` para forçar o navegador a preparar a nova versão. A confirmação **Atualizar** ativa a versão que está aguardando.

**Atenção:** no primeiro acesso offline sem cache prévio, nenhuma PWA pode carregar. Os favicons e logos do ZIP original são mantidos. Sem rede, WhatsApp não abre, embora o app e os dados locais permaneçam acessíveis.

### Roteiro de testes manuais

1. **Lembrete:** crie um agendamento para amanhã; veja o botão no Início/Agenda/detalhe, abra o WhatsApp e confira o selo após retornar.
2. **Recibo:** pague uma parcela; gere o recibo e imprima em PDF; confira o número sequencial, valores e texto por extenso; teste o resumo pelo WhatsApp.
3. **Recorrência:** agende 31/01, marque 1 mês, conclua; verifique fevereiro (28/29), volte de status e conclua outra vez; apenas um sucessor deve existir.
4. **Meta:** salve a meta em Gestão, confira percentual e projeção no Início.
5. **Relatórios:** crie entradas/saídas e compare os totais da aba Relatórios com os lançamentos do período; teste os quatro filtros.
6. **Despesas fixas:** cadastre aluguel para o dia 10; recarregue cinco vezes e confirme um lançamento da competência corrente. Apague esse lançamento e recarregue; ele não deverá reaparecer.
7. **Profissionais:** cadastre comissão de 10%, selecione um profissional em um serviço, pague R$ 100 e confira comissão de R$ 10. Registre o pagamento e confira a saída.
8. **Estoque:** crie um produto com quantidade 10, mínimo 2 e use 3 unidades num serviço; conclua e verifique 7; reabra/cancele e verifique 10.
9. **PWA:** siga as etapas acima, confira instalação e recarregamento offline via HTTP local. Confirme que `file://` não gera erro de SW.
10. **Modelos:** selecione cada modelo no onboarding; em Configurações altere o modelo e confirme que os dados existentes permanecem iguais. Teste a nomenclatura de assistência técnica.

Para investigar limitações específicas de navegadores móveis, valide também nas larguras de 360, 390, 768 e 1280px, em temas claro e escuro.

### Regressão automatizada opcional

Para executar os testes de regras com Node.js 18+ (somente módulos nativos, sem `npm install` e sem etapa de build):

```bash
node --test tests/*.js
```

Os testes verificam migração v2→v3, retenção de dados diante de JSON inválido, importação de backup, recorrência, controle de estoque, recebimentos, despesas fixas e valores monetários. `tests/pwa.js` simula instalação, leitura do cache em modo offline, fallback de navegação pela raiz, limpeza de cache antigo e atualização do service worker. Esses testes isolados não substituem a instalação real em Android, iOS ou Chrome local. `tests/` não faz parte dos scripts carregados pelo `index.html` e não é necessário para usar o aplicativo.

Na migração, `storage.js` verifica se há coleções corrompidas antes de gravar e só marca a nova versão depois de converter os dados. Se encontrar um JSON inválido, a migração é adiada e o conteúdo original é preservado para possível recuperação por backup. Evite criar novos cadastros antes de restaurar o armazenamento corrompido.

## Revisão visual (v3.4)

A auditoria das interfaces em 360, 390, 768 e 1280px identificou e corrigiu: chips de dias de atendimento antes visualizados como checkboxes enormes; espaçamento insuficiente entre meta e indicadores; saldo isolado em meia coluna no Financeiro; abas do Financeiro encobertas pelo botão de ação; links com áreas clicáveis menores que 44px; contraste insuficiente do verde em valores positivos; e agrupamento da agenda semanal estreito na transição desktop. Foram mantidos os códigos de cor oficiais para status, o azul-petróleo e a organização original de telas. O cache PWA foi incrementado para `admpro-estaticos-v3-5`.

O relatório de inspeção e as limitações dos testes estão em [`docs/auditoria-visual.md`](docs/auditoria-visual.md).

## Auditoria de usabilidade

As melhorias de fluxo e os cenários de validação do cadastro rápido, formulário de serviço, filtros e navegação constam em [`docs/auditoria-usabilidade.md`](docs/auditoria-usabilidade.md). Atualização de cache: `admpro-estaticos-v3-5`. Permanecem pendentes os testes em dispositivos físicos e com usuários reais.

## Revisão web e agenda personalizada (v3.6)

- Acesso às Configurações visível na barra lateral do desktop e no cabeçalho mobile, com ícone de engrenagem.
- Formulário de serviços com seletor, quantidade e lixeira alinhados; Catálogo com retorno às Configurações.
- Confirmações e descarte de alterações em modais internos; nenhum `window.alert()` ou `window.confirm()` é utilizado. O diálogo de instalação do PWA é a interface nativa do navegador.
- Avisos no topo com botão de fechar, acima dos modais e sem bloquear o conteúdo.
- Modais de pagamento não alteram a largura/posição do corpo da página ao abrir ou fechar.
- Agenda semanal com colunas mais largas no desktop e conteúdo geral sem largura excessivamente limitada.
- Horários por dia da semana, com abertura/fechamento e um ou dois períodos; permitem pausa para almoço, meio período e folga. A agenda respeita o expediente; serviços fora dele continuam permitidos com aviso.
- Configurações antigas (somente `horaInicio`, `horaFim`, `diasAtendimento`) continuam válidas: são convertidas visualmente e o formato antigo é preservado para compatibilidade com backup v3. A nova configuração opcional se chama `horariosSemana`.
- Modelos de negócio preservam exemplos do setor, mas utilizam rótulos genéricos de Atendimento ou Serviço, evitando restringir registros a corte, banho, reparo etc.
- Relatórios com separação de blocos e métricas; PIN com quatro indicadores e teclado do aparelho, sem teclado desenhado.

Teste das regras de horários: `node --test tests/horarios.js`. Teste de integração de interface foi feito em Chromium com HTML/CSS/JS carregados em memória em 360, 768, 1280 e 1600px, usando dados de demonstração. Testes reais de Safari/iOS, Android e PWA instalado ainda são necessários.
