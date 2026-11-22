#!/usr/bin/env bash
# Valida XML TISS contra o XSD oficial da ANS e confere o hash do epílogo
# com um cálculo independente (Python).
# Uso: scripts/tiss/validar.sh <pasta-com-xml> [versao-xsd, padrão 4.03.00]
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
PASTA="$1"; VER="${2:-4.03.00}"
XSD="$DIR/xsd/$VER/tissV${VER//./_}.xsd"
falhas=0
for f in "$PASTA"/*.XML "$PASTA"/*.xml; do
  [ -e "$f" ] || continue
  if xmllint --noout --schema "$XSD" "$f" 2>/tmp/xsd_err.txt; then echo "XSD ok: $(basename "$f")"; else echo "XSD FALHOU: $(basename "$f")"; cat /tmp/xsd_err.txt; falhas=1; fi
  python3 -I "$DIR/conferir_hash.py" "$f" || falhas=1
done
exit $falhas
