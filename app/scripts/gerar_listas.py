#!/usr/bin/env python3
"""
Gera as listas de apoio do sistema (dados públicos, sem dados de pacientes):
  public/dados/cid10.json         ← CID-10 oficial do DATASUS (categorias e subcategorias)
  public/dados/medicamentos.json  ← medicamentos com registro ATIVO na ANVISA (dados abertos)

Fontes:
  http://www2.datasus.gov.br/cid10/V2008/downloads/CID10CSV.zip
  https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv

Uso:  python3 scripts/gerar_listas.py <pasta_com_os_arquivos_baixados>
      (a pasta deve ter CID-10-CATEGORIAS.CSV, CID-10-SUBCATEGORIAS.CSV e DADOS_ABERTOS_MEDICAMENTOS.csv)
"""
import csv, json, os, sys

pasta = sys.argv[1]
saida = os.path.join(os.path.dirname(__file__), "..", "public", "dados")
os.makedirs(saida, exist_ok=True)

def ler(nome):
    with open(os.path.join(pasta, nome), encoding="latin-1", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))

# ---------- CID-10: subcategorias (A00.0) + categorias sem subdivisão (H46) ----------
subs = ler("CID-10-SUBCATEGORIAS.CSV")
cats = ler("CID-10-CATEGORIAS.CSV")
com_sub = {s["SUBCAT"][:3] for s in subs}
cid = []
for c in cats:
    if c["CAT"] not in com_sub:
        cid.append([c["CAT"], c["DESCRICAO"].strip()])
for s in subs:
    cod = s["SUBCAT"].strip()
    # categorias sem subdivisão (ex.: H46) vêm com 3 caracteres: não levam ponto
    cid.append([f"{cod[:3]}.{cod[3:]}" if len(cod) > 3 else cod, s["DESCRICAO"].strip()])
cid.sort(key=lambda x: x[0])
with open(os.path.join(saida, "cid10.json"), "w", encoding="utf-8") as f:
    json.dump(cid, f, ensure_ascii=False, separators=(",", ":"))
print("CID-10:", len(cid), "códigos")

# ---------- Medicamentos: registro ativo, único por nome + princípio ativo ----------
with open(os.path.join(pasta, "DADOS_ABERTOS_MEDICAMENTOS.csv"), encoding="latin-1", newline="") as f:
    meds = list(csv.DictReader(f, delimiter=";"))
OFT = ("OFTAL", "GLAUCOM", "MIDRIA", "MIOTIC", "PROSTAGLANDIN")  # prostaglandinas: latanoprosta, bimatoprosta…
vistos = {}
for m in meds:
    if m["SITUACAO_REGISTRO"].strip() != "Ativo":
        continue
    nome = " ".join(m["NOME_PRODUTO"].split()).upper()
    princ = " ".join(m["PRINCIPIO_ATIVO"].split()).lower()
    if not nome:
        continue
    chave = (nome, princ)
    if chave in vistos:
        continue
    classe = " ".join(m["CLASSE_TERAPEUTICA"].split()).upper()
    vistos[chave] = [nome, princ, classe, 1 if any(o in classe for o in OFT) else 0]
lista = sorted(vistos.values(), key=lambda x: (-x[3], x[0]))
with open(os.path.join(saida, "medicamentos.json"), "w", encoding="utf-8") as f:
    json.dump(lista, f, ensure_ascii=False, separators=(",", ":"))
print("Medicamentos:", len(lista), "(oftálmicos:", sum(x[3] for x in lista), ")")
