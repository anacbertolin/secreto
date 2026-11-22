# Logo — Hospital de Olhos da Baixada

Modificação sutil do logo antigo (Consumed): mesma letra, mesmo azul e o mesmo
"O" em forma de olho com cílios listrados. Só o nome mudou:

- palavra grande: **HOSPITAL** (8 letras, com o olho no lugar do O, igual ao CONSUMED)
- linha de baixo: **DE OLHOS DA BAIXADA** (no lugar de "CLÍNICA DE OLHOS")

## Arquivos (`arquivos/`)
| Arquivo | Para que serve |
|---|---|
| `logo-branco` | sobre fundo azul ou foto escura (topo do site, fachada) |
| `logo-azul` | sobre fundo branco (receitas, atestados, papelaria) |
| `logo-fundo-azul` | logo já com o fundo azul (apresentações, banners) |
| `simbolo-azul` / `simbolo-branco` | só o olho, para espaços pequenos |
| `perfil-redes-sociais` | foto de perfil do WhatsApp, Instagram, Google |
| `favicon`, `favicon-32`, `apple-touch-icon` | ícone da aba do navegador e do celular |

`.svg` é a versão que pode ser aumentada sem perder qualidade (mande esta para gráfica e fachada).
`.png` é para uso no dia a dia (fundo transparente).

- Azul: `#1E3A5C` · Letra: Montserrat Bold (gratuita, Google Fonts)

## Como refazer (técnico)
`ferramenta/` gera tudo de novo. Baixe Montserrat Bold para uma pasta e rode:

    FD=<pasta-da-fonte> python3 ferramenta/build.py ferramenta arquivos
    node ferramenta/png.js arquivos
