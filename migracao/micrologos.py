#!/usr/bin/env python3
"""
Ferramenta de migração Micrologos -> Supabase (projeto "secreto").

Comandos
  inspecionar <pasta>            Lê os arquivos exportados e gera um relatório SEM dados pessoais
                                 (só nomes de colunas, contagens e "formatos" mascarados).
  baixar <pasta>                 Baixa os arquivos que a dona colocou no Storage do Supabase
                                 (bucket privado "migracao-micrologos").
  carregar <pasta> [--amostra N] Envia cada planilha/CSV, crua, para o schema privado
                                 legacy_micrologos (tabelas bruto_*), em lotes.
  gerar-sql <pasta> <saida>      Plano B: gera arquivos .sql com os mesmos lotes, para carga
                                 pelo conector do Supabase caso a API esteja indisponível.

Regras
  - Os arquivos de dados NUNCA vão para o git (ver migracao/.gitignore). Guarde-os fora do repositório.
  - A chave do Supabase não fica no código: a rede da sessão injeta o cabeçalho "apikey".
    (Se rodar em outro lugar, defina SUPABASE_SECRET_KEY.)
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from collections import Counter
from pathlib import Path

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://ogflxjolbwrzayjtxvhj.supabase.co")
BUCKET = "migracao-micrologos"
csv.field_size_limit(sys.maxsize)

TABULARES = {".csv", ".txt", ".tsv", ".xlsx", ".xlsm", ".xls"}
BANCOS = {
    ".bak": "Backup do SQL Server (precisa restaurar num SQL Server temporário)",
    ".mdf": "Arquivo de dados do SQL Server",
    ".fdb": "Banco Firebird",
    ".gdb": "Banco Firebird/InterBase",
    ".mdb": "Banco Access",
    ".accdb": "Banco Access",
    ".dump": "Dump do PostgreSQL",
    ".backup": "Backup (provavelmente PostgreSQL)",
    ".db": "Banco SQLite ou outro",
    ".sqlite": "Banco SQLite",
}
DOCUMENTOS = {".pdf", ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".dcm", ".doc", ".docx", ".rtf", ".html", ".htm"}


# ---------------------------------------------------------------- utilidades
def slug(nome: str, limite: int = 50) -> str:
    s = unicodedata.normalize("NFKD", str(nome)).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")
    if not s:
        s = "col"
    if s[0].isdigit():
        s = "c_" + s
    return s[:limite]


def colunas_unicas(nomes: list[str]) -> list[str]:
    vistos: Counter = Counter()
    saida = []
    for i, n in enumerate(nomes):
        base = slug(n or f"coluna_{i + 1}", 55)
        if base in ("_carga_id", "_linha"):
            base = "orig" + base
        vistos[base] += 1
        saida.append(base if vistos[base] == 1 else f"{base}_{vistos[base]}")
    return saida


def sha256(caminho: Path) -> str:
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def detectar_codificacao(caminho: Path) -> str:
    """UTF-8 se o arquivo inteiro for UTF-8 válido; senão Windows-1252 (padrão de sistemas antigos)."""
    with open(caminho, "rb") as f:
        dados = f.read()
    if dados.startswith(b"\xef\xbb\xbf"):
        return "utf-8-sig"
    try:
        dados.decode("utf-8")
        return "utf-8"
    except UnicodeDecodeError:
        return "cp1252"


def detectar_separador(amostra: str) -> str:
    linhas = [l for l in amostra.splitlines()[:50] if l.strip()]
    melhor, melhor_nota = ";", -1
    for sep in [";", ",", "\t", "|"]:
        contagens = [l.count(sep) for l in linhas]
        if not contagens or max(contagens) == 0:
            continue
        mais_comum, freq = Counter(contagens).most_common(1)[0]
        nota = freq * 10 + mais_comum
        if mais_comum > 0 and nota > melhor_nota:
            melhor, melhor_nota = sep, nota
    return melhor


def mascarar(valor: str) -> str:
    """Formato do valor sem o conteúdo: dígito->9, letra->A. Ex.: '123.456.789-09' -> '999.999.999-99'."""
    v = valor.strip()
    if len(v) > 24:
        return f"<texto {len(v)} caracteres>"
    v = re.sub(r"\d", "9", v)
    v = re.sub(r"[^\W\d_]", "A", v)
    v = re.sub(r"A{4,}", "AAA…", v)
    return v


# ---------------------------------------------------------------- leitura
def ler_tabelas(caminho: Path):
    """Gera (nome_tabela, colunas_originais, iterador_de_linhas) para cada tabela do arquivo."""
    ext = caminho.suffix.lower()
    if ext in (".csv", ".txt", ".tsv"):
        cod = detectar_codificacao(caminho)
        with open(caminho, encoding=cod, newline="") as f:
            amostra = f.read(200_000)
        sep = "\t" if ext == ".tsv" else detectar_separador(amostra)

        def linhas():
            with open(caminho, encoding=cod, newline="") as f:
                leitor = csv.reader(f, delimiter=sep)
                next(leitor, None)
                for linha in leitor:
                    if any(c.strip() for c in linha):
                        yield linha

        with open(caminho, encoding=cod, newline="") as f:
            cabecalho = next(csv.reader(f, delimiter=sep), [])
        yield caminho.stem, cabecalho, linhas, {"codificacao": cod, "separador": repr(sep)}
    elif ext in (".xlsx", ".xlsm"):
        import openpyxl

        wb = openpyxl.load_workbook(caminho, read_only=True, data_only=True)
        for ws in wb.worksheets:
            it = ws.iter_rows(values_only=True)
            cab = next(it, None)
            if not cab:
                continue
            cabecalho = ["" if c is None else str(c) for c in cab]
            nome = caminho.stem if len(wb.worksheets) == 1 else f"{caminho.stem}_{ws.title}"

            def linhas(ws=ws):
                it2 = ws.iter_rows(values_only=True)
                next(it2, None)
                for row in it2:
                    vals = ["" if c is None else (c.isoformat() if hasattr(c, "isoformat") else str(c)) for c in row]
                    if any(v.strip() for v in vals):
                        yield vals

            yield nome, cabecalho, linhas, {"aba": ws.title}
    elif ext == ".xls":
        import pandas as pd  # precisa do pacote xlrd: pip install xlrd

        for aba, df in pd.read_excel(caminho, sheet_name=None, dtype=str).items():
            df = df.fillna("")
            nome = f"{caminho.stem}_{aba}"
            yield nome, [str(c) for c in df.columns], (lambda df=df: (list(r) for r in df.itertuples(index=False))), {"aba": aba}


def arquivos(pasta: Path):
    for p in sorted(pasta.rglob("*")):
        if p.is_file() and not p.name.startswith((".", "~$")):
            yield p


def extrair_zips(pasta: Path):
    for z in list(pasta.rglob("*.zip")):
        destino = z.with_suffix("")
        if destino.exists():
            continue
        with zipfile.ZipFile(z) as zf:
            for membro in zf.namelist():
                alvo = (destino / membro).resolve()
                if not str(alvo).startswith(str(destino.resolve())):
                    raise SystemExit(f"Arquivo suspeito dentro do zip (caminho fora da pasta): {membro}")
            zf.extractall(destino)
        print(f"  zip extraído: {z.name} -> {destino.name}/")


# ---------------------------------------------------------------- inspecionar
def inspecionar(pasta: Path, saida: Path | None):
    extrair_zips(pasta)
    rel = ["# Inventário da exportação do Micrologos", "",
           "> Relatório sem dados pessoais: só nomes de colunas, contagens e formatos mascarados (9 = dígito, A = letra).", ""]
    resumo = []
    outros: Counter = Counter()
    for arq in arquivos(pasta):
        ext = arq.suffix.lower()
        tam = arq.stat().st_size
        if ext in TABULARES:
            try:
                for nome, cab, linhas, info in ler_tabelas(arq):
                    cols = colunas_unicas(cab)
                    preenchidos = Counter()
                    formatos = {c: Counter() for c in cols}
                    total = 0
                    for linha in linhas():
                        total += 1
                        for c, v in zip(cols, linha):
                            v = str(v)
                            if v.strip():
                                preenchidos[c] += 1
                                if total <= 5000:
                                    formatos[c][mascarar(v)] += 1
                    resumo.append((arq.relative_to(pasta), nome, total, len(cols)))
                    rel += [f"## {arq.relative_to(pasta)} → tabela `bruto_{slug(nome)}`", "",
                            f"- Linhas: **{total}** · Colunas: {len(cols)} · Tamanho: {tam/1e6:.1f} MB · {info}", "",
                            "| Coluna original | Nome no banco | Preenchida | Formatos mais comuns |", "|---|---|---|---|"]
                    for orig, c in zip(cab, cols):
                        pct = 100 * preenchidos[c] / total if total else 0
                        fmts = ", ".join(f"`{f}`" for f, _ in formatos[c].most_common(3))
                        rel.append(f"| {orig} | {c} | {pct:.0f}% | {fmts} |")
                    rel.append("")
            except Exception as e:  # noqa: BLE001
                rel += [f"## {arq.relative_to(pasta)}", "", f"- ⚠️ Não consegui ler: {e}", ""]
        elif ext in BANCOS:
            rel += [f"## {arq.relative_to(pasta)}", "", f"- 🗄️ {BANCOS[ext]} · {tam/1e9:.2f} GB", ""]
        elif ext == ".xml":
            try:
                import xml.etree.ElementTree as ET
                tags = Counter(el.tag.split("}")[-1] for _, el in ET.iterparse(arq))
                rel += [f"## {arq.relative_to(pasta)} (XML)", "", "- Elementos: " + ", ".join(f"{t} ({n})" for t, n in tags.most_common(12)), ""]
            except Exception as e:  # noqa: BLE001
                rel += [f"## {arq.relative_to(pasta)} (XML)", "", f"- ⚠️ {e}", ""]
        elif ext == ".sql":
            cont = Counter()
            with open(arq, encoding=detectar_codificacao(arq), errors="replace") as f:
                for l in f:
                    m = re.match(r"\s*(CREATE TABLE|INSERT INTO)\s+[`\"\[]?([\w.]+)", l, re.I)
                    if m:
                        cont[(m.group(1).upper(), m.group(2))] += 1
            rel += [f"## {arq.relative_to(pasta)} (script SQL, {tam/1e6:.1f} MB)", "",
                    f"- Tabelas criadas: {sum(1 for k in cont if k[0]=='CREATE TABLE')}",
                    "- Mais inserções: " + ", ".join(f"{k[1]} ({n})" for k, n in cont.most_common(15) if k[0] == "INSERT INTO"), ""]
        else:
            outros[ext or "(sem extensão)"] += 1
    if outros:
        rel += ["## Outros arquivos (documentos, imagens, laudos…)", ""] + [f"- `{e}`: {n}" for e, n in outros.most_common()] + [""]
    rel[4:4] = ["## Resumo", "", "| Arquivo | Tabela | Linhas | Colunas |", "|---|---|---|---|"] + \
               [f"| {a} | bruto_{slug(n)} | {t} | {c} |" for a, n, t, c in resumo] + [""]
    texto = "\n".join(rel)
    if saida:
        saida.write_text(texto, encoding="utf-8")
        print(f"Relatório salvo em {saida}")
    else:
        print(texto)


# ---------------------------------------------------------------- API Supabase
def _req(metodo: str, caminho: str, corpo=None, binario=False):
    url = SUPABASE_URL.rstrip("/") + caminho
    dados = None if corpo is None else json.dumps(corpo, ensure_ascii=False).encode()
    req = urllib.request.Request(url, data=dados, method=metodo)
    req.add_header("Content-Type", "application/json")
    chave = os.environ.get("SUPABASE_SECRET_KEY")
    # Dentro da sessão Claude a chave é injetada pela rede; este valor só ocupa o lugar.
    req.add_header("apikey", chave or "injetada-pelo-proxy")
    if chave and chave.startswith("eyJ"):
        req.add_header("Authorization", f"Bearer {chave}")
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            conteudo = r.read()
            return conteudo if binario else (json.loads(conteudo) if conteudo else None)
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Erro {e.code} em {caminho}: {e.read().decode(errors='replace')[:800]}")


def rpc(funcao: str, **params):
    return _req("POST", f"/rest/v1/rpc/{funcao}", params)


def baixar(pasta: Path, prefixo: str = ""):
    pasta.mkdir(parents=True, exist_ok=True)
    pendentes = [prefixo]
    while pendentes:
        pref = pendentes.pop()
        itens = _req("POST", f"/storage/v1/object/list/{BUCKET}", {"prefix": pref, "limit": 1000, "offset": 0})
        for it in itens or []:
            caminho = f"{pref}{it['name']}"
            if it.get("id") is None:  # é uma pasta
                pendentes.append(caminho + "/")
                continue
            destino = pasta / caminho
            destino.parent.mkdir(parents=True, exist_ok=True)
            if destino.exists() and destino.stat().st_size == (it.get("metadata") or {}).get("size"):
                print(f"  já baixado: {caminho}")
                continue
            print(f"  baixando: {caminho}")
            destino.write_bytes(_req("GET", f"/storage/v1/object/{BUCKET}/{urllib.parse.quote(caminho)}", binario=True))


# ---------------------------------------------------------------- carregar
def lotes(cols, linhas, tamanho, limite=None):
    lote, n = [], 0
    for n, linha in enumerate(linhas(), start=1):
        if limite and n > limite:
            n -= 1
            break
        reg = {"_linha": n}
        for c, v in zip(cols, linha):
            v = "" if v is None else str(v)
            reg[c] = v.replace("\x00", "") if v.strip() != "" else None
        lote.append(reg)
        if len(lote) >= tamanho:
            yield lote
            lote = []
    if lote:
        yield lote


def carregar(pasta: Path, amostra: int | None, tamanho_lote: int, so: str | None):
    extrair_zips(pasta)
    for arq in arquivos(pasta):
        if arq.suffix.lower() not in TABULARES:
            continue
        for nome, cab, linhas, _ in ler_tabelas(arq):
            tabela = slug(nome)
            if so and tabela != slug(so):
                continue
            cols = colunas_unicas(cab)
            total = sum(1 for _ in linhas()) if not amostra else None
            carga = rpc("migracao_iniciar_carga", p_arquivo=str(arq.relative_to(pasta)), p_tabela=tabela,
                        p_colunas=cols, p_hash=sha256(arq), p_linhas_esperadas=total)
            print(f"→ {arq.name} → bruto_{tabela} (carga {carga}, {total if total is not None else 'amostra'} linhas)")
            enviados = 0
            for lote in lotes(cols, linhas, tamanho_lote, amostra):
                enviados += rpc("migracao_carregar_lote", p_tabela=tabela, p_carga_id=carga, p_linhas=lote) or 0
                print(f"   {enviados} linhas", end="\r")
            status = "concluida" if (amostra or enviados == total) else "falhou"
            fim = rpc("migracao_concluir_carga", p_carga_id=carga, p_status=status,
                      p_observacoes=f"amostra de {amostra}" if amostra else None)
            print(f"   {enviados} linhas carregadas · status: {fim['status']}")


def gerar_sql(pasta: Path, saida: Path, tamanho_lote: int, amostra: int | None):
    """Plano B: arquivos .sql (um por lote) que chamam as mesmas funções de carga."""
    extrair_zips(pasta)
    saida.mkdir(parents=True, exist_ok=True)
    seq = 0
    for arq in arquivos(pasta):
        if arq.suffix.lower() not in TABULARES:
            continue
        for nome, cab, linhas, _ in ler_tabelas(arq):
            tabela = slug(nome)
            cols = colunas_unicas(cab)
            seq += 1
            arr = "array[" + ",".join("'" + c + "'" for c in cols) + "]::text[]"
            rel_sql = str(arq.relative_to(pasta)).replace("'", "''")
            var = f"(select max(id) from legacy_micrologos.cargas where arquivo = '{rel_sql}')"
            (saida / f"{seq:03d}_{tabela}_000_inicio.sql").write_text(
                f"select public.migracao_iniciar_carga('{rel_sql}', '{tabela}', {arr}, '{sha256(arq)}', null);\n")
            for i, lote in enumerate(lotes(cols, linhas, tamanho_lote, amostra), start=1):
                js = json.dumps(lote, ensure_ascii=False).replace("$migr$", "")
                (saida / f"{seq:03d}_{tabela}_{i:03d}.sql").write_text(
                    f"select public.migracao_carregar_lote('{tabela}', {var}, $migr${js}$migr$::jsonb);\n", encoding="utf-8")
            (saida / f"{seq:03d}_{tabela}_999_fim.sql").write_text(f"select public.migracao_concluir_carga({var});\n")
    print(f"Arquivos SQL em {saida}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("inspecionar"); p.add_argument("pasta", type=Path); p.add_argument("--saida", type=Path)
    p = sub.add_parser("baixar"); p.add_argument("pasta", type=Path); p.add_argument("--prefixo", default="")
    p = sub.add_parser("carregar"); p.add_argument("pasta", type=Path)
    p.add_argument("--amostra", type=int); p.add_argument("--lote", type=int, default=2000); p.add_argument("--so")
    p = sub.add_parser("gerar-sql"); p.add_argument("pasta", type=Path); p.add_argument("saida", type=Path)
    p.add_argument("--lote", type=int, default=500); p.add_argument("--amostra", type=int)
    a = ap.parse_args()
    if a.cmd == "inspecionar":
        inspecionar(a.pasta, a.saida)
    elif a.cmd == "baixar":
        baixar(a.pasta, a.prefixo)
    elif a.cmd == "carregar":
        carregar(a.pasta, a.amostra, a.lote, a.so)
    else:
        gerar_sql(a.pasta, a.saida, a.lote, a.amostra)


if __name__ == "__main__":
    main()
