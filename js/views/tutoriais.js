/* Manual oficial integrado ao AdmPro; conteúdo estático disponível no PWA. */
(function(A){
'use strict';
const U=A.utils,esc=U.escapar;
const topicos=[
  {
    "id": "primeiros-passos",
    "emoji": "🚀",
    "cat": "Começar",
    "title": "Primeiros passos no AdmPro",
    "summary": "Da criação da conta ao primeiro atendimento.",
    "body": "\n<h3>1. Entrar e preparar sua empresa</h3>\n<ol><li>Abra o AdmPro e faça seu cadastro com e-mail e senha. Confirme o e-mail quando solicitado.</li><li>Crie ou selecione sua empresa. Cada empresa tem seu próprio cadastro de clientes, agenda e financeiro.</li><li>Na primeira configuração, informe nome, telefone, modelo de negócio e horários de atendimento.</li><li>Defina um PIN de quatro dígitos para proteger o acesso local ao aplicativo.</li><li>Escolha começar com dados de exemplo para conhecer as telas ou começar com a empresa vazia.</li></ol>\n<h3>2. Ordem sugerida para configurar</h3>\n<ol><li>Ajuste os <a href=\"#/config\">dados e horários da empresa</a>.</li><li>Cadastre serviços e produtos no <a href=\"#/catalogo\">Catálogo</a>.</li><li>Cadastre profissionais e suas jornadas em <a href=\"#/equipe\">Equipe</a>, se necessário.</li><li>Cadastre o primeiro <a href=\"#/clientes\">cliente</a> e crie o primeiro <a href=\"#/servicos\">atendimento</a>.</li><li>Confira a <a href=\"#/agenda\">Agenda</a> e o <a href=\"#/financeiro\">Financeiro</a>.</li></ol>\n<p class=\"tutorial-nota\">O botão “+” flutuante nas páginas principais é um atalho para adicionar registros. As opções disponíveis dependem do seu perfil de acesso.</p>"
  },
  {
    "id": "modelos-negocio",
    "emoji": "🏪",
    "cat": "Começar",
    "title": "Modelo de negócio e tipo de atendimento",
    "summary": "Entenda o que muda entre atendimento rápido e projetos.",
    "body": "\n<p>O modelo inicial oferece nomes, exemplos e sugestões para sua área: beleza, barbearia, pet shop, personal trainer, assistência técnica, energia solar, eletricista ou outro.</p>\n<h3>Atendimento rápido</h3><p>Ideal para serviços com agendamento e conclusão simples, como beleza e barbearia. O fluxo prioriza agenda e recebimento.</p>\n<h3>Projetos</h3><p>Ideal para serviços com orçamento, execução em etapas e parcelas, como manutenção, instalações e reformas.</p>\n<h3>O que personalizar?</h3><p>Nome da empresa, telefone, logo, catálogo, dias e turnos de trabalho continuam editáveis em <a href=\"#/config\">Configurações</a>. A troca do modelo ou do tipo de atendimento pode afetar o fluxo de registros já existentes; prefira escolher corretamente no início e procure o suporte caso precise alterar uma operação em andamento.</p>"
  },
  {
    "id": "navegacao",
    "emoji": "🧭",
    "cat": "Começar",
    "title": "Navegação, perfil e configurações",
    "summary": "Onde ficam os menus no celular e no computador.",
    "body": "\n<p>No celular, utilize a barra inferior para navegar entre Início, Agenda, Clientes, Serviços e Financeiro. No computador, as opções ficam na lateral.</p>\n<p>Toque na foto ou na logo redonda da empresa, no canto superior, para abrir o menu do perfil. Nesse menu ficam as configurações disponíveis e a opção de sair. Caso a empresa não tenha logo, aparece sua inicial.</p>\n<p>Em <a href=\"#/config\">Configurações</a> você encontra o Catálogo, Equipe e Profissionais, metas, estoque, despesas fixas, assinatura, segurança e suporte. Algumas funções podem não aparecer para funcionários com acesso restrito.</p>"
  },
  {
    "id": "clientes",
    "emoji": "👥",
    "cat": "Dia a dia",
    "title": "Cadastro e acompanhamento de clientes",
    "summary": "Cadastre, pesquise, edite e consulte o histórico.",
    "body": "\n<ol><li>Abra <a href=\"#/clientes\">Clientes</a> e toque em “+” ou na opção de novo cliente.</li><li>Informe nome e telefone; complemente com endereço e observações quando necessário.</li><li>Salve o cadastro para poder selecionar a pessoa em novos atendimentos.</li><li>Use a pesquisa para encontrar clientes rapidamente.</li><li>Abra o cadastro de um cliente para ver informações e histórico de serviços, quando disponível.</li></ol>\n<p>Para evitar cadastros duplicados, pesquise primeiro pelo nome ou telefone. O número informado pode ser utilizado em atalhos de ligação e WhatsApp.</p>"
  },
  {
    "id": "catalogo",
    "emoji": "🏷️",
    "cat": "Dia a dia",
    "title": "Catálogo de serviços e produtos",
    "summary": "Preços, duração, estoque e itens do atendimento.",
    "body": "\n<p>Em <a href=\"#/catalogo\">Catálogo</a>, mantenha a lista do que sua empresa oferece.</p>\n<ol><li>Entre em Configurações → Catálogo.</li><li>Adicione um serviço ou produto e informe nome e preço.</li><li>Para serviços, defina a duração para ajudar na organização da agenda.</li><li>Para produtos, ajuste os campos de estoque quando aplicáveis.</li><li>Edite preços e informações sempre que necessário.</li></ol>\n<p>O catálogo facilita a composição de um atendimento com vários itens e quantidades. Mudanças no catálogo não devem ser usadas para reescrever recibos antigos.</p>"
  },
  {
    "id": "atendimentos",
    "emoji": "🧰",
    "cat": "Dia a dia",
    "title": "Criar e acompanhar atendimentos",
    "summary": "Do agendamento à conclusão e ao pagamento.",
    "body": "\n<ol><li>Abra <a href=\"#/servicos\">Serviços</a> ou o botão “+” da tela Início.</li><li>Selecione o cliente. Caso ainda não exista, use a opção de cadastrá-lo durante a operação.</li><li>Adicione um ou mais itens do catálogo e confira quantidades, preços e total.</li><li>Informe data, hora, duração e, quando necessário, o profissional responsável.</li><li>Salve o atendimento e acompanhe seu status na lista ou na agenda.</li></ol>\n<h3>Atendimento rápido x projeto</h3><p>No atendimento rápido, a ação principal costuma ser “Concluir e receber”. Nos projetos, é possível acompanhar orçamento e andamento, etapas e pagamento parcelado.</p>\n<p class=\"tutorial-nota\">Ao concluir e receber, confira os valores e a forma de pagamento antes de confirmar. A operação pode gerar o lançamento correspondente no Financeiro.</p>"
  },
  {
    "id": "agenda",
    "emoji": "🗓️",
    "cat": "Dia a dia",
    "title": "Agenda diária e semanal",
    "summary": "Visualização por dia, semana e profissional.",
    "body": "\n<p>Abra <a href=\"#/agenda\">Agenda</a> para consultar compromissos. É possível alternar a visualização entre dia e semana e, para quem tem permissão, selecionar um profissional ou visualizar a equipe.</p>\n<p>Os atendimentos consideram o dia e a hora cadastrados. O sistema também verifica conflitos de horário para o mesmo profissional, respeitando a configuração de atendimentos simultâneos.</p>\n<p>Para um profissional com perfil restrito e agenda vinculada, a visualização prioriza os próprios agendamentos. O que cada pessoa pode alterar depende das permissões concedidas.</p>"
  },
  {
    "id": "horarios",
    "emoji": "⏰",
    "cat": "Dia a dia",
    "title": "Horários, almoço, folgas e férias",
    "summary": "Turnos por dia e disponibilidade da equipe.",
    "body": "\n<ol><li>Em <a href=\"#/config\">Configurações</a>, defina os dias em que a empresa atende.</li><li>Em cada dia, configure um ou mais turnos. Exemplo: 08h–12h e 13h–18h, deixando o almoço livre.</li><li>Para profissionais, abra <a href=\"#/equipe\">Equipe e Profissionais</a> e ajuste a jornada individual.</li><li>Cadastre folgas, férias, ausências e bloqueios com data e intervalo de horário.</li><li>Use a agenda para verificar os compromissos antes de salvar um novo atendimento.</li></ol>\n<p>A agenda do profissional pode seguir horários próprios, diferentes da jornada geral da empresa.</p>"
  },
  {
    "id": "recorrencia",
    "emoji": "🔁",
    "cat": "Dia a dia",
    "title": "Recorrência e lembretes",
    "summary": "Retornos periódicos e mensagens para clientes.",
    "body": "\n<p>Conforme o tipo de atendimento, você pode configurar retornos recorrentes para facilitar a marcação da próxima visita. Revise o intervalo escolhido e confira se o próximo compromisso foi gerado.</p>\n<p>Nos atendimentos agendados para datas futuras, quando disponível, utilize “Enviar lembrete”. O AdmPro prepara uma mensagem; confira o destinatário e o conteúdo antes de enviá-la pelo aplicativo de mensagens.</p>\n<p>Um lembrete enviado não significa que o cliente confirmou presença. Atualize o atendimento caso haja cancelamento ou mudança de horário.</p>"
  },
  {
    "id": "financeiro",
    "emoji": "💳",
    "cat": "Financeiro",
    "title": "Financeiro: entradas, saídas e saldo",
    "summary": "Lançamentos e visão mensal do caixa.",
    "body": "\n<p>Em <a href=\"#/financeiro\">Financeiro</a>, selecione o mês para acompanhar entradas, saídas e saldo. Use a aba Lançamentos para consultar registros e cadastrar movimentações conforme seu acesso.</p>\n<ol><li>Toque em “+” ou “Novo lançamento”.</li><li>Escolha entrada ou saída, informe descrição, valor e data.</li><li>Selecione categoria e forma de pagamento, quando aplicáveis.</li><li>Salve e confira o movimento na lista do mês.</li></ol>\n<p>Os recebimentos de atendimentos concluídos também podem gerar movimentos financeiros. Evite lançar a mesma entrada duas vezes.</p>"
  },
  {
    "id": "parcelas",
    "emoji": "🧾",
    "cat": "Financeiro",
    "title": "Parcelas, contas a receber e recibos",
    "summary": "Controle de pagamentos pendentes e conferência.",
    "body": "\n<p>No cadastro de um serviço com parcelas, confira a soma dos valores e as datas de vencimento. Em <a href=\"#/financeiro\">Financeiro → A receber</a>, acompanhe parcelas pendentes.</p>\n<p>Ao receber uma parcela, registre o pagamento no atendimento e confirme valor, data e meio de pagamento. Os detalhes do serviço podem oferecer recibos e comprovantes para consulta ou impressão, conforme o fluxo.</p>\n<p class=\"tutorial-nota\">Distingua o dinheiro recebido pelo seu negócio da mensalidade do AdmPro: o Financeiro registra operações da sua empresa; a assinatura do sistema é administrada em Minha assinatura.</p>"
  },
  {
    "id": "relatorios",
    "emoji": "📈",
    "cat": "Financeiro",
    "title": "Relatórios, metas e despesas",
    "summary": "Resultados, serviços vendidos e planejamento.",
    "body": "\n<p>Na aba <a href=\"#/financeiro\">Relatórios</a> do Financeiro, consulte indicadores como faturamento, quantidade de serviços, ticket médio, itens mais vendidos e despesas por categoria, conforme seus dados e permissões.</p>\n<p>Em <a href=\"#/gestao/meta\">Configurações → Meta mensal</a>, configure a meta de faturamento. Em <a href=\"#/gestao/despesas\">Despesas fixas</a>, organize custos recorrentes. Para produtos controlados, consulte <a href=\"#/gestao/estoque\">Estoque</a>.</p>\n<p>As informações são gerenciais: confira registros incompletos e pagamentos pendentes antes de usar os relatórios para decisões financeiras.</p>"
  },
  {
    "id": "estoque",
    "emoji": "📦",
    "cat": "Financeiro",
    "title": "Produtos, estoque e movimentos",
    "summary": "Controle do saldo de itens e níveis mínimos.",
    "body": "\n<p>Cadastre produtos no Catálogo e informe se devem controlar estoque. Para produtos com acompanhamento, revise quantidade disponível e estoque mínimo.</p>\n<p>Abra <a href=\"#/gestao/estoque\">Configurações → Estoque</a> para consultar e ajustar registros quando permitido. Confira as quantidades utilizadas em cada atendimento; alterações no estoque exigem atenção para não duplicar saídas.</p>\n<p>O estoque é relacionado aos produtos, não à quantidade de profissionais cadastrados.</p>"
  },
  {
    "id": "profissionais",
    "emoji": "✂️",
    "cat": "Equipe",
    "title": "Profissionais: cadastro sem login",
    "summary": "Organize agendas sem criar acesso ao aplicativo.",
    "body": "\n<p>Um <strong>profissional</strong> é alguém que realiza atendimentos e aparece na agenda, mas não precisa ter acesso ao AdmPro.</p>\n<ol><li>Vá a <a href=\"#/equipe\">Configurações → Equipe e Profissionais</a>.</li><li>Escolha “+ Profissional” e preencha nome e, se desejar, telefone, e-mail, função e especialidade.</li><li>Escolha os serviços executados, uma cor ou foto para a agenda e os horários de trabalho.</li><li>Cadastre férias, folgas ou bloqueios quando necessário.</li><li>Salve. A pessoa já pode ser vinculada a atendimentos, mesmo sem login.</li></ol>\n<p><strong>Profissionais sem login não ocupam vagas</strong> no limite de usuários do plano. Para que a pessoa entre no sistema, utilize “Dar acesso”.</p>"
  },
  {
    "id": "convites",
    "emoji": "📨",
    "cat": "Equipe",
    "title": "Convidar funcionários e liberar acesso",
    "summary": "E-mail, vínculo com agenda e aceite do convite.",
    "body": "\n<ol><li>Em <a href=\"#/equipe\">Equipe e Profissionais</a>, procure “Usuários com acesso”.</li><li>Toque em “Convidar usuário”, informe o e-mail e selecione Gerente, Recepcionista ou Profissional.</li><li>Se a pessoa tiver agenda própria, vincule-a ao profissional cadastrado. Você também pode usar “Dar acesso” diretamente no cartão desse profissional; o vínculo e o e-mail serão preenchidos automaticamente quando disponíveis.</li><li>Selecione permissões adicionais apenas se necessário e crie o convite.</li><li>Copie e envie o link gerado à pessoa. Ela deve entrar ou criar uma conta com o <strong>mesmo e-mail</strong> e confirmar o endereço para aceitar.</li></ol>\n<p>Depois do aceite, o usuário entra com suas próprias credenciais, mas trabalha na empresa compartilhada. O responsável pode editar o perfil ou revogar o acesso sem apagar o histórico dos atendimentos.</p>"
  },
  {
    "id": "permissoes",
    "emoji": "🛡️",
    "cat": "Equipe",
    "title": "Perfis e permissões da equipe",
    "summary": "Proprietário, gerente, recepcionista e profissional.",
    "body": "\n<h3>Proprietário</h3><p>Administra a empresa, configura o sistema, gerencia usuários e controla a assinatura. O proprietário ocupa uma vaga de usuário.</p>\n<h3>Gerente</h3><p>Gerencia equipe e operação, com acesso a agenda, clientes e catálogo conforme a configuração. Acesso financeiro completo não é concedido automaticamente.</p>\n<h3>Recepcionista</h3><p>Organiza agenda e clientes, acompanha atendimentos e, no perfil padrão, pode registrar recebimentos. Acesso a outras áreas depende das permissões.</p>\n<h3>Profissional</h3><p>Pode trabalhar com a própria agenda e os próprios atendimentos quando houver vínculo à sua ficha. O acesso a outras agendas, clientes e Financeiro é restrito conforme as permissões.</p>\n<p>O responsável pode habilitar permissões adicionais para atividades específicas. Cada pessoa deve usar o próprio login; não compartilhe senhas ou PINs.</p>"
  },
  {
    "id": "limites-equipe",
    "emoji": "👨‍👩‍👧",
    "cat": "Equipe",
    "title": "Limite de usuários por plano",
    "summary": "Quantas pessoas podem entrar e quem conta como vaga.",
    "body": "\n<p>O limite é por empresa e considera <strong>pessoas com login ativo</strong> e <strong>convites pendentes válidos</strong>. O proprietário já ocupa uma vaga. Uma ficha de profissional sem login não ocupa vaga.</p>\n<div class=\"tutorial-table-wrap\"><table><thead><tr><th>Plano</th><th>Logins por empresa</th></tr></thead><tbody><tr><td>Grátis</td><td>3</td></tr><tr><td>Easy</td><td>5</td></tr><tr><td>Pro</td><td>10</td></tr><tr><td>Pro+</td><td>Ilimitados</td></tr></tbody></table></div>\n<p>Em <a href=\"#/equipe\">Equipe e Profissionais</a>, consulte o contador de vagas, pessoas ativas e convites pendentes. Quando o limite é atingido, novos convites são bloqueados.</p>\n<p>Se a empresa mudar para um plano menor e já tiver mais logins que o novo limite, <strong>ninguém é removido automaticamente</strong>; os usuários existentes continuam e não será possível convidar novas pessoas até liberar vagas ou mudar de plano.</p>\n<p>Para liberar vaga, cancele um convite pendente ou revogue um usuário que não precise mais acessar. Consulte <a href=\"#/assinatura\">Minha assinatura</a> para comparar os planos.</p>"
  },
  {
    "id": "multiplas-empresas",
    "emoji": "🏢",
    "cat": "Equipe",
    "title": "Trabalhar em mais de uma empresa",
    "summary": "Alternar empresas sem misturar informações.",
    "body": "\n<p>Se sua conta tiver vínculo com mais de uma empresa, utilize “Trocar empresa” no menu do perfil ou nas configurações. Cada empresa mantém suas próprias listas, equipe, assinatura e configurações.</p>\n<p>Um mesmo e-mail pode estar ligado a empresas diferentes, mas o acesso e as permissões são definidos separadamente em cada uma. Sempre confira o nome da empresa no cabeçalho antes de fazer alterações.</p>"
  },
  {
    "id": "assinaturas",
    "emoji": "⭐",
    "cat": "Conta e ajuda",
    "title": "Planos, assinatura e pagamento Pix",
    "summary": "Grátis, Easy, Pro, Pro+ e liberação do plano.",
    "body": "\n<p>Acesse <a href=\"#/assinatura\">Configurações → Minha assinatura</a> para verificar seu plano, situação, preço e limites de clientes, serviços por mês e usuários com login.</p>\n<ol><li>Escolha um plano e confirme a solicitação.</li><li>Para planos pagos, copie a chave Pix exibida e faça a transferência para o recebedor informado.</li><li>Após pagar, toque em <strong>“Já fiz o Pix”</strong> e informe os dados da transferência, se desejar.</li><li>O Administrador confere o Pix no extrato e aprova ou recusa a solicitação.</li><li>Atualize a tela para consultar o resultado. Os novos limites só entram em vigor <strong>depois da confirmação</strong>.</li></ol>\n<p>O pagamento da mensalidade atual e a <strong>troca de plano</strong> são processos distintos. Para trocar de plano, use os cards da seção “Planos disponíveis”. Para renovar a mensalidade vigente, use a seção específica de renovação.</p>\n<p class=\"tutorial-nota\">Não envie senhas, códigos de autenticação ou dados bancários confidenciais em mensagens de pagamento.</p>"
  },
  {
    "id": "avisos",
    "emoji": "🔔",
    "cat": "Conta e ajuda",
    "title": "Alertas, vencimentos e sincronização",
    "summary": "Entenda avisos de assinatura e estado de conexão.",
    "body": "\n<p>O AdmPro pode mostrar avisos sobre o período de teste, assinatura em atraso, bloqueios e informações importantes. Leia a mensagem e use o link indicado para consultar a assinatura.</p>\n<p>O indicador de sincronização próximo ao cabeçalho mostra o estado da conexão. Se a rede cair, algumas informações podem continuar disponíveis no aparelho, mas operações que dependem do servidor, como convites, aprovação de plano e atualização de permissões, exigem internet.</p>\n<p>Antes de sair ou trocar de empresa, confira se existem alterações pendentes de sincronização.</p>"
  },
  {
    "id": "seguranca",
    "emoji": "🔐",
    "cat": "Conta e ajuda",
    "title": "Senha, PIN, privacidade e backup",
    "summary": "Proteção da conta, exportação e cuidados básicos.",
    "body": "\n<p>A senha da conta é usada no login pelo Supabase. O PIN de quatro dígitos é uma proteção local do aplicativo, diferente da senha de acesso à conta.</p>\n<p>Em <a href=\"#/config\">Configurações → Segurança</a>, altere o PIN ou utilize o fluxo “Esqueci o PIN” quando necessário. Não compartilhe senha ou PIN com colegas: crie convites com credenciais individuais.</p>\n<p>Em <a href=\"#/config\">Configurações → Backup e dados</a>, é possível exportar ou importar um arquivo JSON. Guarde backups em local protegido: eles podem conter informações de clientes e operações.</p>\n<p class=\"tutorial-nota\">O Supabase é a fonte dos dados da empresa. O navegador mantém um cache local. A opção de apagar dados é sensível; leia o aviso de confirmação e não a use como forma de simplesmente sair da conta.</p>\n<p>Consulte também os documentos de <a href=\"termos.html\" target=\"_blank\" rel=\"noopener\">Termos de uso</a> e <a href=\"privacidade.html\" target=\"_blank\" rel=\"noopener\">Privacidade</a>.</p>"
  },
  {
    "id": "instalacao",
    "emoji": "📱",
    "cat": "Conta e ajuda",
    "title": "Instalar o AdmPro no celular",
    "summary": "Acesso rápido pela tela inicial e atualização do app.",
    "body": "\n<p>Você pode usar o AdmPro pelo navegador ou instalá-lo como aplicativo web, quando o navegador oferecer essa opção.</p>\n<h3>Android</h3><p>Abra o site pelo Chrome, entre em <a href=\"#/config\">Configurações → Instalação</a> e use “Instalar app” quando disponível. Alternativamente, procure “Adicionar à tela inicial” no menu do navegador.</p>\n<h3>iPhone</h3><p>Abra no Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.</p>\n<p>Para receber melhorias, mantenha conexão com a internet e reabra ou atualize a página quando necessário. Mudanças de permissões e assinaturas sempre dependem do servidor.</p>"
  },
  {
    "id": "suporte",
    "emoji": "💬",
    "cat": "Conta e ajuda",
    "title": "Ajuda, suporte e solução de problemas",
    "summary": "Dúvidas, mensagens, e-mail e acesso.",
    "body": "\n<p>Se surgir uma dúvida, pesquise nesta página de tutoriais. Se não encontrar a resposta, entre em <a href=\"#/suporte\">Ajuda e suporte</a>, escolha o assunto (dúvida, problema ou sugestão) e descreva o ocorrido.</p>\n<h3>Não consigo entrar</h3><p>Confirme e-mail e senha; verifique se a conta foi confirmada. Caso esteja entrando por convite, use exatamente o e-mail convidado. Se houver limite de envio de e-mails, tente novamente mais tarde ou fale com o administrador.</p>\n<h3>Não vejo uma função</h3><p>Provavelmente seu perfil não possui permissão. Peça ao proprietário ou gerente autorizado para revisar o acesso na equipe.</p>\n<h3>Meu Pix não ativou o plano</h3><p>Entre em <a href=\"#/assinatura\">Minha assinatura</a>, confira se a informação de Pix foi enviada e consulte o status. A liberação depende da confirmação do Administrador, não é automática.</p>\n<h3>Agenda indisponível ou atendimento conflitando</h3><p>Confira data, hora, duração, turno e bloqueios do profissional. Se necessário, revise as folgas e o cadastro da agenda.</p>\n<h3>Troquei de celular</h3><p>Entre com sua conta, selecione a empresa correta, conecte-se à internet para sincronizar e confira as informações antes de continuar.</p>"
  }
];
const grupos=["Começar","Dia a dia","Financeiro","Equipe","Conta e ajuda"];
function destino(t){return '#/tutoriais/'+t.id}
function card(t){return '<a class="tutorial-card" href="'+destino(t)+'" data-busca="'+esc((t.title+' '+t.summary+' '+t.cat).toLocaleLowerCase('pt-BR'))+'">'+
 '<span class="tutorial-card-icone" aria-hidden="true">'+t.emoji+'</span><span><strong>'+esc(t.title)+'</strong><small>'+esc(t.summary)+'</small></span><span class="tutorial-seta" aria-hidden="true">›</span></a>'}
function render(){
 const id=(location.hash.split('/')[2]||'').split('?')[0];
 const artigo=topicos.find(x=>x.id===id);
 if(artigo){
   return '<div class="tutorial-breadcrumb"><a href="#/tutoriais">← Todos os tutoriais</a><span>'+esc(artigo.cat)+'</span></div>'+
   '<div class="tutorial-artigo-topo"><span class="tutorial-artigo-icone" aria-hidden="true">'+artigo.emoji+'</span><div><p class="tutorial-eyebrow">MANUAL DO ADMPRO</p><h1>'+esc(artigo.title)+'</h1><p class="muted">'+esc(artigo.summary)+'</p></div></div>'+
   '<article class="card tutorial-conteudo">'+artigo.body+'</article>'+
   '<div class="tutorial-pagina-rodape"><a href="#/tutoriais" class="btn secundario">← Voltar aos tutoriais</a><a href="#/suporte" class="btn">Preciso de ajuda</a></div>';
 }
 return '<header class="tutorial-hero"><p class="tutorial-eyebrow">CENTRAL DE AJUDA · ADMPRO</p><h1>Aprenda a usar seu AdmPro</h1>'+
 '<p>Um manual completo, com instruções para configurar o negócio, atender clientes, controlar o financeiro e trabalhar em equipe.</p>'+
 '<div class="tutorial-pesquisa"><label for="tutorial-busca" class="sr-only">Pesquisar tutoriais</label><input type="search" id="tutorial-busca" placeholder="O que você quer aprender?" autocomplete="off"><span aria-hidden="true">⌕</span></div>'+
 '</header><div class="tutorial-atalhos"><a href="#/tutoriais/primeiros-passos">🚀 Começar agora</a><a href="#/tutoriais/convites">👥 Convidar equipe</a><a href="#/tutoriais/assinaturas">⭐ Planos e Pix</a></div>'+
 '<div id="tutorial-lista">'+grupos.map(cat=>'<section class="tutorial-grupo" data-grupo="'+esc(cat)+'"><div class="section-heading"><h2>'+esc(cat)+'</h2><span>'+topicos.filter(t=>t.cat===cat).length+' tutoriais</span></div><div class="tutorial-grade">'+topicos.filter(t=>t.cat===cat).map(card).join('')+'</div></section>').join('')+'</div>'+
 '<p id="tutorial-sem-resultados" class="card tutorial-sem-resultados" hidden>Nenhum tutorial encontrado. Experimente buscar por “agenda”, “Pix”, “equipe” ou “clientes”.</p>'+
 '<aside class="tutorial-ajuda-extra"><div><strong>Não encontrou o que precisava?</strong><p>Nossa equipe pode ajudar com dúvidas sobre sua conta e o uso do sistema.</p></div><a class="btn" href="#/suporte">Falar com suporte</a></aside>';
}
function bind(root){
 const busca=root.querySelector('#tutorial-busca');if(!busca)return;
 busca.oninput=()=>{
  const termo=busca.value.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  let visiveis=0;
  root.querySelectorAll('.tutorial-card').forEach(el=>{
    const normal=el.dataset.busca.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const ok=!termo||normal.includes(termo);
    el.hidden=!ok;if(ok)visiveis++;
  });
  root.querySelectorAll('.tutorial-grupo').forEach(g=>g.hidden=!Array.from(g.querySelectorAll('.tutorial-card')).some(c=>!c.hidden));
  root.querySelector('#tutorial-sem-resultados').hidden=visiveis!==0;
 };
}
A.views=A.views||{};A.views.tutoriais={render,bind};
})(window.AdmPro=window.AdmPro||{});
