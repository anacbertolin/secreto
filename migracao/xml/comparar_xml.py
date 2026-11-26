#!/usr/bin/env python3
"""Compara a ESTRUTURA e os valores de configuração de dois XML TISS (Micrologos × sistema novo), guia a guia.
Dados de paciente (carteirinha, nome, senha, nºs de guia, indicação clínica, observação) NUNCA são impressos:
só aparece "igual"/"diferente". Uso: python3 -I comparar_xml.py micrologos.xml novo.xml [--estrutura]"""
import sys
import xml.etree.ElementTree as ET
from collections import Counter

SENSIVEIS = {"numeroCarteira", "nomeBeneficiario", "senha", "numeroGuiaOperadora", "numeroGuiaPrestador", "guiaSolicInternacao",
             "indicacaoClinica", "observacao", "cpfContratado", "cpf", "numeroCNS", "hash", "dataRegistroTransacao",
             "horaRegistroTransacao", "guiaPrincipal", "nomeProfissional", "nomeProf"}


def local(t):
    return t.split("}")[-1]


def achatar(el, base=""):
    out = []
    for f in el:
        p = f"{base}/{local(f.tag)}"
        if len(f):
            out += achatar(f, p)
        else:
            out.append((p, (f.text or "").strip()))
    return out


def guias(raiz):
    gs = [g for g in raiz.iter() if local(g.tag) in ("guiaSP-SADT", "guiaConsulta", "guiaHonorarios", "guiaResumoInternacao")]
    return gs


def mostra(p, v):
    return "«dado de paciente»" if p.split("/")[-1] in SENSIVEIS else v


def main():
    a, b = ET.parse(sys.argv[1]).getroot(), ET.parse(sys.argv[2]).getroot()
    ca = [x for x in achatar(a) if "/guiasTISS/" not in x[0] and "/epilogo/" not in x[0]]
    cb = [x for x in achatar(b) if "/guiasTISS/" not in x[0] and "/epilogo/" not in x[0]]
    print("== cabeçalho")
    for (pa, va), (pb, vb) in zip(ca, cb):
        if pa != pb or (va != vb and pa.split("/")[-1] not in SENSIVEIS):
            print(f"  MICROLOGOS {pa} = {mostra(pa, va)}\n  NOVO       {pb} = {mostra(pb, vb)}")
    if len(ca) != len(cb):
        print(f"  nº de campos: Micrologos {len(ca)} × novo {len(cb)}")
    ga, gb = guias(a), guias(b)
    print(f"== guias: Micrologos {len(ga)} ({Counter(local(g.tag) for g in ga)}) × novo {len(gb)} ({Counter(local(g.tag) for g in gb)})")
    num = lambda g: next((x.text for x in g.iter() if local(x.tag) == "numeroGuiaPrestador"), None)
    ib = {num(g): g for g in gb}
    dif_campos = Counter()
    exemplos = {}
    sem_par = 0
    for i, g in enumerate(ga):
        h = ib.get(num(g))
        if h is None:
            sem_par += 1
            continue
        fa, fb = achatar(g), achatar(h)
        pa_set = [p for p, _ in fa]
        pb_set = [p for p, _ in fb]
        if pa_set != pb_set:
            for p in sorted(set(pa_set) ^ set(pb_set)):
                k = ("só no Micrologos" if p in pa_set else "só no novo") + ": " + p
                dif_campos[k] += 1
            if Counter(pa_set) != Counter(pb_set):
                pass
        da, db = {}, {}
        for p, v in fa:
            da.setdefault(p, []).append(v)
        for p, v in fb:
            db.setdefault(p, []).append(v)
        for p in da:
            if p in db and da[p] != db[p]:
                k = "valor diferente: " + p
                dif_campos[k] += 1
                if k not in exemplos and p.split("/")[-1] not in SENSIVEIS:
                    exemplos[k] = (da[p][:4], db[p][:4])
    print(f"  guias do Micrologos sem par no novo (pelo nº da guia): {sem_par}")
    for k, n in dif_campos.most_common():
        ex = exemplos.get(k)
        print(f"  [{n:>3} guias] {k}" + (f"  ex.: Micrologos {ex[0]} × novo {ex[1]}" if ex else ""))
    if "--estrutura" in sys.argv and ga:
        print("== estrutura da 1ª guia do Micrologos")
        for p, v in achatar(ga[0]):
            print(f"  {p} = {mostra(p, v)}")


if __name__ == "__main__":
    main()
