-- Folgas, férias, ausências e bloqueios podem cobrir uma data ou um intervalo.
create or replace function private.profissional_disponivel(
  p_conta uuid,p_profissional text,p_data date,p_hora text,p_duracao integer
) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare
  v_prof jsonb; v_config jsonb; v_semana jsonb; v_dia jsonb;
  v_dow integer; v_ini integer; v_fim integer; v_inicio_turno integer; v_fim_turno integer;
  v_di text; v_df text; a jsonb; t jsonb;
begin
  select d.dados into v_prof from public.dados d
   where d.conta_id=p_conta and d.colecao='profissionais' and d.id=p_profissional and not d.excluido;
  if v_prof is null then return false; end if;

  v_ini:=private.hora_minutos(p_hora);
  if v_ini is null then return false; end if;
  v_fim:=v_ini+greatest(1,least(coalesce(p_duracao,60),1440));
  if v_fim>1440 then return false; end if;

  for a in select value from jsonb_array_elements(coalesce(v_prof->'ausencias','[]'::jsonb)) loop
    v_di:=coalesce(nullif(a->>'dataInicio',''),nullif(a->>'data',''));
    v_df:=coalesce(nullif(a->>'dataFim',''),v_di);
    if v_di is not null and p_data::text>=v_di and p_data::text<=v_df then
      v_inicio_turno:=coalesce(private.hora_minutos(a->>'inicio'),0);
      v_fim_turno:=coalesce(private.hora_minutos(a->>'fim'),1440);
      if v_ini<v_fim_turno and v_inicio_turno<v_fim then return false; end if;
    end if;
  end loop;

  v_semana:=v_prof->'horariosSemana';
  if v_semana is null or jsonb_typeof(v_semana)<>'array' or jsonb_array_length(v_semana)<>7 then
    select d.dados into v_config from public.dados d
     where d.conta_id=p_conta and d.colecao='config' and not d.excluido
     order by d.atualizado_em desc limit 1;
    v_semana:=v_config->'horariosSemana';
  end if;

  v_dow:=extract(dow from p_data)::integer;
  if v_semana is not null and jsonb_typeof(v_semana)='array' and jsonb_array_length(v_semana)=7 then
    v_dia:=v_semana->v_dow;
    if not coalesce((v_dia->>'ativo')::boolean,false) then return false; end if;
    for t in select value from jsonb_array_elements(coalesce(v_dia->'turnos','[]'::jsonb)) loop
      v_inicio_turno:=private.hora_minutos(t->>'inicio');
      v_fim_turno:=private.hora_minutos(t->>'fim');
      if v_inicio_turno is not null and v_fim_turno is not null
         and v_ini>=v_inicio_turno and v_fim<=v_fim_turno then return true; end if;
    end loop;
    return false;
  end if;

  if v_config is null then
    select d.dados into v_config from public.dados d
     where d.conta_id=p_conta and d.colecao='config' and not d.excluido
     order by d.atualizado_em desc limit 1;
  end if;
  if v_config is not null and jsonb_typeof(v_config->'diasAtendimento')='array' then
    if not exists(
      select 1 from jsonb_array_elements_text(v_config->'diasAtendimento') x(valor)
      where x.valor::integer=v_dow
    ) then return false; end if;
    v_inicio_turno:=private.hora_minutos(v_config->>'horaInicio');
    v_fim_turno:=private.hora_minutos(v_config->>'horaFim');
    if v_inicio_turno is not null and v_fim_turno is not null then
      return v_ini>=v_inicio_turno and v_fim<=v_fim_turno;
    end if;
  end if;
  return true;
exception when others then return false;
end $$;

revoke all on function private.profissional_disponivel(uuid,text,date,text,integer)
from public,anon,authenticated;
