-- Monta, no banco do ENSAIO LOCAL, os dados de uma cobrança no formato que app/src/lib/tissMontar.ts espera (DadosLote),
-- para gerar o XML do sistema novo e comparar com o XML que o Micrologos gerou da mesma cobrança.
-- Uso: psql -v cob=<nº da cobrança no Micrologos> -At -f migracao/xml/dados_cobranca.sql > /tmp/cobranca.json
-- ⚠️ A saída tem dados de pacientes (carteirinha): fica só na máquina de ensaio, nunca no repositório.
with l as (select * from public.lotes where numero = :cob),
c as (
  select ct.*, (select jsonb_build_object('primeira_vez', a.primeira_vez, 'tipo', a.tipo) from public.agendamentos a where a.id = ct.agendamento_id) as ag,
    (select jsonb_build_object('nome', p.nome) from public.pacientes p where p.id = ct.paciente_id) as pac,
    (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'tabela', i.tabela, 'codigo', i.codigo, 'descricao', i.descricao,
        'data_execucao', i.data_execucao, 'quantidade', i.quantidade, 'valor_unitario', i.valor_unitario, 'olho', i.olho,
        'profissional_id', i.profissional_id, 'grau_participacao', i.grau_participacao, 'fator', i.fator, 'numero_guia', i.numero_guia, 'numero_guia_operadora', i.numero_guia_operadora, 'legado', i.legado,
        'procedimentos', (select jsonb_build_object('tipo', pr.tipo, 'unidade_tiss', pr.unidade_tiss, 'registro_anvisa', pr.registro_anvisa) from public.procedimentos pr where pr.id = i.procedimento_id))
        order by i.criado_em, i.id), '[]') from public.conta_itens i where i.conta_id = ct.id) as itens
  from public.contas ct where (ct.lote_id = (select id from l)
      or ct.id in (select i.conta_id from public.conta_itens i where i.legado->>'id_cobranca' = (select legado->>'id_cobranca' from l)))
    and ct.status <> 'cancelada')
select jsonb_build_object(
  'lote', (select jsonb_build_object('numero', numero, 'competencia', competencia, 'legado', legado) from l),
  'conv', (select jsonb_build_object('nome', cv.nome, 'registro_ans', cv.registro_ans, 'codigo_prestador', cv.codigo_prestador,
            'versao_tiss', cv.versao_tiss, 'tiss', cv.tiss) from public.convenios cv where cv.id = (select convenio_id from l)),
  'contas', (select coalesce(jsonb_agg(to_jsonb(c) - 'ag' - 'pac' - 'itens' || jsonb_build_object('agendamentos', c.ag, 'pacientes', c.pac, 'conta_itens', c.itens)
            order by c.data_atendimento, c.numero_guia_prestador), '[]') from c),
  'profs', (select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'conselho', conselho, 'numero_conselho', numero_conselho,
            'uf_conselho', uf_conselho, 'cbo', cbo)) from public.profissionais),
  'codigos', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from public.profissional_convenio_codigos p where p.convenio_id = (select convenio_id from l)),
  'codigosTodos', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from public.profissional_convenio_codigos p),
  'dadosTiss', (select coalesce(jsonb_agg(jsonb_build_object('profissional_id', p.id, 'nome_guia', t.nome_guia, 'cpf', d.cpf)), '[]')
            from public.profissionais p left join public.profissional_dados_tiss t on t.profissional_id = p.id
            left join public.profissionais_dados_pessoais d on d.profissional_id = p.id),
  'hospitais', (select jsonb_agg(jsonb_build_object('id', h.id, 'nome', h.nome, 'cnpj', h.cnpj, 'cnes', h.cnes,
            'codigo_operadora', k.codigo_operadora, 'cnes_convenio', k.cnes))
            from public.hospitais h left join public.hospital_convenio_codigos k on k.hospital_id = h.id and k.convenio_id = (select convenio_id from l)));
