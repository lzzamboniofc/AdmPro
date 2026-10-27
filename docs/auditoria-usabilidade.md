# AdmPro — Auditoria de usabilidade (26/10/2026)

## Objetivo e método

Revisão dos fluxos mais frequentes, com prioridade para o uso em uma mão, cadastro em atendimento e compreensão de ações. A análise reuniu inspeção do código-fonte e testes automatizados da interface real executada em Chromium, com CSS e scripts carregados localmente em memória. Foram exercitados 360, 390, 768 e 1280 px nos cenários de cadastro e navegação, além dos perfis rápido/projeto a 360 e 768 px. Não são testes com pessoas reais; não houve validação de teclado virtual ou abertura direta por `file://`, bloqueadas no ambiente.

## Achados e correções

| Severidade | Fluxo | Atrito verificado | Correção pontual |
|---|---|---|---|
| Alta | Criar serviço > novo cliente | O modal do cadastro de cliente substituía o modal do serviço; cancelar descartava o preenchimento anterior. | Cadastro compacto de nome e telefone dentro do formulário atual; validação inline, criação e seleção imediata. Cancelar não perde dados. |
| Média | Novo serviço > itens | Era necessário tocar em `+ Item` antes de selecionar; o botão adicionava automaticamente o primeiro item do catálogo, com risco de valor não intencional. | Nova ficha abre uma linha vazia do catálogo; novas linhas também começam sem seleção e recebem foco. |
| Média | Novo serviço > salvar | O botão Salvar ficava após endereço, observações, recorrência, etapas e parcelas, aumentando a rolagem. | Cabeçalho e ação Salvar permanecem visíveis; o conteúdo longo rola dentro do sheet. |
| Média | Fechar serviço alterado | Tocar fora ou fechar perdia alterações sem aviso. | Ao fechar pelo fundo, X ou Esc, usar confirmação nativa de descarte; salvar continua fechando diretamente. |
| Média | Busca e filtros sem resultado | Mensagem incentivava criar registro mesmo quando não havia correspondência por filtro/busca. | Texto contextual e botão **Limpar filtros** em Serviços; **Limpar busca** em Clientes, com devolução de foco. |
| Baixa | Serviço em detalhe | FAB `+` criava outro serviço em contexto de detalhe, onde as ações existentes já atendem ao fluxo. | FAB oculto nessa rota, preservando as ações no detalhe. |
| Baixa | Filtros de status e controle Dia/Semana | Botões com menos de 44 px de altura. | Altura mínima de toque de 44 px. |

## Validação automatizada

- **360 / 390 / 768 / 1280 px:** nova ficha abre linha de item desmarcada; salvar mantém botão visível; novo cliente pode ser incluído sem descartar a ficha; seleção de item calcula o total; após salvar, detalhe abre normalmente; buscas podem ser limpas; fechamento de ficha alterada pede confirmação; FAB não aparece no detalhe.
- **Rápido e Projeto, 360 / 768 px:** cadastro de cliente → serviço → pagamento de parcela → lançamento visível no Financeiro, sem exceções de JavaScript nem rolagem horizontal da página nos cenários exercitados.
- **Regressão Node:** `node --test tests/regressao.js tests/pwa.js`. O cache foi incrementado para disponibilizar a atualização nos PWAs existentes.

## Decisões de UX

- Não adicionar passos nem telas novos: apenas um pequeno painel inline de cliente, com dois campos obrigatórios.
- Exigir escolha explícita do item; não lançar o primeiro preço do catálogo sem interação.
- Usar a confirmação nativa do navegador para descarte: é acessível por teclado e evita novos modais empilhados. Essa confirmação aparece somente após alteração.
- Manter `window.AdmPro`, `storage.js`, cinco itens da navegação e os tokens oficiais de cor.

## Validações ainda necessárias com dispositivos e pessoas

1. Testar abertura por `file://` no Chrome instalado e confirmar funcionamento do PIN após fechar a aba.
2. Testar teclado aberto em Android e Safari do iPhone: foco em campos inferiores, botão Salvar fixo, safe-area e mudança de orientação.
3. Testar leitores de tela (TalkBack/VoiceOver) para cadastro inline, alertas de validação, menu e diálogo nativo de descarte.
4. Testar com 3 a 5 profissionais reais tarefas completas, observando erros, abandono, tempo de conclusão e dúvidas sobre parcelas.
5. Validar WhatsApp, impressão/recibo, backups e PWA offline em navegadores reais.
