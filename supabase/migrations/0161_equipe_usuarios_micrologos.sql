-- =====================================================================
-- 0161 — Logins da equipe vinda do Micrologos (sessão "Dados para migração", 25/11/2026)
-- Pedido da dona: criar o usuário (nome.sobrenome) de quem está ativo no Micrologos e ainda não
-- está na tela Equipe. Ela confere a função de cada um e gera as senhas pela tela Equipe.
-- Critério: usuário não bloqueado no Micrologos e com acesso nos últimos 6 meses.
-- Função inicial: recepção (o Micrologos não separa função: quase todos eram "MASTER") — a dona ajusta.
-- Não copia CPF nem senha. O e-mail interno <usuario>@equipe.consumedolhos.com.br é gerado pelo gatilho.
-- Idempotente: não cria quem já tiver o mesmo usuário ou o mesmo nome.
-- =====================================================================
insert into public.profissionais (nome, usuario, funcao, ativo)
select v.nome, v.usuario, 'recepcao'::public.funcao_profissional, true
from (values
  ('Ana Beatriz Carrilho Vieira', 'ana.vieira'),
  ('Beatriz do Nascimento Tomaz', 'beatriz.tomaz'),
  ('Caroline Aparecida Ferreira da Silva', 'caroline.silva'),
  ('Claudia Loraine Lunz Caldeira', 'claudia.caldeira'),
  ('Eveline Isabel Alves dos Santos', 'eveline.santos'),
  ('Gabrielle Morais de Oliveira', 'gabrielle.oliveira'),
  ('Glayce Kelly Barbosa Mendes da Silva', 'glayce.silva'),
  ('Guilherme Pontes Campino', 'guilherme.campino'),
  ('João Rodrigues da Silva Junior', 'joao.junior'),
  ('Juliany de Carvalho Camilo Crespo', 'juliany.crespo'),
  ('Maria Alice dos Santos Ferreira Silva', 'maria.silva'),
  ('Mayara Aparecida Felicia dos Santos Silverio', 'mayara.silverio'),
  ('Patricia Ribeiro Lacerda', 'patricia.lacerda'),
  ('Priscila de Azevedo Oliveira', 'priscila.oliveira'),
  ('Tiago Oliveira da Silva', 'tiago.silva'),
  ('Victoria Barreto da Silva Cavalcanti', 'victoria.cavalcanti'),
  ('Viviane Leite Estrela', 'viviane.estrela')
) as v(nome, usuario)
where not exists (select 1 from public.profissionais p
                  where p.usuario = v.usuario or lower(p.nome) = lower(v.nome));
