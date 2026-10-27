# Revisão web e usabilidade — AdmPro v3.6

## Demandas atendidas

| Achado | Correção |
| --- | --- |
| Configurações não acessíveis pelo desktop | Novo item permanente na lateral e atalho no cabeçalho mobile. |
| Sol no ícone de Configurações | SVG substituído por engrenagem. |
| Catálogo sem retorno | Link de volta às Configurações. |
| Quantidade e lixeira desalinhadas | CSS Grid estável e valor unitário em linha separada. |
| Confirmações JavaScript nativas | Modal de descarte interno, sem `window.confirm()` ou `window.alert()`. |
| Avisos na parte de baixo | Toasts no topo, fecháveis, sobre todos os elementos. |
| Modal de pagamento desloca a página | Removida a posição fixa do body; controle de rolagem no HTML. |
| Semana desktop comprimida | Container ampliado e grade automática com largura mínima de 200px. |
| Horário rígido e sem almoço | Editor diário com opção de dia fechado ou até dois turnos. |
| Modelos excessivamente específicos | Rótulos e status comuns genéricos; catálogos de exemplo permanecem opcionais. |
| Relatórios sem respiro | Seções separadas, espaços entre métricas e linhas. |
| PIN com teclado duplicado | Apenas entrada nativa com quatro indicadores visuais. |

## Validações executadas

- Chromium (conteúdo servido em memória pelo navegador de testes): larguras 360, 768, 1280 e 1600px; sem exceções JavaScript nem rolagem horizontal; 7 linhas de horários em Configurações; menu de Configurações visível conforme o dispositivo; agenda semanal ocupando mais colunas no desktop; item e lixeira com o mesmo alinhamento; edição preservada após recusar descarte; toast próximo ao topo (10px) e fechável.
- Salvar horários diferenciados, incluindo uma folga e meio período, sem alterar estrutura de dados anterior.
- Concluir e receber com página rolada em 1280px: início e fim do modal no mesmo x = 224px; recebimento foi salvo e formulário foi fechado.
- Teclado desenhado ausente na tela do PIN; quatro indicadores acompanham preenchimento.
- Validação de sintaxe JavaScript e suíte de testes do repositório.

## Pendências fora do ambiente

- Testar teclado virtual, Safari/iOS, leitores de tela e instalação PWA em aparelhos reais.
- Verificar impressão de recibos, abertura do WhatsApp e restauração de backup em navegadores reais.
- Validar uso com usuários e agendamentos fora de expediente em cenários de rotina.
