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

## Nova marca (Hospital de Olhos da Baixada)
- Logo e ícones ficam em `public/marca/` (os originais estão em `/marca/arquivos` na raiz do projeto).
- `ferramentas/trocar_marca.py` troca "Consumed" pelo nome novo em todas as páginas.
  Se refizer a cópia do site, rode de novo: `python3 ferramentas/trocar_marca.py public`.
- Continuam com o nome antigo de propósito (só mudam quando forem trocados fora do site):
  o endereço consumedolhos.com.br, o Instagram/Facebook e a busca do mapa do Google.

## Imagens mais leves
- `ferramentas/otimizar_imagens.py public` reduz fotos grandes (máx. 1920 px), recomprime e cria
  uma versão WebP ao lado de cada imagem (`foto.jpg.webp`). O `Caddyfile` entrega o WebP a quem aceita;
  os endereços nas páginas não mudam.

## Ordem para refazer o site do zero
1. `python3 ferramentas/preparar_copia.py <download>/consumedolhos.com.br ferramentas/entrada public`
2. `python3 ferramentas/trocar_marca.py public`
3. `python3 ferramentas/corrigir_defeitos.py public`  (rascunhos, código quebrado, carrossel, sitemap)
4. `python3 ferramentas/otimizar_imagens.py public`
