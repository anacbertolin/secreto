#!/bin/bash
# Recria o banco local (Postgres 16 com o Supabase simulado) e aplica todas as migrações do repositório.
# Uso: migracao/local/aplicar_migracoes.sh   (precisa do container "pg16" com o repositório em /repo)
set -e
DB=${DB:-secreto}   # banco a recriar (ex.: DB=carga)
docker exec pg16 psql -U postgres -q -c "drop database if exists $DB" -c "create database $DB" >/dev/null
docker exec pg16 psql -U postgres -d $DB -v ON_ERROR_STOP=1 -q -f /repo/migracao/local/00_supabase_simulado.sql 2>/dev/null
for f in $(cd /home/user/secreto && ls supabase/migrations/*.sql | sort); do
  # extensões que não existem no Postgres puro viram comentário (os schemas cron/net/vault são simulados)
  sed -E 's/^\s*create extension[^;]*(pg_net|pg_cron|pg_graphql|pg_stat_statements|supabase_vault|pgsodium)[^;]*;/-- (extensão ignorada no ensaio local)/I' "/home/user/secreto/$f" \
    | docker exec -i pg16 psql -U postgres -d $DB -v ON_ERROR_STOP=1 -q -1 -f - >/tmp/mig.out 2>&1 \
    || { echo "FALHOU $f"; grep -A3 ERROR /tmp/mig.out | head -8; exit 1; }
done
echo "OK: $(cd /home/user/secreto && ls supabase/migrations/*.sql | wc -l) migrações aplicadas"
