# AdmPro — Auditoria visual v3.4

## Método

Inspeção do CSS e dos componentes, seguida de execução dos scripts originais em Chromium com o DOM e os recursos locais inseridos em memória, por restrição do ambiente a navegação direta por `file://` e `localhost`. Foram percorridas as rotas Início, Agenda, Clientes, Serviços, Financeiro, Configurações, Catálogo, Estoque, Profissionais e Meta em 360, 390, 768 e 1280px, nos temas claro e escuro (80 combinações).

**Limite:** o método reproduz a renderização e as interações dos scripts, mas não equivale a testar a abertura real pelo protocolo `file://`, o teclado virtual, a instalação do PWA ou versões antigas de navegadores em aparelhos físicos. O logo aparece com imagem não resolvida nas capturas do DOM em memória porque recursos externos ao documento não são carregados; os arquivos SVG existem no pacote original e seus caminhos não foram alterados.

## Achados e correções

| Problema | Gravidade | Correção |
|---|---|---|
| Checkboxes dos dias ampliados pelo estilo genérico de campos, criando botões irregulares no celular | Média | Input acessível oculto visualmente e seleção pelo chip inteiro (mínimo 44px), com foco visível |
| Card da meta encostado no bloco de indicadores | Baixa | Margem vertical de 16px consistente |
| Indicador Saldo ocupando metade da segunda linha no Financeiro | Baixa | Saldo ocupa a largura da linha no celular e resumo vira três colunas a partir de 768px |
| Abas do Financeiro sob o botão flutuante em 360px | Média | Abas compactas mantidas em espaço reservado à esquerda do FAB, sem quebra do texto |
| Links de cabeçalho com alvo de toque de apenas ~20px de altura | Média | Alvos de 44px sem alterar hierarquia semântica |
| Texto de sucesso em verde #16A34A com contraste insuficiente em branco (~3,30:1) | Média | Novo token de **texto** #137A38 (~5,43:1) e #4ADE80 no tema escuro (~9,38:1). O token oficial `--sucesso` foi preservado para elementos gráficos e status |
| Resumo de relatórios com títulos muito próximos dos dados | Baixa | Distâncias de 12px e 24px entre seções dos cards |
| Seletor de arquivo destoava dos inputs e botões | Baixa | Aparência alinhada aos tokens de borda e cor |
| Agenda de sete colunas muito estreita quando a sidebar aparece em 1024px | Média | Três colunas entre 1024 e 1279px; sete a partir de 1280px |

## Resultados

- 80 combinações de tela/tema/largura sem exceção JavaScript detectada pela automação.
- Nenhum documento com rolagem horizontal; a faixa rolável de filtros de status é intencional.
- Testes existentes de regras de negócio mantidos, sem alteração de esquema ou persistência.
- Recursos de logo, identidade visual, estrutura do cabeçalho e navegação preservados.

## Verificações ainda recomendadas em dispositivo real

1. Android: teclado virtual com formulário longo e bottom sheet aberto.
2. iPhone: safe area da barra inferior, input `type=file`, foco e Safari em tema automático.
3. Teste manual de texto longo e zoom de acessibilidade (200%).
4. Captura da versão instalada do PWA após renovação do cache.
5. Confirmação de contraste em cenários de alto contraste do sistema.
