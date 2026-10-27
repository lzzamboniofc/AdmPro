-- Correção após validação RLS no staging.
-- Administrador do AdmPro Console não ganha acesso a dados privados apenas por ser admin.
-- Se também for membro legítimo da empresa, mantém as permissões do seu papel empresarial.
create or replace function public.pode_ler_dado(p_conta uuid,p_colecao text,p_id text,p_dados jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare prof text;
begin
  if not public.eh_membro(p_conta) then return false; end if;
  if p_colecao='config' then return true; end if;
  if p_colecao='catalogo' then return public.tem_permissao(p_conta,'catalogo.ver'); end if;
  if p_colecao='profissionais' then return public.tem_permissao(p_conta,'equipe.ver') or public.meu_profissional(p_conta)=p_id; end if;
  if p_colecao='clientes' then
    return public.tem_permissao(p_conta,'clientes.ver')
      or (public.tem_permissao(p_conta,'clientes.vinculados') and public.cliente_vinculado_ao_profissional(p_conta,p_id));
  end if;
  if p_colecao='servicos' then
    if public.tem_permissao(p_conta,'agenda.ver_todas') or public.tem_permissao(p_conta,'atendimentos.ver_todos') then return true; end if;
    prof:=public.meu_profissional(p_conta);
    return prof is not null and nullif(p_dados->>'profissionalId','')=prof
      and (public.tem_permissao(p_conta,'agenda.propria') or public.tem_permissao(p_conta,'atendimentos.proprios'));
  end if;
  if p_colecao in ('lancamentos','despesasFixas') then return public.tem_permissao(p_conta,'financeiro.ver'); end if;
  if p_colecao='movimentacoesEstoque' then return public.tem_permissao(p_conta,'estoque.ver'); end if;
  return false;
end $$;

create or replace function public.pode_inserir_dado(p_conta uuid,p_colecao text,p_id text,p_dados jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
  if not public.eh_membro(p_conta) then return false; end if;
  if p_colecao='config' then return public.tem_permissao(p_conta,'config.editar'); end if;
  if p_colecao='catalogo' then return public.tem_permissao(p_conta,'catalogo.editar'); end if;
  if p_colecao='profissionais' then return public.tem_permissao(p_conta,'equipe.editar'); end if;
  if p_colecao='clientes' then return public.tem_permissao(p_conta,'clientes.editar'); end if;
  if p_colecao='servicos' then return public.tem_permissao(p_conta,'agenda.editar'); end if;
  if p_colecao='lancamentos' then return public.tem_permissao(p_conta,'financeiro.editar') or public.tem_permissao(p_conta,'financeiro.receber'); end if;
  if p_colecao='despesasFixas' then return public.tem_permissao(p_conta,'financeiro.editar'); end if;
  if p_colecao='movimentacoesEstoque' then return public.tem_permissao(p_conta,'estoque.editar'); end if;
  return false;
end $$;

create or replace function public.pode_atualizar_dado(p_conta uuid,p_colecao text,p_id text,p_dados jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare prof text;
begin
  if not public.eh_membro(p_conta) then return false; end if;
  if p_colecao='servicos' then
    if public.tem_permissao(p_conta,'agenda.editar') then return true; end if;
    prof:=public.meu_profissional(p_conta);
    return prof is not null and nullif(p_dados->>'profissionalId','')=prof
      and public.tem_permissao(p_conta,'atendimentos.atualizar_proprios');
  end if;
  return public.pode_inserir_dado(p_conta,p_colecao,p_id,p_dados);
end $$;
