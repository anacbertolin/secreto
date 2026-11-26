-- =====================================================================
-- 0181 — Nº de prontuário provisório a partir de 200.001 até a troca do Micrologos (decisão da dona, 26/11/2026)
-- Os pacientes do Micrologos mantêm o mesmo nº (até ~119 mil e crescendo até a troca). Os cadastrados no sistema novo
-- antes da troca ganhavam 3, 4, 5…, números que já são de outros pacientes no Micrologos. A partir de agora ganham
-- 200.001 em diante. Na troca: quem também existe no Micrologos é juntado e fica com o nº de lá; depois da troca a
-- numeração volta a continuar a do Micrologos (migracao/transformacoes/01_pacientes.sql, passo 6).
-- =====================================================================
select setval(pg_get_serial_sequence('public.pacientes', 'numero_prontuario'), 200000)
where (select last_value from public.pacientes_numero_prontuario_seq) < 200000;
