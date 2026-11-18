-- =====================================================================
-- 0064 — Importar conversas antigas do WhatsApp do celular
-- =====================================================================
-- Antes de levar o número da clínica para a API oficial da Meta, a conta do
-- WhatsApp do celular precisa ser apagada, e as conversas somem do aparelho.
-- A equipe exporta cada conversa no celular ("Exportar conversa") e importa
-- o arquivo aqui: as mensagens entram na conversa daquele número, como histórico.
--
--  * whatsapp_mensagens.importada = true marca o que veio do celular.
--  * Importar de novo o mesmo arquivo não duplica (wa_id = 'importado:' + código).
--  * O Assistente de IA NÃO lê o histórico importado como conversa nova
--    (não marca consultas de meses atrás): o "lido até" dele avança junto.
--    Ele pode usar essas mensagens só como contexto da próxima conversa real.
--  * Não mexe na janela de 24 h nem no contador de não lidas.
--  * Fotos, áudios e documentos vão para o bucket privado "whatsapp-midia",
--    na pasta <setor>/importado/, e abrem pelo mesmo caminho das mídias da Meta.
--  * Quem pode importar: quem responde aquele número (recepção e admin no da
--    clínica; quem atende a Orientação Cirúrgica no dela; admin em ambos).
--  * Cada importação deixa uma linha no registro de auditoria.
-- =====================================================================

alter table public.whatsapp_mensagens add column importada boolean not null default false;
comment on column public.whatsapp_mensagens.importada is
  'true = mensagem antiga importada do WhatsApp do celular (exportação), não veio da Meta.';

-- Quem pode importar conversas para um número
create or replace function interno.pode_importar_whatsapp(p_setor text)
returns boolean language sql stable security definer set search_path = '' as $$
  select interno.tem_funcao('admin')
      or (p_setor = 'clinica' and interno.tem_funcao('recepcao'))
      or (p_setor = 'orientacao' and interno.atende_orientacao())
$$;
revoke execute on function interno.pode_importar_whatsapp(text) from public, anon;
grant execute on function interno.pode_importar_whatsapp(text) to authenticated, service_role;

-- p_mensagens: lista de { quando (ISO), direcao ('recebida'|'enviada'), tipo, texto,
--                         codigo (identificador estável da mensagem no arquivo),
--                         midia_caminho, midia_tipo, midia_nome }
create or replace function public.whatsapp_importar(
  p_setor text, p_telefone text, p_nome text, p_paciente uuid, p_mensagens jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tel       text;
  v_conversa  uuid;
  v_total     int;
  v_novas     int;
  v_max       timestamptz;
begin
  if p_setor not in ('clinica', 'orientacao') then
    raise exception 'Número de WhatsApp desconhecido.';
  end if;
  if not interno.pode_importar_whatsapp(p_setor) then
    raise exception 'Você não tem permissão para importar conversas deste número.';
  end if;
  if jsonb_typeof(p_mensagens) <> 'array' then
    raise exception 'Formato de mensagens inválido.';
  end if;
  v_total := jsonb_array_length(p_mensagens);
  if v_total = 0 then
    raise exception 'Nenhuma mensagem para importar.';
  end if;
  if v_total > 2000 then
    raise exception 'Envie no máximo 2.000 mensagens por vez.';
  end if;

  -- celular no formato do WhatsApp; se não for celular brasileiro, aceita só dígitos (10 a 15)
  v_tel := coalesce(public.telefone_whatsapp(p_telefone), nullif(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), ''));
  if v_tel is null or v_tel !~ '^[0-9]{10,15}$' then
    raise exception 'Informe o número de WhatsApp do paciente (com DDD).';
  end if;
  if p_paciente is not null and not exists (select 1 from public.pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrado.';
  end if;

  v_conversa := public.whatsapp_conversa(v_tel, nullif(trim(p_nome), ''), p_paciente, p_setor);

  with entrada as (
    select e.*
    from jsonb_to_recordset(p_mensagens) as e(
      quando timestamptz, direcao text, tipo text, texto text, codigo text,
      midia_caminho text, midia_tipo text, midia_nome text)
  ), validas as (
    select * from entrada
    where quando is not null and direcao in ('recebida', 'enviada') and coalesce(codigo, '') <> ''
      and quando <= now() + interval '1 day'
      and (midia_caminho is null or midia_caminho like p_setor || '/importado/%')
  ), ins as (
    insert into public.whatsapp_mensagens
      (conversa_id, direcao, wa_id, tipo, texto, midia_tipo, midia_nome, midia_caminho, situacao, quando, importada)
    select v_conversa, v.direcao, 'importado:' || left(v.codigo, 80),
           case when v.tipo in ('texto', 'imagem', 'audio', 'video', 'documento', 'figurinha', 'localizacao', 'contato', 'outro')
                then v.tipo else 'texto' end,
           left(v.texto, 20000), v.midia_tipo, left(v.midia_nome, 300), v.midia_caminho,
           case when v.direcao = 'recebida' then 'recebida' else 'enviada' end,
           v.quando, true
    from validas v
    on conflict (wa_id) do nothing
    returning id, quando
  )
  select count(*), max(quando) into v_novas, v_max from ins;

  -- Mídia guardada: marca depois de gravar (em outro comando), para a transcrição
  -- automática, que olha só a inserção, não tentar buscar o arquivo na Meta.
  -- A tela usa midia_id para mostrar o botão "ver"; o arquivo sai do Storage.
  update public.whatsapp_mensagens set midia_id = 'importado'
   where conversa_id = v_conversa and importada and midia_caminho is not null and midia_id is null;

  if v_novas > 0 then
    update public.whatsapp_conversas
       set ultima_mensagem_em = greatest(coalesce(ultima_mensagem_em, '-infinity'::timestamptz), v_max)
     where id = v_conversa;

    -- O Assistente trata o histórico importado como já lido
    insert into public.whatsapp_extrator_estado (conversa_id, analisado_ate)
    values (v_conversa, (select ultima_mensagem_em from public.whatsapp_conversas where id = v_conversa))
    on conflict (conversa_id) do update
      set analisado_ate = greatest(coalesce(public.whatsapp_extrator_estado.analisado_ate, '-infinity'::timestamptz),
                                   excluded.analisado_ate);

    insert into public.log_auditoria (acao, tabela, registro_id, paciente_id, detalhes)
    values ('IMPORTACAO', 'whatsapp_mensagens', v_conversa,
            (select paciente_id from public.whatsapp_conversas where id = v_conversa),
            format('Importou %s mensagem(ns) antiga(s) do WhatsApp do celular (número %s, setor %s).', v_novas, v_tel, p_setor));
  end if;

  return jsonb_build_object('conversa_id', v_conversa, 'recebidas', v_total, 'importadas', v_novas,
                            'ja_existiam', v_total - v_novas);
end $$;
revoke execute on function public.whatsapp_importar(text, text, text, uuid, jsonb) from public, anon;
grant execute on function public.whatsapp_importar(text, text, text, uuid, jsonb) to authenticated;

-- Envio dos arquivos (fotos, áudios, documentos) só para a pasta "importado" do número
-- que a pessoa pode importar. Ninguém lê direto: abrem pela função whatsapp-enviar.
create policy whatsapp_importar_envia on storage.objects for insert to authenticated
  with check (
    bucket_id = 'whatsapp-midia'
    and (storage.foldername(name))[2] = 'importado'
    and (storage.foldername(name))[1] in ('clinica', 'orientacao')
    and (select interno.pode_importar_whatsapp((storage.foldername(name))[1]))
  );
