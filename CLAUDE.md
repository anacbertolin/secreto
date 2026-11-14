# Projeto secreto

Novo sistema de gestão para a clínica, que vai **substituir o Micrologos** (Clinic by Micrologos + Clinic Master SP)
e **importar todos os dados** dele.

## Referência obrigatória: sistema legado
Antes de projetar ou implementar qualquer funcionalidade ou importação, consulte `docs/micrologos/`:
- `docs/micrologos/README.md`: índice e resumo
- `docs/micrologos/modulos/`: o que o legado faz, por área (agenda, PEP, faturamento, financeiro, comunicação, cadastros)
- `docs/micrologos/03-modelo-de-dados.md`: entidades legadas (`ID_*`)
- `docs/micrologos/04-migracao-de-dados.md`: ordem de carga e regras de importação
- `docs/micrologos/05-riscos-e-pendencias.md`: riscos, perguntas em aberto e registro de decisões
- `docs/micrologos/anexos/`: inventários brutos (menus, rotas, endpoints, campos, textos), bons para `grep`

## Convenções
- Documentação e comunicação em **português do Brasil**.
- Ao confirmar algo sobre o legado, atualize o doc do tema (marcadores: ✅ confirmado · 🔶 inferido · ❓ a confirmar).
- Importação: toda entidade migrada guarda `legacy_source` e `legacy_id`; as cargas são idempotentes e passam por uma área de staging.
