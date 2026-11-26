#!/usr/bin/env python3
"""
Envia linhas do banco de ENSAIO LOCAL (já transformado) para o Supabase, pela API REST, usando a função
public.carga_micrologos (migração 0182). A chave secreta NÃO aparece aqui: o proxy do ambiente do Claude coloca o
cabeçalho "apikey" sozinho (segredo de rede salvo pela dona). Não imprime dados, só contagens.

Uso:
  python3 migracao/carga/enviar.py --pg "postgresql://postgres@<ip>/secreto" --tabela public.pacientes \
      [--onde "numero_prontuario < 200000"] [--lote 2000] [--max-bytes 4000000] [--simular] [--limite N]
"""
import argparse
import json
import os
import ssl
import sys
import time
import urllib.request

import psycopg

URL = "https://ogflxjolbwrzayjtxvhj.supabase.co/rest/v1/rpc/carga_micrologos"


def contexto_ssl():
    ca = "/root/.ccr/ca-bundle.crt"
    return ssl.create_default_context(cafile=ca) if os.path.exists(ca) else ssl.create_default_context()


def enviar(ctx, tabela, linhas, simular, tentativas=5):
    corpo = json.dumps({"p_tabela": tabela, "p_linhas": linhas, "p_simular": simular}, ensure_ascii=False, default=str).encode()
    for t in range(tentativas):
        req = urllib.request.Request(URL, data=corpo, method="POST", headers={"Content-Type": "application/json", "Prefer": "return=representation"})
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=300) as r:
                return int(json.loads(r.read() or b"0")), len(corpo)
        except urllib.error.HTTPError as e:
            msg = e.read()[:300].decode(errors="replace")
            if e.code in (500, 502, 503, 504, 520, 522, 524) and t < tentativas - 1:
                time.sleep(5 * (t + 1)); continue
            raise SystemExit(f"Erro {e.code} na tabela {tabela}: {msg}")
        except Exception as e:  # noqa: BLE001 rede
            if t < tentativas - 1:
                time.sleep(5 * (t + 1)); continue
            raise


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pg", required=True)
    ap.add_argument("--tabela", required=True)
    ap.add_argument("--onde", default="true")
    ap.add_argument("--ordem", default="1")
    ap.add_argument("--lote", type=int, default=2000)
    ap.add_argument("--max-bytes", type=int, default=4_000_000)
    ap.add_argument("--limite", type=int, default=0)
    ap.add_argument("--simular", action="store_true")
    a = ap.parse_args()
    schema, nome = a.tabela.split(".")
    ctx = contexto_ssl()
    total = enviados = bytes_tot = 0
    t0 = time.time()
    with psycopg.connect(a.pg) as con, con.cursor(name="ler") as cur:
        cur.itersize = a.lote
        lim = f" limit {a.limite}" if a.limite else ""
        cur.execute(f'select to_jsonb(t) from "{schema}"."{nome}" t where {a.onde} order by {a.ordem}{lim}')
        buf, tam = [], 0
        for (linha,) in cur:
            s = len(json.dumps(linha, default=str))
            if buf and (len(buf) >= a.lote or tam + s > a.max_bytes):
                n, b = enviar(ctx, a.tabela, buf, a.simular); enviados += n; bytes_tot += b; total += len(buf)
                print(f"  {a.tabela}: {total} lidas, {enviados} gravadas{' (simulado)' if a.simular else ''}", flush=True)
                buf, tam = [], 0
            buf.append(linha); tam += s
        if buf:
            n, b = enviar(ctx, a.tabela, buf, a.simular); enviados += n; bytes_tot += b; total += len(buf)
    dt = time.time() - t0
    print(f"{a.tabela}: {total} lidas, {enviados} {'entrariam (simulado)' if a.simular else 'gravadas'} "
          f"em {dt:.0f}s ({bytes_tot/1e6:.1f} MB)", flush=True)


if __name__ == "__main__":
    sys.exit(main())
