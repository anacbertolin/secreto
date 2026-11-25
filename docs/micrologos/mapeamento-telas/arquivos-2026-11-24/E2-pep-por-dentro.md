# E2 – Tela do PEP por dentro (paciente de teste)

Visto em 22/11/2026 com o paciente de teste "Teste Micrologos". Nenhum prontuário real foi aberto. Nada foi incluído, salvo ou finalizado.

## Como a tela é organizada

Janela: "<Paciente>, - Atendimento(s): N (PEP)". O paciente de teste tem 0 atendimentos.

### Menu lateral ("Menu Atendimento")
O menu é dividido em grupos que abrem e fecham.

| Grupo | Itens |
|---|---|
| Paciente | Foto, Saudação |
| Prontuário | Histórico, Atendimentos, CID 10, Medicamento (ver medicamentos do paciente), Tipos de Atendimento, Aval. Fisioterápica |
| Imagens e Textos | Textos, Imagens, Multimídia (Ctrl+A, arquivos do paciente), Laudo com Frase, Prescrição Internação, Sistemas Integrados |
| Resumos | Queixas, Atendimentos, Configurado |
| Atalhos Operacionais | Repetir Atendimentos, Incluir CID 10, Incluir Medicamentos, Incluir Texto, Incluir Texto F6 a F12, Legendas dos Atalhos |

Os "Atalhos Operacionais" gravam informação. Por isso não cliquei neles.

### Cabeçalho do atendimento
- Data
- Staff (médico)
- Local
- Plano
- Idade e data de nascimento, calculadas a partir do cadastro

### Área central
- Abas da ficha clínica. Sem atendimento aberto, aparece só a aba "Queixa", com um campo de texto livre.
- As abas da ficha oftalmológica (as 12 fichas descritas em E-prontuario-pep.md) só aparecem depois de clicar em **Incluir**. Isso cria um atendimento, então não foi feito.

### Painel "Informações TISS" (dentro do PEP)
Neste paciente o painel aparece como <<CONFERIDO>> e todos os campos estão bloqueados.

| Campo | Observação |
|---|---|
| Tipo Saída | lista |
| Tipo de Atendimento | lista |
| Indicação Clínica | até 500 caracteres |
| Observação | até 500 caracteres |
| Indicador de Acidente | lista |
| Tempo Doença | número + Dias/Meses/Anos/Nenhum |
| Tipo de doença | Aguda/Crônica/Nenhuma |
| Laudos Méd. Especiais | caixa de marcar |
| Laudo Prorrogação | caixa de marcar |

**Importante para o novo sistema:** o médico já preenche dados da guia TISS (indicação clínica, tipo de atendimento, tempo de doença) dentro do prontuário. O novo sistema deve levar esses dados do PEP direto para a guia, sem redigitar. Hoje a indicação clínica é uma das causas comuns de glosa em cirurgias e injeções.

### Botões de baixo
| Botão | Efeito |
|---|---|
| Incluir, Excluir, Ok, Finalizar | Alteram dados (não usados) |
| Canc. | Cancela a edição |
| Listar | Imprimir/listar |
| Chamada, Nova Espera | Chamar paciente no painel ou devolver para a espera |

Barra de status: data/hora e "Visualizando 2012" (ano de referência da visualização).

## Fichas oftalmológicas por dentro

Com autorização da Ana Carolina (22/11/2026), criei UM atendimento no paciente "Teste Micrologos" (cód. atend. 251234) e depois o excluí. Os campos ficaram vazios. Ao final, o paciente voltou a ter 0 atendimentos.

### Como as fichas funcionam
- Dentro do atendimento existe a aba **Tipos de Atendimento**. Ela tem duas listas: "Possíveis" e "Utilizados".
- O médico escolhe quais fichas usar naquela consulta, usando as setas.
- Cada ficha escolhida acrescenta abas ao atendimento.
- Fichas possíveis:
  - 0001 Oftalmologia
  - 0004 Oftalmologia II
  - 0014 Oftalmo III
  - 0003 Anamnese
  - 0011 C.E.S. (Controle de Exames)
  - 0048 Consulta
  - 0049 Ficha de Catarata
  - 0047 Ficha de Retina
  - 0013 Lente de Contato
  - 0018 Óculos
  - 0012 Ortóptica
- Ao incluir, o sistema sugeriu sozinho Local = "Apartamento Cirúrgico" e Tipo Saída = "Alta".
- O rodapé mostra "Incluído por / em", "Atualizado", "Cód.Atend.", "Cód.Ag." (código do agendamento), "Agendado em", "Chegada" e "Atendido em".

### 0001 Oftalmologia → abas Queixa, Exames, Mapeamento, Óculos

**Queixa**
- Texto livre.

**Exames**
- Acuidade visual:
  - AV s/c (sem correção): OD/OE
  - c/at.corr.: OD/OE
  - c/c (com correção): OD/OE
- Ex. Externo, Biomicroscopia, Fundo de Olho: texto livre.
- Tonometria:
  - OD e OE em mmHg, mais a hora.
  - Botão "Tonometria" abre um gráfico com a evolução da pressão.
- Motilidade, Convergência, Reflexos: texto.
- PIO OD, Paquimetria, Fator Correção e PIO Final OD. O fator e a PIO final são calculados automaticamente, pela correção da PIO conforme a paquimetria.

**Mapeamento**
- Mapeamento Dir. e Esq.: texto.
- Dois quadros de desenho (OD/OE).
- Campos "Antes" e "Depois".

**Óculos (receita)**
- Para longe: OD/OE com Esférico, Cilíndrico, Eixo, e D.P. (lista).
- Adição: AO, OD, OE.
- Para perto: OD/OE com Esférico, Cilíndrico, Eixo, D.P. Esses campos são cinza e calculados automaticamente (longe + adição).

### 0049 Ficha de Catarata → aba "Avaliação pré-operatória de catarata"
- Refração: OD/OE com esf, cil, eixo, = (AV), Ad., J.
- Midríase: OD/OE em mm.
- Catarata:
  - Núcleo OD/OE
  - Cortical
  - SCP (subcapsular posterior)
- Reflexo: OD/OE (lista).
- Endotélio: Microscopia OD/OE, Guttata OD/OE (lista).
- SPH: OD/OE.
- Ceratometria: OD/OE, valor a eixo × valor a eixo.
- Biometria:
  - Método: IOL Master / Ultrassônica.
  - OD/OE: lente (lista), Grau, Refração planejada.
- Cirurgia Planejada: texto.
- Incisões relaxantes: OD/OE.
- Observações.

→ Esta ficha alimenta a cirurgia de catarata (escolha da LIO e grau). **O novo sistema deve levar a lente e o grau para a guia/OPME da cirurgia.**

### 0047 Ficha de Retina → abas "Ex. Oftalmológicos" e "+Biomicroscopia"

**Ex. Oftalmológicos**
- Acuidade visual corrigida e refração OD/OE.
- Córnea OD/OE: transparente, precipitado cerático, edema; observações.
- Ângulo OD/OE: rubeosis, iridodiálise, sinéquia periférica; observações.
- Câmara anterior OD/OE, com caixas de marcar:
  - rubeosis íris
  - íris em plateau
  - sinéquia anterior/posterior
  - iridectomia/iridotomia
  - hipópio
  - hifema
  - ar/gás
  - perfluorocarbono líquido
  - óleo de silicone
- Células, Flare, Observação.
- Caixa "Marcador".

**+Biomicroscopia**
- Cristalino OD/OE (lista).
- Pseudo-fácico OD/OE:
  - LIO no saco capsular / sulco ciliar / câmara anterior / descentrada
  - capsulotomia posterior
  - rotura de cápsula posterior
  - opacidade de cápsula posterior
  - "Indicação de capsulotomia posterior? Sim/Não"
- Fácico OD/OE:
  - Catarata (lista)
  - Nuclear
  - Subcapsular posterior/anterior
  - Polar posterior
  - Ectopia
  - Subluxação
  - Obs.

→ É a ficha de retina que acompanha as **injeções intravítreas** (Eylia, Ozurdex). Não há campos próprios de injeção (droga, lote, olho, nº da aplicação). Isso fica em texto ou só no faturamento. **Recomendação para o novo sistema:** criar um registro de aplicação intravítrea com olho, medicamento, lote, nº da dose e senha de autorização. Ele ligaria direto ao pacote Unimed (69911312 / 69911320).

### 0018 Óculos
- Acrescenta uma aba "ÓCULOS" igual à aba Óculos da ficha Oftalmologia.

### Grupos do menu que só aparecem com a janela grande
| Grupo | Itens |
|---|---|
| Ficha Pessoal | Dados Cadastrais, Comentários, Alerta Agenda, Alerta PEP |
| Marcações | Agendar Paciente, Programar Retorno, Indicação de Venda |
| Faturamento | Histórico Procedimentos, Seleciona Procedimentos. O médico pode lançar os procedimentos direto no atendimento, e isso gera a conta. |

## O que ainda não foi visto
- Fichas 0004 Oftalmologia II, 0014 Oftalmo III, 0003 Anamnese, 0011 C.E.S., 0048 Consulta, 0013 Lente de Contato, 0012 Ortóptica.
- Como a receita de óculos e a prescrição são impressas.
- O que "Seleciona Procedimentos" faz exatamente: provavelmente cria a conta. Não cliquei para não gerar faturamento.
