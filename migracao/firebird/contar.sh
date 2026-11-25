#!/bin/bash
# Lista tabelas de usuário e conta registros (só estrutura). Uso: contar.sh /dados/ARQ.FDB
DB=$1
T=$(printf "set heading off;\nselect trim(rdb\$relation_name) from rdb\$relations where coalesce(rdb\$system_flag,0)=0 and rdb\$view_blr is null order by 1;\n" | /opt/firebird/bin/isql -q -user SYSDBA -password migracao "$DB" | sed '/^\s*$/d')
SQL="set heading off;"
for t in $T; do SQL="$SQL select '$t', count(*) from \"$t\";"; done
echo "$SQL" | /opt/firebird/bin/isql -q -user SYSDBA -password migracao "$DB" | sed '/^\s*$/d' | awk '{printf "%-35s %s\n",$1,$2}'
