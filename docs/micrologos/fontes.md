# Fontes

Coletadas em 14/11/2026. Nenhum acesso autenticado foi usado.

## Primárias (da própria Micrologos)
| Fonte | O que forneceu |
|---|---|
| https://clinic.micrologos.com.br/ (bundle `js/app.235de41e.js`, versão 1.26.12) | Rotas, menus, permissões, operações de API, textos da interface, campos, hosts e bibliotecas |
| https://www.micrologos.com.br/ (bundle `assets/index-BcBJeZTA.js`) | Descrição dos produtos, planos e recursos, FAQ, depoimentos, clientes |
| https://www.micrologos.com.br/blog/?p=1167 | Parceria com a Orizon (resultado de busca) |
| https://www.micrologos.com.br/blog/?p=1154 | Integração com a Zeiss e o Doclogos (resultado de busca) |
| Wiki Micrologos: "Emissão Guia APAC", "Brasíndice", "Transação Programada Email" | Existência dessas funções (só os títulos indexados; a wiki hoje não está acessível) |
| https://chat.micrologos.com.br/ | Authlogos: "Uma conta, um mundo de soluções" |

## Secundárias
- Crunchbase: https://www.crunchbase.com/organization/micrologos
- Tracxn: https://tracxn.com/d/companies/micrologos-software-developer/__EteOWSeVRtPrV91miuCS6lxXdxC9o2oMnPaRiLIa9WA
- Facebook: https://www.facebook.com/micrologos/
- LinkedIn: https://br.linkedin.com/company/micrologos-maquinas-e-servicos
- ZoomInfo: https://www.zoominfo.com/c/micrologos-maquinas-e-servicos/557964473
- Reclame Aqui: https://www.reclameaqui.com.br/empresa/micrologos-maquinas-e-servicos-ltda/
- ProcessChecker (`MLClmAdv.exe`): https://processchecker.com/file.php?page=23587

## Como reproduzir a extração
O ambiente de nuvem "secreto" libera os hosts `micrologos.com.br`, `www.`, `clinic.` e `chat.`.
```bash
curl -sS https://clinic.micrologos.com.br/ | grep -oE 'src="/js/app\.[a-f0-9]+\.js"'
```
Depois disso, baixe o `app.*.js` e extraia:
- rotas: `path:"..."`
- endpoints: `"recurso/access/acao"`
- menus: objetos `menuClinic|menuCash|menuBot|menuAnalytics|menuQuality`
- textos: pares `"texto":"texto"` do dicionário de idiomas

Quando a versão mudar, refaça a extração e compare com os anexos para descobrir novidades.
