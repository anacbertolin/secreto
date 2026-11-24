-- =====================================================================
-- 0096 — Administração também responde a Orientação Cirúrgica + aviso do número novo
-- =====================================================================
-- Pedido da dona (24/11/2026): como administradora e criadora do sistema, ela quer poder fazer tudo,
-- inclusive responder no número da Orientação Cirúrgica, para avaliar se está funcionando.
--  * whatsapp_conversas: admin passa a poder alterar (assumir, arquivar, ligar ao paciente) as conversas
--    da orientação. O envio em si passa pela função whatsapp-enviar, que segue a mesma regra.
--  * A admin NÃO entra na fila da orientação (interno.atende_orientacao continua só para a equipe marcada):
--    na Central ela segue no setor da clínica; na aba Orientação ela acompanha e responde quando quiser.
--  * Novo modelo "aviso_novo_numero_orientacao" (Utilidade, enviado à Meta em 24/11, em análise): avisa o
--    paciente de que a orientação cirúrgica passou a atender por este número. Nasce desligado.
--  * "retomar_orientacao" foi aprovado pela Meta (24/11): ligado.
-- =====================================================================

drop policy quem_atende_altera on public.whatsapp_conversas;
create policy quem_atende_altera on public.whatsapp_conversas for update to authenticated
  using (
    (setor = 'clinica' and (select interno.tem_funcao('recepcao', 'admin')))
    or (setor = 'orientacao' and ((select interno.tem_funcao('admin')) or (select interno.atende_orientacao())))
  )
  with check (
    (setor = 'clinica' and (select interno.tem_funcao('recepcao', 'admin')))
    or (setor = 'orientacao' and ((select interno.tem_funcao('admin')) or (select interno.atende_orientacao())))
  );

alter table public.whatsapp_modelos drop constraint whatsapp_modelos_finalidade_check;
alter table public.whatsapp_modelos add constraint whatsapp_modelos_finalidade_check
  check (finalidade in ('lembrete_consulta', 'retomar_conversa', 'retomar_orientacao', 'aviso_novo_numero_orientacao'));

insert into public.whatsapp_modelos (finalidade, nome, idioma, corpo, parametros, botoes, ativo) values
  ('aviso_novo_numero_orientacao', 'aviso_novo_numero_orientacao', 'pt_BR',
   'Olá, {{1}}! Este é o novo número da Orientação Cirúrgica da Consumed Clínica de Olhos. A partir de agora, o acompanhamento da sua cirurgia (orçamento, documentos, exames e orientações) será feito por aqui. Salve este contato. Se tiver qualquer dúvida, é só responder esta mensagem.',
   array['paciente'], false, false)
on conflict (finalidade) do nothing;

update public.whatsapp_modelos set ativo = true where finalidade = 'retomar_orientacao';
