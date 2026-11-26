#!/bin/bash
# Envia o banco de trabalho "carga" (estado do Supabase + Micrologos transformado) para o Supabase, na ordem certa.
# SÓ NO DIA DA TROCA (roteiro em migracao/PROXIMOS-PASSOS.md). Teste: SIMULAR=1 migracao/carga/enviar_tudo.sh
set -e
cd "$(dirname "$0")/../.."
migracao/local/garantir_docker.sh
IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' pg16)
PW=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' pg16 | sed -n 's/^POSTGRES_PASSWORD=//p')
PG="postgresql://postgres:$PW@$IP/carga"
SIM=${SIMULAR:+--simular}
e() { python3 migracao/carga/enviar.py --pg "$PG" $SIM "$@" | tail -1; }
M="exists (select 1 from legacy_micrologos.mapa_ids m where m.novo_id = t.id)"   # só o que veio do Micrologos

# 1) cadastros (os que já existem no sistema são completados: modo atualizar)
e --tabela public.profissionais --atualizar
e --tabela public.profissional_dados_tiss --atualizar
e --tabela public.profissionais_dados_pessoais                       # não sobrescreve CPF já cadastrado
e --tabela public.convenios --atualizar                              # completa os Unimed provisórios (0176)
e --tabela public.convenio_planos
e --tabela public.procedimentos
e --tabela public.precos --lote 5000
e --tabela public.hospitais
e --tabela public.hospital_convenio_codigos
e --tabela public.profissional_convenio_codigos
# 2) pacientes: PRIMEIRO os da equipe que foram juntados (assumem o nº do Micrologos e liberam o nº antigo), depois os novos
#    (na ordem inversa, 33 pacientes do Micrologos com nº 3–43 batiam no nº antigo da equipe; 26/11)
e --tabela public.pacientes --onde "t.id in (select paciente_id from legacy_micrologos.ajustes_equipe)" --atualizar
e --tabela public.pacientes --onde "t.id not in (select paciente_id from legacy_micrologos.ajustes_equipe)" --lote 2000
# 3) movimento
e --tabela public.agendamentos --onde "$M" --lote 3000
e --tabela public.prontuario_legado --onde "$M" --lote 1000 --max-bytes 3000000
e --tabela public.lotes --onde "$M"
e --tabela public.contas --onde "$M" --lote 2000
e --tabela public.conta_itens --onde "$M" --lote 3000
# 4) de-para e registros da migração
for t in mapa_ids ocorrencias fusoes_pacientes ajustes_equipe; do e --tabela legacy_micrologos.$t --lote 5000; done
echo "Envio terminado. Agora: conferir totais (migracao/carga/conferir.sql) e acertar as sequências no Supabase."
