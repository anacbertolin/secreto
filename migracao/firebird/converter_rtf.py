#!/usr/bin/env python3
"""
Converte os textos em RTF do Micrologos (texto da consulta ATENDIMENTOS.QP e documentos DIVERSOS.ESPECIAL)
para texto simples, gravando em legacy_micrologos.textos_convertidos (origem, legacy_id, texto).
Texto que já é simples é copiado como está. Não imprime conteúdo, só contagens.

Uso: python3 migracao/firebird/converter_rtf.py --pg "postgresql://..."
"""
import argparse
import io
import re
import sys

import psycopg
from striprtf.striprtf import rtf_to_text

FONTES = [
    ("atendimento", "select btrim(id_atendimento), qp from legacy_micrologos.bruto_atendimentos where qp is not null"),
    ("documento", "select btrim(id_diversos), especial from legacy_micrologos.bruto_diversos where especial is not null"),
]


def limpar(t: str) -> str:
    t = t.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    t = re.sub("[\ud800-\udfff]", "", t)  # pedaços de caractere inválidos vindos do RTF
    t = re.sub(r"[ \t]+\n", "\n", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def converter(v: str) -> str:
    if v.lstrip().startswith("{\\rtf"):
        try:
            return limpar(rtf_to_text(v, errors="ignore"))
        except Exception:  # noqa: BLE001
            return limpar(re.sub(r"\\[a-z]+-?\d* ?|[{}]", "", v))
    return limpar(v)


def esc(v):
    if v is None:
        return r"\N"
    return v.replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n").replace("\r", "\\r")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pg", required=True)
    a = ap.parse_args()
    with psycopg.connect(a.pg) as pg, psycopg.connect(a.pg) as leitura:
        pg.execute("""create table if not exists legacy_micrologos.textos_convertidos (
                        origem text not null, legacy_id text not null, texto text, primary key (origem, legacy_id))""")
        pg.execute("alter table legacy_micrologos.textos_convertidos enable row level security")
        for origem, sql in FONTES:
            pg.execute("delete from legacy_micrologos.textos_convertidos where origem = %s", (origem,))
            n = vazios = 0
            # leitura e gravação em conexões separadas (o COPY ocupa a conexão de gravação)
            with leitura.cursor(name=f"ler_{origem}") as cur, pg.cursor() as w:
                cur.itersize = 5000
                cur.execute(sql)
                with w.copy("copy legacy_micrologos.textos_convertidos (origem, legacy_id, texto) from stdin") as cp:
                    buf = io.StringIO()
                    for lid, v in cur:
                        t = converter(v) or None
                        if t is None:
                            vazios += 1
                        buf.write(f"{origem}\t{esc(lid)}\t{esc(t)}\n")
                        n += 1
                        if n % 5000 == 0:
                            cp.write(buf.getvalue()); buf = io.StringIO()
                    cp.write(buf.getvalue())
            pg.commit()
            print(f"{origem:12s} {n:>8} textos ({vazios} ficaram vazios)", flush=True)


if __name__ == "__main__":
    sys.exit(main())
