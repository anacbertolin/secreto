# 02 · Arquitetura técnica

## Componentes
| Componente | Detalhe | Confiança |
|---|---|---|
| Cliente desktop | *Clinic Master SP Cliente* (`MLClmAdv.exe`), Windows | ✅ |
| Aplicação web | `clinic.micrologos.com.br`: SPA em Vue 3 + Vuex, tema Metronic 8 (Bootstrap 5), FullCalendar, jKanban, jsTree, DataTables, Google Charts, Tempus Dominus. Versão observada **1.26.12** | ✅ |
| API principal | `https://backend.micrologos.com.br/` (testes: `backendtest.`, white-label: `backend.clinicspirit.com`) | ✅ |
| Autenticação | `https://auth.micrologos.com.br/` (Authlogos), com token de sessão no cabeçalho | ✅ |
| Chat / tempo real | `backendchat1..4.micrologos.com.br`, `backendio.micrologos.com.br`, `chat.micrologos.com.br` | ✅ |
| Teleatendimento | Jitsi Meet próprio: `teleatendimento.micrologos.com.br` (token via `atendimentos/access/getJitsiToken`) | ✅ |
| Imagens | PACS **Orthanc** com visualizador OSIMIS (servidor em saveincloud.net.br); upload de DICOM | ✅ |
| Assinatura digital | Certificado ICP-Brasil (A1/A3) no navegador via Fortify (`webcrypto-socket`, PKI.js, asn1). Validação pública de documentos em `/validador` | ✅ |
| Site e portal | `www.micrologos.com.br`: SPA com Cloudflare Turnstile | ✅ |
| Outros serviços | `clm.micrologos.com.br` (❓ provavelmente o Clinic Master legado ou um proxy) | 🔶 |
| BI | Data Warehouse alimentado automaticamente, com conector para Power BI | ✅ (site) |

## Padrão da API
- Todas as chamadas são `POST {backend}/{recurso}/access/{acao}` com corpo JSON. Exemplo: `pacientes/access/salvar`, `agendamentos/access/listarHorariosDisponiveis`.
- Os campos usam MAIÚSCULAS com sublinhado (`ID_PACIENTE`, `ID_AGENDA`, `TIPO_GUIA`). Isso indica um **banco relacional legado**, provavelmente com as mesmas colunas e compartilhado com o desktop 🔶.
- Ações comuns por recurso: `listar`, `listaBox` (combos), `obter`, `obterSimples`, `salvar`, `excluir`.
- Inventário completo em [anexos/endpoints-api.txt](anexos/endpoints-api.txt) (787 operações em 113 recursos).

Os recursos com mais operações mostram onde está a complexidade:

| Recurso | Operações |
|---|---|
| atendimentos (PEP) | 71 |
| agendamentos | 54 |
| contasPaciente | 44 |
| staffMedicos | 28 |
| pacientes | 25 |
| fluxoDeCaixa | 24 |
| guiasTiss | 21 |
| convenios | 16 |

## Multiempresa, multiunidade e multiclínica
- O usuário tem acesso a várias **empresas** (`fluxoDeCaixa/access/empresasUsuario`) e **unidades**. Atendimentos e itens podem ser transferidos entre unidades. ✅
- O Authlogos permite que **um login entre em várias clínicas** (são clientes diferentes da Micrologos). ✅
- `ID_EMITENTE_ML` mostra que cada clínica é um "emitente" (cliente) dentro da própria Micrologos. 🔶

## Segurança e permissões
- Permissões por **códigos hierárquicos**: sistema (`CLM`) → grupo (`CLMCA` = Cadastros) → tela (`CLMCAPA` = Pacientes). A lista completa está em [anexos/menus.md](anexos/menus.md).
- **Perfis de usuário** por sistema (`/perfilUsuario/:SISTEMA/:PERFIL`), perfil "Master", convite de usuários e log de usuários (simples e avançado).
- Auditoria de alterações em campos (`USUARIO`, `MODULO`, `OPERACAO`, `CAMPO`, `CONTEUDO`). ✅

## Desktop × Web
Vários itens de menu **não têm tela web**: na prática, a operação depende do desktop. Lista em
[modulos/clinic-internacao-estoque.md](modulos/clinic-internacao-estoque.md#só-no-desktop) e nos itens sem `[rota]` de
[anexos/menus.md](anexos/menus.md). Há mensagens explícitas na web, como "Revise-o no desktop" e "Esta forma de pagamento
exige uma integração que ainda não está disponível nesta tela da Web".

## Telas públicas (sem login)
| Rota | Função |
|---|---|
| `/pagar/:codigo` | Checkout do Paylogos |
| `/lp/:hash` | Landing page de captação de leads |
| `/validador` | Validação de documento assinado |
| `/display/consultorio` | Painel de chamada no consultório |
| `/totemPaciente` | Totem de autoatendimento |
