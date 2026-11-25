-- =====================================================================
-- 0162 — Ajuste dos logins vindos do Micrologos (dona, 25/11/2026)
-- - Saem (não trabalham mais na clínica; criados na 0161 e nunca usados — sem senha, sem dados ligados):
--   Ana Beatriz Carrilho Vieira, Beatriz do Nascimento Tomaz, Caroline Aparecida Ferreira da Silva.
-- - Entram: Marcio (TI), Darlene e Rafael (a dona gera a senha se precisar). Função inicial recepção; a dona ajusta.
-- - Alessandra Moura de Oliveira (Micrologos) = Alessandra Galter (já cadastrada): nada a criar.
-- =====================================================================
delete from public.profissionais
where usuario in ('ana.vieira', 'beatriz.tomaz', 'caroline.silva')
  and not exists (select 1 from auth.users u where lower(u.email) = lower(public.profissionais.email));

insert into public.profissionais (nome, usuario, funcao, ativo)
select v.nome, v.usuario, 'recepcao'::public.funcao_profissional, true
from (values
  ('Marcio Leandro da Silva', 'marcio.silva'),
  ('Darlene Cardoso Marreiro', 'darlene.marreiro'),
  ('Rafael Ramos da Costa', 'rafael.costa')
) as v(nome, usuario)
where not exists (select 1 from public.profissionais p where p.usuario = v.usuario or lower(p.nome) = lower(v.nome));
