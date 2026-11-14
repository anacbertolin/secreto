# Site da clínica (cópia de consumedolhos.com.br)

Cópia fiel do site atual (WordPress na Hostinger), transformada em site estático.
Ela roda no Railway, no serviço **site**.

- `public/`: o site pronto, servido como está.
- `Caddyfile` e `Dockerfile`: o servidor que entrega o site.
- `extra/site-copia.js`: substitui o que dependia do WordPress:
  - **busca** → página `/busca/` (procura em `/busca/indice.json`);
  - **comentários do blog** e **formulário de contato** → gravados no Supabase,
    na tabela `public.site_mensagens`. O visitante só consegue enviar; ler é só pelo painel do Supabase.
- `ferramentas/preparar_copia.py`: refaz `public/` a partir de um novo download do site original.

## Como refazer a cópia (se o site original mudar antes da troca)
1. Baixar o site com `wget` (lista de páginas em `ferramentas/entrada/urls.txt`).
2. `python3 ferramentas/preparar_copia.py <download>/consumedolhos.com.br ferramentas/entrada public`
