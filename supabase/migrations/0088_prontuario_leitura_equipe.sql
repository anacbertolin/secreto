-- 0088 — Prontuário: toda a equipe VÊ, só o médico escreve (pedido da dona, 24/11/2026).
-- Recepção, telefone, administração e faturamento precisam consultar o histórico clínico para marcar
-- (ex.: se o paciente é de retina, glaucoma ou rotina). Antes só médico e enfermagem liam.
-- Só LEITURA é aberta aqui: as regras de escrita não mudam (o médico registra o atendimento; a enfermagem
-- continua com pré-consulta/refração e o que já fazia). Cada abertura de ficha/atendimento continua registrada
-- na auditoria (registrar_leitura), agora também para essas funções.
do $$
declare t text;
begin
  foreach t in array array[
    'adendos', 'alergias', 'antecedentes', 'atendimentos', 'cirurgias', 'desenhos_oculares', 'diagnosticos',
    'documentos_clinicos', 'exame_arquivos', 'exames_oftalmologicos', 'exames_realizados', 'injecoes_intravitreas',
    'medicamentos_em_uso', 'memed_prescricoes', 'paciente_documentos', 'prescricao_itens', 'prescricoes',
    'prescricoes_oculos', 'prontuario_legado', 'refracoes', 'seguimentos', 'solicitacoes_exames', 'triagens'
  ] loop
    execute format('drop policy if exists equipe_ve_prontuario on public.%I', t);
    execute format($p$create policy equipe_ve_prontuario on public.%I for select to authenticated
      using ((select interno.tem_funcao('recepcao', 'admin', 'faturamento')))$p$, t);
  end loop;
end $$;

-- arquivos de exames e documentos (buckets privados): leitura também para a equipe
drop policy if exists exames_equipe_le on storage.objects;
create policy exames_equipe_le on storage.objects for select to authenticated
  using (bucket_id = 'exames' and (select interno.tem_funcao('recepcao', 'admin', 'faturamento')));
drop policy if exists documentos_equipe_le on storage.objects;
create policy documentos_equipe_le on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and (select interno.tem_funcao('recepcao', 'admin', 'faturamento')));
