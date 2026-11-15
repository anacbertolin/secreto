# Anexos: inventários brutos

Extraídos do front-end web do Clinic by Micrologos, versão 1.26.12. Use para buscas (`grep`) e para confirmar detalhes.

| Arquivo | Conteúdo | Linhas |
|---|---|---|
| [menus.md](menus.md) | Árvore de menus dos 5 módulos: título, `[rota web]` (quando existe) e `(código de permissão)`. Itens sem rota = só no desktop | cerca de 360 |
| [rotas-web.tsv](rotas-web.tsv) | Rotas da SPA (`caminho` ⇥ `nome`) | 218 |
| [endpoints-api.txt](endpoints-api.txt) | Operações `recurso/access/acao` chamadas pelo front | 787 |
| [campos-observados.txt](campos-observados.txt) | Nomes de campos em MAIÚSCULAS usados pelo front (base do modelo de dados) | cerca de 395 |
| [textos-interface.txt](textos-interface.txt) | Textos da interface em português (rótulos, mensagens de erro e validação). Ótimo para descobrir regras de negócio | cerca de 2.950 |

Exemplos de busca:
```bash
grep -i glosa docs/micrologos/anexos/textos-interface.txt
```
```bash
grep '^repasse/' docs/micrologos/anexos/endpoints-api.txt
```
