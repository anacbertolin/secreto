#!/usr/bin/env python3
"""
Copia as tabelas do banco Firebird do Micrologos para o schema legacy_micrologos de um Postgres
(o banco de ENSAIO local, ou o Supabase quando houver canal direto), como tabelas brutas
bruto_<tabela> (todas as colunas em texto, como manda a migração 0100).

Uso (exemplo do ensaio local):
  LD_LIBRARY_PATH=<pasta com libfbclient> python3 migracao/firebird/copiar_para_postgres.py \
     --fb 172.17.0.2:/dados/MLMASTER.FDB --fb-senha ... --pg "postgresql://postgres:...@172.17.0.3/secreto" \
     [--so PACIENTES,AGENDA] [--pular PACIENTES_LOG,LOG] [--arquivo MLMASTER.FDB]

- Lê em WIN1252 (o charset do banco) e grava UTF-8.
- BLOB de texto (sub_type 1) vira texto. BLOB binário (fotos, imagens) NÃO é copiado aqui: a coluna fica
  com o tamanho em bytes ("<binario N bytes>"); imagens serão tratadas à parte.
- Reexecutável: cada execução cria uma nova carga (legacy_micrologos.cargas) e recria a tabela bruta.
- Não imprime dados, só nomes de tabelas e contagens.
"""
import argparse
import datetime
import decimal
import io
import sys

import encodings.cp1252 as _cp1252

import psycopg
from firebird.driver import connect, driver_config

# O banco tem alguns bytes que não existem no WIN1252 (0x81, 0x8D, 0x8F, 0x90, 0x9D): ficam como o caractere
# Latin-1 equivalente, em vez de interromper a cópia.
_cp1252.decoding_table = "".join(chr(i) if c == "\ufffe" else c for i, c in enumerate(_cp1252.decoding_table))

LOTE = 5000

# Colunas que NUNCA são copiadas (senhas, tokens, dados bancários). Ficam como NULL na tabela bruta.
COLUNAS_SECRETAS = {
    ("CONVENIOS_INFO", "LOGIN"), ("CONVENIOS_INFO", "SENHA"), ("CONVENIOS_MESTRE", "AUTORIZADOR_SENHA"),
    ("CONVENIOS_MESTRE", "AUTORIZADOR_HTML"), ("UNIDADES", "TES_LOGIN"), ("UNIDADES", "TES_SENHA"),
    ("MEDICOS", "ZOOP_TOKEN_ID"), ("MEDICOS", "ZOOP_MED_BANK_ACCOUNT_NUMBER"), ("MEDICOS", "ZOOP_MED_ROUTING_NUMBER"),
    ("MEDICOS", "ZOOP_MED_BANK_CODE"), ("MEDICOS", "ZOOP_MED_TAXPAYER_ID"), ("MEDICOS", "ZOOP_SELLER_ID"),
}
PADROES_SECRETOS = ("SENHA", "PASSWORD", "TOKEN", "SECRET")


def texto(v):
    if v is None:
        return None
    if isinstance(v, (bytes, bytearray, memoryview)):
        return f"<binario {len(v)} bytes>"
    if isinstance(v, datetime.datetime):
        return v.isoformat(sep=" ")
    if isinstance(v, (datetime.date, datetime.time)):
        return v.isoformat()
    if isinstance(v, float):
        return repr(int(v)) if v.is_integer() and abs(v) < 1e15 else repr(v)
    if isinstance(v, decimal.Decimal):
        return format(v, "f")
    s = str(v)
    return s.replace("\x00", "")


def copy_escape(v):
    if v is None:
        return r"\N"
    return v.replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n").replace("\r", "\\r")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fb", required=True)
    ap.add_argument("--fb-usuario", default="SYSDBA")
    ap.add_argument("--fb-senha", required=True)
    ap.add_argument("--fb-lib", default="libfbclient.so")
    ap.add_argument("--pg", required=True)
    ap.add_argument("--so", default="")
    ap.add_argument("--pular", default="")
    ap.add_argument("--arquivo", default="MLMASTER.FDB")
    ap.add_argument("--prefixo", default="", help="prefixo no nome da tabela bruta (ex.: sec_ para SECURITY.FDB)")
    a = ap.parse_args()

    driver_config.fb_client_library.value = a.fb_lib
    fb = connect(a.fb, user=a.fb_usuario, password=a.fb_senha, charset="WIN1252")
    cur = fb.cursor()
    cur.execute("select trim(rdb$relation_name) from rdb$relations "
                "where coalesce(rdb$system_flag,0)=0 and rdb$view_blr is null order by 1")
    tabelas = [r[0] for r in cur.fetchall()]
    so = {t.strip().upper() for t in a.so.split(",") if t.strip()}
    pular = {t.strip().upper() for t in a.pular.split(",") if t.strip()}
    if so:
        tabelas = [t for t in tabelas if t in so]
    tabelas = [t for t in tabelas if t not in pular]

    with psycopg.connect(a.pg, autocommit=False) as pg:
        for t in tabelas:
            cur.execute(f'select count(*) from "{t}"')
            total = cur.fetchone()[0]
            if total == 0:
                continue
            cur.execute("select trim(rf.rdb$field_name) from rdb$relation_fields rf "
                        "where rf.rdb$relation_name = ? order by rf.rdb$field_position", (t,))
            cols_fb = [r[0] for r in cur.fetchall()]
            cols = [c.lower() for c in cols_fb]
            nome = a.prefixo + t.lower()
            with pg.cursor() as p:
                p.execute("select public.migracao_iniciar_carga(%s, %s, %s, null, %s)",
                          (f"{a.arquivo}:{t}", nome, cols, total))
                carga = p.fetchone()[0]
                p.execute(f'delete from legacy_micrologos."bruto_{nome}" where _carga_id <> %s', (carga,))
                sel = ", ".join("null" if ((t, c) in COLUNAS_SECRETAS or any(x in c for x in PADROES_SECRETOS)) else f'"{c}"'
                                for c in cols_fb)
                cur.execute(f'select {sel} from "{t}"')
                n = 0
                colunas_pg = ", ".join(["_carga_id", "_linha"] + [f'"{c}"' for c in cols])
                with p.copy(f'copy legacy_micrologos."bruto_{nome}" ({colunas_pg}) from stdin') as cp:
                    while True:
                        linhas = cur.fetchmany(LOTE)
                        if not linhas:
                            break
                        buf = io.StringIO()
                        for r in linhas:
                            n += 1
                            buf.write("\t".join([str(carga), str(n)] + [copy_escape(texto(v)) for v in r]) + "\n")
                        cp.write(buf.getvalue())
                p.execute("update legacy_micrologos.cargas set linhas_carregadas = %s, status = %s, concluido_em = now() "
                          "where id = %s", (n, "concluida" if n == total else "falhou", carga))
            pg.commit()
            print(f"{t:40s} {n:>9} de {total:>9}", flush=True)
    fb.close()


if __name__ == "__main__":
    sys.exit(main())
