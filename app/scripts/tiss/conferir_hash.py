"""Confere o hash do epílogo de um XML TISS com um cálculo independente.

Regra: MD5 da concatenação do texto de todos os elementos (sem as tags), na ordem do
documento, exceto o próprio epílogo, codificado em ISO-8859-1.
Serve também para XML reais do Micrologos: se bater, a regra está certa.
Uso: python3 conferir_hash.py arquivo.xml [--mostrar-texto]
"""
import hashlib
import sys
import xml.etree.ElementTree as ET


def texto(el, partes):
    nome = el.tag.split('}')[-1]
    if nome == 'epilogo':
        return
    filhos = list(el)
    if not filhos:
        if el.text:
            partes.append(el.text)
    else:
        for f in filhos:
            texto(f, partes)


def main():
    arq = sys.argv[1]
    raiz = ET.parse(arq).getroot()
    partes = []
    texto(raiz, partes)
    conteudo = ''.join(partes)
    calc = hashlib.md5(conteudo.encode('iso-8859-1')).hexdigest()
    hash_el = next((e for e in raiz.iter() if e.tag.split('}')[-1] == 'hash'), None)
    gravado = (hash_el.text or '').strip().lower() if hash_el is not None else ''
    nome = arq.rsplit('/', 1)[-1]
    if calc == gravado:
        print(f'hash ok:  {nome}')
    else:
        # também tenta sem espaços nas pontas e em UTF-8, para descobrir a regra de um XML real
        alt = {
            'utf-8': hashlib.md5(conteudo.encode('utf-8')).hexdigest(),
            'strip': hashlib.md5(''.join(p.strip() for p in partes).encode('iso-8859-1')).hexdigest(),
        }
        achou = [k for k, v in alt.items() if v == gravado]
        print(f'hash DIFERENTE: {nome} (gravado {gravado}, calculado {calc}; variações que batem: {achou or "nenhuma"})')
        sys.exit(1)


if __name__ == '__main__':
    main()
