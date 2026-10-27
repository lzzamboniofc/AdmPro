# AdmPro / Supabase — roteiro de testes de aceitação

Execute em **staging** com duas contas confirmadas `U1` e `U2` e um usuário `ADMIN` separado. Registre evidências (captura de tela, data, conta, resultado e erro). Refaça os testes de regressão anteriores (`tests/regressao.js`, `tests/horarios.js`, `tests/pwa.js`) após instalar a integração, ajustando os cenários que pressupunham funcionamento sem login.

| Caso | Passos | Resultado esperado |
|---|---|---|
| Cadastro/trigger | Cadastrar U1 com e-mail/senha/aceite, confirmar e-mail | Uma conta com plano Gratuito, `trial_ate = cadastro + 14 dias`, um membro dono |
| Isolamento | U1 cria cliente, serviço, lançamento; U2 abre app e tenta consultar `/rest/v1/dados?conta_id=eq.UUID_U1` usando JWT U2 | U2 recebe zero linhas; INSERT/UPDATE na conta U1 negados |
| Admin LGPD | Login ADMIN, consultar `contas`, `pagamentos`, `feedbacks`; tentar `select * from dados` na API | ADMIN acessa metadados permitidos; **nenhum** dado dos clientes dos assinantes |
| Proibição de elevação | No DevTools de U1, tentar `supabase.from('contas').update({plano_id:UUID_PRO,status_assinatura:'ativa',trial_ate:'2099-01-01',proximo_vencimento:'2099-01-01'}).eq('id',UUID_U1)` | `42501/CAMPOS_ASSINATURA_PROTEGIDOS`; registro inalterado |
| Pagamentos protegidos | U1 tenta inserir/alterar em `pagamentos`, `planos`, `admins`, `config_sistema` | Negado pela RLS; nenhum registro modificado |
| Feedback protegido | U1 envia dúvida, tenta marcar `status:respondido` ou escrever `resposta` via console | Criação permitida; alteração de campos de suporte negada |
| Offline → online | U1 logado com cache pré-carregado ativa DevTools Offline; cadastra cliente; volta Online | Cliente visível imediatamente no cache; indicador pendente; fila esvazia depois do upload; outro navegador de U1 recebe registro |
| Conflito | Dois dispositivos editam o mesmo cliente; dispositivo offline faz alteração às 10h, online altera às 11h; reconecte offline | Edição mais recente vence; conflito antigo retorna `STALE_WRITE`, cache reidrata; não duplicar registro |
| Exclusão lógica | U1 exclui cliente e sincroniza; consultar como U1 | `dados.excluido = true`, histórico permanece no servidor; UI não mostra registro |
| Cache por conta | U1 entra e sai, U2 entra no mesmo aparelho | Não mostrar cliente/U1 para U2; prefixos `admpro_<conta_id>_`; logout remove cache da conta anterior |
| Aviso logout com pendências | Criar registro offline e clicar Sair | Modal avisa sobre pendências e perda do cache; cancelar mantém dados |
| Migração legado | Com dados antigos `admpro_clientes`/`admpro_config`, fazer login na conta nova | Oferece migração opcional; envia dados somente após aceitar; mantém originais |
| Limite de clientes | Conta Gratuito cria 30 clientes e tenta criar 31º; repetir INSERT diretamente pela API | Modal/erro de limite; trigger nega no banco; nenhum dado existente é apagado |
| Limite mensal de serviços | Conta Gratuito cria 40 serviços no mês e tenta 41º; tentar falsificar `criadoEm` no JSON | Banco nega com `LIMITE_SERVICOS_MES` com contagem do servidor; mês seguinte permite novas criações |
| Contadores antifraude | U1 tenta alterar `uso_diario.servicos_criados` via API/console | Negado; dados alterados somente por trigger/RPC |
| Assinatura trial | Simular `trial_ate` no passado no SQL Editor; logar como U1 | Conta passa para `ativa`, plano Gratuito, dados preservados |
| Assinatura atrasada | Admin configura Pro e vencimento passado, status ativa; logar | Conta vai para `atrasada`, banner com pagar, escrita continua |
| Assinatura bloqueada | Admin simula vencimento anterior à tolerância; logar | `bloqueada`, telas acessíveis somente leitura, FAB oculto, qualquer gravação negada no servidor; backup e Pix disponíveis |
| Pix e plano | Administrador configura preço Pro + pix. U1 abre Assinatura e envia aviso de pagamento | Preço/chave corretos; botão copia; cria `feedback` tipo pagamento; **não** altera plano/pagamento automaticamente |
| Aviso no Início | Admin cria aviso `todos`, `trial`, `atrasada` e aviso com UUID U1; U1 entra e fecha aviso | Só avisos destinados a U1 são exibidos no topo; fechar persiste no cache; X funciona |
| Recuperar senha | Solicitar reset por e-mail e usar link de recuperação | Formulário permite nova senha; acesso antigo deixa de servir; PIN continua por dispositivo |
| Acesso contabilizado | Abrir app, mudar abas e voltar após >30 min | `registrar_acesso` soma um acesso por abertura/retorno elegível, não a cada render; atualiza versão |
| PWA offline | Instalar, recarregar offline já logado, voltar online | UI carrega do cache; API não interceptada pelo SW, alterações pendentes sincronizam |

## Injeções REST sugeridas

Use **tokens reais de staging** com `Authorization: Bearer <JWT_U1>` e `apikey: <ANON_KEY>`; nunca `service_role`. Confira tanto consulta quanto mutation. A RLS não deve depender da interface HTML nem de valores de `localStorage`. Em `blocked`, confira que a RPC não deixa escapar alterações privilegiadas, e que `excluido` impede apagar fisicamente (`DELETE` deve retornar permissão negada).

## Segurança a validar adicionalmente

Verifique que nenhuma tabela fica sem RLS (`select ... from pg_tables`); revise permissão `EXECUTE` das funções com `security definer`, `search_path`, auditoria de triggers e dependências. Teste concorrência criando serviços simultaneamente em duas abas na virada do limite. Reavalie clocks desalinhados (>5 minutos); o servidor deve rejeitar relógio futuro. Confronte métricas de `uso_diario` com linhas gravadas. Teste falha de rede durante exportação, expiração de sessão e reconexão depois de dias offline.