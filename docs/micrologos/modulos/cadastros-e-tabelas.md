# Cadastros e tabelas de apoio

Lista completa, com códigos de permissão, em [../anexos/menus.md](../anexos/menus.md). Legenda: 🌐 tem tela web · 🖥️ só no desktop.

## Cadastros principais (Clinic)
| Cadastro | Web | Recurso API | Observações |
|---|---|---|---|
| Unidades | 🌐 | `unidades` | Estabelecimentos e filiais |
| Pacientes | 🌐 | `pacientes` | Ver [PEP](clinic-pacientes-pep-laudos.md) |
| Staff médico | 🌐 | `staffMedicos` | Médicos e profissionais: horários, especialidades, modelos de laudo, imagem de assinatura, categorias |
| Convênios / planos de saúde | 🌐 | `convenios` | Convênio "mestre" → planos; tabelas de preço; informações adicionais; logo |
| Procedimentos | 🌐 | `servicos`/`produtos` 🔶 | Procedimentos médicos faturáveis |
| Produtos | 🌐 | `produtos` | Mat/med e itens de estoque |
| Serviços | 🌐 | `servicos` | |
| Contatos externos | 🌐 | `contatosExternos` | Médicos solicitantes externos, parceiros |

## Tabelas · Atendimento
Categorias de locais de atendimento 🌐 · Locais de atendimento 🌐 · Protocolos de tratamento 🖥️ · Sessões (aparelhos, lados, regiões) 🖥️ · Status dos locais 🖥️ · Equipes médicas 🖥️ · Especialidades 🌐 · IBGE localidade 🖥️ · Representantes 🖥️ · Motivos (ausência, cancelamento, desistência, emergência, bloqueio) 🌐 · CID-10 🖥️ · Medicamentos personalizados, posologias e substitutos 🌐 · Categorias de modelos de texto do PEP 🌐 · Modelos de texto do PEP 🌐 · Modelos de e-mail · Fichas de dados (grupo de limites, limites, campos, arquétipos) 🌐/🖥️ · Feriados 🌐 · Profissões 🌐

## Tabelas · Faturamento
Centros de responsabilidade 🌐 · Tipos de pendência 🌐 · Tipos de glosa 🌐 · Turnos 🌐 · Taxas de turno 🌐 · Classificação de guias 🌐 · Classificação de atendimentos 🌐 · Configuração de faturamento automático 🖥️ · Layouts de convênios 🖥️

## Tabelas · Comissionamento
Categorias do staff médico 🌐 · Donos de equipamentos 🖥️ · Tipos de comissão 🖥️

## Tabelas · Produtos e serviços
Categorias 🌐 · Unidades 🌐 · Marcas 🌐 · Tempo de duração do atendimento 🖥️ · Brasíndice 🖥️ · **Tabelas de preço** 🌐

## Tabelas · Prescrição e laudo
Formas de aplicação 🖥️ · Intervalos de aplicação 🖥️ · Títulos de laudo 🖥️ · Frases de laudo 🖥️

## Tabelas · Pacientes
Empresas · Portadores · Profissões 🌐 · CEP · Acompanhantes · Tipos de ocorrência 🌐

## Cash
Emitentes · Categorias de emitentes · Empresas · Portadores · Planos financeiros · Projetos · Contas recorrentes · Produtos · Naturezas de operação · Tipos de multa · Moedas e índices · Centros de responsabilidade · Feriados (todos 🌐)

## Configurações
- `/configuracoes`: configurações gerais por sistema (PEP, agenda, pagamento particular, fonte e tela de atendimento, IA etc.).
- Perfis de usuário, usuários e convites, centro de responsabilidade do usuário.
- Mensagens e canais (Bot).
