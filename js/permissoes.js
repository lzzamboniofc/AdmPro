/* Único ponto do frontend para decisões de autorização. O banco continua sendo a autoridade final. */
(function(A){
'use strict';
const rotas={
  inicio:null,agenda:['agenda.ver_todas','agenda.propria'],clientes:['clientes.ver','clientes.vinculados'],
  servicos:['atendimentos.ver_todos','atendimentos.proprios','agenda.ver_todas','agenda.propria'],
  financeiro:['financeiro.ver'],catalogo:['catalogo.ver'],config:['config.editar'],
  equipe:['equipe.ver'],assinatura:['assinatura.gerenciar'],suporte:null,tutoriais:null,empresas:null
};
function pode(chave){return !!A.auth?.permissoes?.[chave];}
function alguma(chaves){return !chaves||chaves.some(pode);}
function rota(nome){return alguma(rotas[nome]??null);}
function podeCriar(nome){
  return ({agenda:'agenda.editar',clientes:'clientes.editar',servicos:'agenda.editar',
    financeiro:'financeiro.editar',catalogo:'catalogo.editar',equipe:'equipe.editar'})[nome]
    ? pode(({agenda:'agenda.editar',clientes:'clientes.editar',servicos:'agenda.editar',
      financeiro:'financeiro.editar',catalogo:'catalogo.editar',equipe:'equipe.editar'})[nome]) : true;
}
A.permissoes={pode,alguma,rota,podeCriar};
})(window.AdmPro=window.AdmPro||{});
