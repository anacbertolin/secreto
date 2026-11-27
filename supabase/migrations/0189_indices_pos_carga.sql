-- =====================================================================
-- 0189 — Índices depois da carga do Micrologos (sessão "Dados para migração", 27/11/2026)
-- Com 117 mil pacientes, achar o paciente pelo telefone (WhatsApp: whatsapp_paciente_do_numero, a cada mensagem
-- recebida) levava 5,4 s e estourava o limite de 8 s quando o banco estava ocupado. Índices pela mesma "chave do
-- telefone" (DDD + 8 últimos dígitos) usada na busca, só de pacientes ativos.
-- =====================================================================
create index if not exists pacientes_chave_telefone_idx
  on public.pacientes (interno.chave_telefone(telefone)) where ativo;
create index if not exists pacientes_chave_telefone2_idx
  on public.pacientes (interno.chave_telefone(telefone_secundario)) where ativo;
