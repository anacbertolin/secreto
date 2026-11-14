# Micrologos: base de conhecimento do sistema legado

O **Micrologos** é o sistema que usamos hoje e que vamos substituir. Esta pasta junta tudo o que
sabemos sobre ele, para servir de referência durante o desenvolvimento e a **importação dos dados**.

> **Situação do conhecimento (14/11/2026):** levantamento feito só com fontes públicas, sem login.
> Partes como regras de negócio, campos dos cadastros e banco de dados ainda precisam ser
> confirmadas com acesso de usuário e com a exportação de dados.
> Convenção usada nos arquivos: ✅ confirmado na fonte · 🔶 inferido · ❓ a confirmar.

## Resumo em 30 segundos
- Empresa do Rio de Janeiro, fundada em 1983, pequena (de 2 a 10 pessoas), com foco em clínicas e hospitais-dia (forte em oftalmologia).
- Sistema **híbrido**: aplicação web *Clinic by Micrologos* + cliente Windows legado *Clinic Master SP* (`MLClmAdv.exe`).
- **5 módulos:** Clinic (assistencial e faturamento), Cash (financeiro), Talklogos/Bot (comunicação e IA), Analytics (BI) e Quality (CRM interno).
- **Serviços próprios integrados:** Paylogos (pagamentos), Doclogos (laudos), Chatlogos (chat interno), Authlogos (login único) e Portal do Paciente.
- Tamanho: cerca de **220 telas web**, cerca de **790 operações de API** e cerca de **106 entidades** identificadas.

## Mapa da documentação

| Arquivo | Para que serve |
|---|---|
| [01-visao-geral.md](01-visao-geral.md) | Empresa, família de produtos e modelo comercial |
| [02-arquitetura-tecnica.md](02-arquitetura-tecnica.md) | Tecnologias, padrão da API, hosts, autenticação, permissões, desktop × web |
| **Módulos (funcionalidades)** | |
| [modulos/clinic-agenda-recepcao.md](modulos/clinic-agenda-recepcao.md) | Agenda, regras de marcação, status, recepção, totem, TV, retorno, teleatendimento |
| [modulos/clinic-pacientes-pep-laudos.md](modulos/clinic-pacientes-pep-laudos.md) | Cadastro de paciente, LGPD, prontuário (PEP), prescrição, assinatura digital, laudos e imagens |
| [modulos/clinic-faturamento-repasse.md](modulos/clinic-faturamento-repasse.md) | Contas de paciente, guias TISS e SUS, cobrança de convênio, glosas, DMED, repasse médico |
| [modulos/clinic-internacao-estoque.md](modulos/clinic-internacao-estoque.md) | Centro cirúrgico, internação, prescrição de internados, estoque e compras |
| [modulos/cash-financeiro-paylogos.md](modulos/cash-financeiro-paylogos.md) | Financeiro, notas fiscais e Paylogos |
| [modulos/talklogos-analytics-quality.md](modulos/talklogos-analytics-quality.md) | Omnichannel, bot e IA, campanhas, BI e módulo Quality |
| [modulos/cadastros-e-tabelas.md](modulos/cadastros-e-tabelas.md) | Todos os cadastros e tabelas de apoio |
| **Dados e migração** | |
| [03-modelo-de-dados.md](03-modelo-de-dados.md) | Entidades identificadas, relacionamentos e campos conhecidos |
| [04-migracao-de-dados.md](04-migracao-de-dados.md) | **Plano de importação:** ordem de carga, fontes, validações, checklist |
| [05-riscos-e-pendencias.md](05-riscos-e-pendencias.md) | Riscos da substituição e perguntas em aberto |
| [glossario.md](glossario.md) | Termos do domínio (TISS, SADT, glosa, repasse, portador, emitente…) |
| [fontes.md](fontes.md) | Origem de cada informação |
| [anexos/](anexos/README.md) | Inventários brutos: menus, rotas, endpoints, campos, textos da interface |

## Como usar e manter
- **Para achar uma funcionalidade:** procure em `modulos/` e confirme no inventário bruto (`anexos/menus.md` ou `anexos/endpoints-api.txt`).
- **Para mapear dados na importação:** comece em `03-modelo-de-dados.md` e siga a ordem de `04-migracao-de-dados.md`.
- **Quando confirmar algo novo** (tela vista, exportação recebida, regra explicada pela equipe): atualize o arquivo do tema, troque ❓ por ✅ e, se for uma decisão, registre em `05-riscos-e-pendencias.md`.
