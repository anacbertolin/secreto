#!/usr/bin/env python3
"""
Traz do Supabase (pela API REST, com a chave secreta injetada pelo proxy) as tabelas que a equipe já usa no sistema
novo e as grava no banco de trabalho LOCAL ("carga"), substituindo o que houver lá. Assim as transformações do
Micrologos rodam em cima do estado real do sistema (mesmos ids de convênios, médicos, pacientes da equipe…)
e o envio depois só acrescenta o que falta. Não imprime dados, só contagens.

Uso: python3 migracao/carga/baixar.py --pg "postgresql://postgres:<senha>@<ip>/carga"
"""
import argparse
import json
import os
import ssl
import sys
import urllib.request

import psycopg

BASE = "https://ogflxjolbwrzayjtxvhj.supabase.co/rest/v1/"
# tabela -> coluna de ordenação estável
TABELAS = {
    "profissionais": "id", "profissionais_dados_pessoais": "profissional_id", "profissional_dados_tiss": "profissional_id",
    "convenios": "id", "convenio_planos": "id", "procedimentos": "id", "precos": "id",
    "hospitais": "id", "hospital_convenio_codigos": "id", "profissional_convenio_codigos": "id",
    "pacientes": "id", "agendamentos": "id", "lotes": "id", "contas": "id", "conta_itens": "id",
}


def ctx():
    ca = "/root/.ccr/ca-bundle.crt"
    return ssl.create_default_context(cafile=ca) if os.path.exists(ca) else ssl.create_default_context()


def baixar(c, tabela, ordem, pagina=1000):
    linhas, ini = [], 0
    while True:
        req = urllib.request.Request(f"{BASE}{tabela}?select=*&order={ordem}.asc&limit={pagina}&offset={ini}",
                                     headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, context=c, timeout=120) as r:
            parte = json.loads(r.read())
        linhas += parte
        if len(parte) < pagina:
            return linhas
        ini += pagina


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pg", required=True)
    a = ap.parse_args()
    c = ctx()
    dados = {t: baixar(c, t, o) for t, o in TABELAS.items()}
    with psycopg.connect(a.pg) as con:
        con.execute("set session_replication_role = replica")  # só no ensaio local: sem gatilhos nem checagem de FK
        con.execute("truncate " + ", ".join(f"public.{t}" for t in TABELAS) + " cascade")
        for t, linhas in dados.items():
            if not linhas:
                print(f"{t:32s} 0"); continue
            cols = [r[0] for r in con.execute(
                "select column_name from information_schema.columns where table_schema='public' and table_name=%s "
                "and is_generated='NEVER' order by ordinal_position", (t,)).fetchall() if r[0] in linhas[0]]
            lista = ", ".join(f'"{x}"' for x in cols)
            con.execute(f"insert into public.{t} ({lista}) overriding system value select {lista} "
                        f"from jsonb_populate_recordset(null::public.{t}, %s::jsonb)", (json.dumps(linhas),))
            faltam = sorted(set(linhas[0]) - set(cols))
            print(f"{t:32s} {len(linhas):6d}" + (f"  (colunas que não existem no ensaio: {', '.join(faltam)})" if faltam else ""))
        # sequências como estão no sistema
        for seq, sql in [("public.lotes_numero_seq", "select coalesce(max(numero), 1) from public.lotes"),
                         ("public.pacientes_numero_prontuario_seq", "select greatest(coalesce(max(numero_prontuario), 1), 200000) from public.pacientes")]:
            con.execute(f"select setval('{seq}', ({sql}))")
        con.commit()


if __name__ == "__main__":
    sys.exit(main())
