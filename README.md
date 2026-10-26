# AdmPro

Gestão de pequenos negócios em HTML5, CSS3 e JavaScript puro.

## Como abrir

Extraia a pasta e abra `index.html` diretamente no Chrome, inclusive por `file://`. Não é necessário servidor, internet, pacote npm ou build. Na primeira visita, conclua o cadastro inicial e crie um PIN de 4 dígitos e escolha iniciar com exemplos ou dados vazios.

## Estrutura

- `index.html`: marcação principal e scripts na ordem de dependência.
- `css/style.css`: estilos mobile first, tokens, temas e impressão.
- `img/logo/svg/`: logos vetoriais para cabeçalho e onboarding (claras/escuras).
- `img/logo/png/`: versões transparentes para documentos, impressos e marca.
- `img/logo/favicon/`: favicon, ícone iOS e manifesto do aplicativo.
- `js/utils.js`: máscaras, formatação, datas, cálculos e IDs.
- `js/storage.js`: CRUD por coleção, importação, exportação e exemplos.
- `js/ui.js`: modal, confirmações, toast e elementos compartilhados.
- `js/views/seguranca.js`: criação de PIN e bloqueio local.
- `js/views/`: onboarding, início, agenda, clientes, serviços, financeiro, catálogo e configurações.
- `js/app.js`: perfil, roteamento por hash e inicialização.

## Persistência e futura API

**Somente `js/storage.js` usa `localStorage`.** Todas as telas consomem `AdmPro.storage` (`obter`, `gravar`, `lista`, `porId`, `adicionar`, `atualizar`, `excluir`). Na migração para um back-end, preserve a interface lógica dessa camada e adapte os chamadores às operações assíncronas de API. As chaves locais usam o prefixo `admpro_`.

## Observações

Os dados permanecem no navegador/dispositivo. Faça backups regularmente. O botão “Gerar PDF” abre a impressão do navegador, onde se pode escolher **Salvar como PDF**. Mensagens de WhatsApp usam `wa.me` e requerem conexão com a internet. O sistema é local e oferece apenas PIN local (não autenticação real) e não sincroniza dispositivos.

## Marca AdmPro

Os arquivos oficiais enviados foram preservados em `img/logo/`. O cabeçalho e o onboarding alternam as versões da marca conforme o tema (claro, escuro ou automático), sem bibliotecas. O orçamento impresso usa a assinatura monocromática do AdmPro; a logo opcional de cada negócio permanece independente. Ícones e imagens usam caminhos relativos para abrir por `file://`. O manifesto pode ser ignorado pelo navegador em `file://` sem afetar a SPA.

## Segurança e migração (v2)

A migração automática `versaoDados: 2` conserva clientes, catálogo, serviços, lançamentos e demais campos antigos. O hash do PIN fica em `config.pinHash`; `sessionStorage` é utilizado exclusivamente dentro de `storage.js` e dura enquanto a aba estiver aberta. PIN de quatro números e hash local **não protegem contra alguém com acesso ao armazenamento do navegador**. Em contextos com Web Crypto, usa SHA-256; em `file://` sem Web Crypto, usa um hash FNV-1a documentado (não criptográfico). Migrar para autenticação de servidor em produção.

Manrope está listada na pilha CSS como fonte opcional; não se baixa fonte externa, preservando uso offline e sem CDN. Para recuperar um PIN perdido é necessário limpar dados e recadastrar (um backup com PIN também restaura o PIN).
