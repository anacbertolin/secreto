-- 0155 — Parcela do cartão "entra" sozinha na data prevista (decisão do Dr. Gelson, 25/11/2026)
-- Conferir se cada parcela caiu na conta é praticamente impossível: a clínica confia que a operadora paga.
-- Toda parcela (menos a "cobrança ao médico", em que é o médico quem paga) nasce com recebido_em = data_prevista.
-- O botão "Entrou hoje" sai da tela; o relatório por médico passa a mostrar as parcelas pelo mês em que caem.
create or replace function interno.tg_repasse_parcela_entra_sozinha()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.recebido_em is null and (select r.regra from public.repasses r where r.id = new.repasse_id) <> 'cobranca' then
    new.recebido_em := new.data_prevista;
  end if;
  return new;
end $$;
create trigger entra_sozinha before insert on public.repasse_parcelas
  for each row execute function interno.tg_repasse_parcela_entra_sozinha();
revoke execute on function interno.tg_repasse_parcela_entra_sozinha() from public, anon, authenticated;

-- repasses já lançados: as parcelas ainda não marcadas passam a valer pela data prevista
update public.repasse_parcelas p set recebido_em = p.data_prevista
from public.repasses r
where r.id = p.repasse_id and p.recebido_em is null and r.status <> 'cancelado' and r.regra <> 'cobranca';
