# AdmPro

Gestão de pequenos negócios em HTML5, CSS3 e JavaScript puro.

## Como abrir

Extraia a pasta e abra `index.html` diretamente no Chrome, inclusive por `file://`. Não é necessário servidor, internet, pacote npm ou build. Na primeira visita, conclua as três etapas de configuração e escolha iniciar com exemplos ou dados vazios.

## Estrutura

- `index.html`: marcação principal e scripts na ordem de dependência.
- `css/style.css`: estilos mobile first, tokens, temas e impressão.
- `img/logo/svg/`: logos vetoriais para cabeçalho e onboarding (claras/escuras).
- `img/logo/png/`: versões transparentes para documentos, impressos e marca.
- `img/logo/favicon/`: favicon, ícone iOS e manifesto do aplicativo.
- `js/utils.js`: máscaras, formatação, datas, cálculos e IDs.
- `js/storage.js`: CRUD por coleção, importação, exportação e exemplos.
- `js/ui.js`: modal, confirmações, toast e elementos compartilhados.
- `js/views/`: onboarding, início, agenda, clientes, serviços, financeiro, catálogo e configurações.
- `js/app.js`: perfil, roteamento por hash e inicialização.

## Persistência e futura API

**Somente `js/storage.js` usa `localStorage`.** Todas as telas consomem `AdmPro.storage` (`obter`, `gravar`, `lista`, `porId`, `adicionar`, `atualizar`, `excluir`). Na migração para um back-end, preserve a interface lógica dessa camada e adapte os chamadores às operações assíncronas de API. As chaves locais usam o prefixo `admpro_`.

## Observações

Os dados permanecem no navegador/dispositivo. Faça backups regularmente. O botão “Gerar PDF” abre a impressão do navegador, onde se pode escolher **Salvar como PDF**. Mensagens de WhatsApp usam `wa.me` e requerem conexão com a internet. O sistema é local e não oferece autenticação ou sincronização entre dispositivos.

## Marca AdmPro

Os arquivos oficiais enviados foram preservados em `img/logo/`. O cabeçalho e o onboarding alternam as versões da marca conforme o tema (claro, escuro ou automático), sem bibliotecas. O orçamento impresso usa a assinatura monocromática do AdmPro; a logo opcional de cada negócio permanece independente. Ícones e imagens usam caminhos relativos para abrir por `file://`. O manifesto pode ser ignorado pelo navegador em `file://` sem afetar a SPA.
