# Talklogos: central de atendimento (como a equipe usa hoje)

Levantamento feito pela dona com o Claude no Chrome, olhando o Talklogos em uso (23/11/2026).
Sem dados de pacientes. Serve de referência para a **Central de atendimento** do sistema novo
(fluxo e organização parecidos, cara própria; nada de copiar código, marca ou textos do Micrologos).

Marcadores: ✅ confirmado pela dona · ❓ ainda a levantar.

## O que manter (funciona bem hoje) ✅
- Reconhecer o paciente pelo telefone e mostrar **nome + nº do prontuário** no topo da conversa.
- Ação **"Associar"**: ligar a conversa a um cadastro quando não reconhece.
- **Agendar consulta direto da conversa** e ver os agendamentos do paciente.
- **Respostas rápidas por comando** (confirmação, valor de consulta, cirurgia de catarata, consulta de córnea,
  retinólogo, orientação de dilatação, agradecimento…).
- **Número de protocolo** por atendimento + histórico completo.
- **Gravação de ligações** com botão "Ouvir" no histórico.
- **Programar mensagem** para envio depois.
- **Chat interno** entre a equipe.
- Ver **o que cada colega está atendendo** agora.
- WhatsApp pela API oficial da Meta. **Instagram e Messenger** também entram na mesma fila.

## Tela da atendente (layout atual, 3 colunas) ✅
1. Menu à esquerda: Conversas, Atendimentos (histórico), Funil, Mais.
2. Coluna do meio: status, busca, equipe (fotos + status), fila, conversas do dia.
3. Direita: conversa aberta, com cabeçalho (contato, paciente vinculado, botões), mensagens e campo de digitar
   (áudio, emoji, programar).

## O que melhorar (problemas de hoje) ✅
- Fila: mostrar o **tempo de espera** de cada paciente (hoje só a hora de chegada).
- Fila: botão **"pegar o próximo"** ou distribuição automática (hoje a atendente escolhe qualquer cartão e o mais
  antigo pode ficar esperando).
- **Filas por setor** (ex.: Orientação Cirúrgica separada; hoje existe uma fila só).
- **Status com pausas e motivo**: Disponível, Pausa, Almoço, Treinamento etc. (hoje só Online / Ausente / Ocupado).
- Ao encerrar, a atendente marca o **resultado** (agendou / não agendou / só informação) e o **motivo**. Hoje não existe.
- **Etiquetas** nas conversas (campanha, origem). Hoje não existem.
- **WhatsApp e telefone na mesma visão** (hoje ficam em abas separadas).
- **Painel de supervisão**: totais do dia, gente esperando, tempo médio de espera e de atendimento, status de cada
  atendente. Mostrar só quem atende.
- Interface **toda em português** (hoje mistura inglês: "Queue Inbound", "Calling").
- **Relatórios da central**: volume por hora, tempo de espera, desistência na fila, produtividade por atendente,
  resultado dos atendimentos.

## Ainda a levantar ❓
- Telefone: tela de ligação tocando, botões (atender, transferir, espera, mudo), transferência entre setores, o que
  acontece ao desligar.
- Menu de voz (URA): opções atuais, horário de atendimento, mensagem fora do horário.
- Dentro de um atendimento de WhatsApp: transferir, devolver para a fila, encerrar.
- O que acontece com as conversas quando a atendente fica "Ausente".

## Comparação com o sistema novo (estado em 23/11/2026)
| Recurso | Sistema novo hoje | Plano |
|---|---|---|
| Reconhecer paciente pelo número, nome + prontuário no topo | ✅ existe (WhatsApp e telefone) | manter |
| Associar conversa a paciente | ✅ existe | manter |
| Ver agendamentos / agendar da conversa | ✅ ficha ao lado mostra; agendar existe na ficha | trazer "Agendar" para dentro da conversa |
| Assumir / soltar conversa | ✅ existe (`responsavel_id`) | vira fila de verdade (pegar o próximo, devolver) |
| Fila com tempo de espera e "pegar o próximo" | ❌ | passo 2 |
| Status com pausas e motivo (vale para WhatsApp e telefone) | ❌ (telefone tem só Disponível/Pausa) | passo 2 |
| Filas por setor (Central × Orientação Cirúrgica) | ✅ setores separados no WhatsApp | manter; acrescentar vários números por fila |
| Etiqueta de origem/campanha (Google Ads) | ❌ | passo 3 |
| Resultado ao encerrar + relatório de conversões | ❌ | passo 4 |
| WhatsApp e telefone na mesma tela | 🔶 telefone flutuante em todas as telas | tela única da atendente |
| Painel de supervisão | ❌ | passo 5 |
| Respostas rápidas por comando | ❌ | passo 6 |
| Protocolo por atendimento + histórico | ❌ (há histórico de mensagens/ligações) | junto do passo 4 (atendimento = protocolo) |
| Programar mensagem | ❌ | depois |
| Chat interno da equipe | ❌ | depois |
| Gravação com "Ouvir" | ❌ (depende da central telefônica) | com a URA/Telecall |
| Instagram / Messenger na mesma fila | ❌ | depois (exige conta da Meta) |
| Interface toda em português | ✅ | manter |

## Telas vistas nas fotos da dona (23/11/2026, 16 fotos da equipe em uso) ✅
Fotos tiradas do Talklogos em uso pelas atendentes (dados de pacientes não registrados aqui). Tema escuro; janela do
aplicativo "Talklogos – Plataforma de Multicanalidade".

### Coluna da esquerda (sempre visível)
- Topo: **status** ("Online" com seta para trocar), cadeado, bandeira, zoom (90 %), **Buscar**.
- Filtro **"Todos Interesses"** e carrossel da **equipe com foto** e bolinha de status, com abas **Todos / Livres /
  Ocupados** e o botão **"Painel Total"**.
- Abas **Interno** (chat da equipe), **Grupos**, **Canais** (com contadores) e **MLPhone** (telefone).
- **Meus Atendimentos (N)**: ícones dos canais (Instagram, Messenger, WhatsApp), filtros **Todos / Não Respondidos**,
  paginação Primeira / Voltar / Avançar / Última. Cada cartão mostra o contato, o **número oficial por onde chegou**
  ("WhatsApp Oficial 21…"), o começo da última mensagem e a etiqueta **"Atendendo"**.
- **Conversas (N)**: todas as conversas.

### Telefone (aba MLPhone, dentro da mesma coluna)
- **Suas Ligações (N)**: cartão da ligação com número, nome do paciente vinculado (ou "Não possui transação
  programada"), hora, botões **Atender** / **Desligar** e **Esperar**, e etiqueta **Chamando** / **Falando**.
- **Ligações Gerais (N)**: ligações da central que estão tocando para os outros.
- Discador "Digite o número para ligar" + botão verde, **volume da chamada** e **Histórico (N)**.
- Ao atender, o centro da tela vira a **tela da ligação**: "Chamada Recebida", iniciais do contato, número, **nome do
  paciente + nº do prontuário**, "Aguardando a ligação ser aceita…", e a barra de botões: **Mudo, Áudio, Teclado,
  Gravar, Espera, Transferir, Adicionar** (conferência), **Agendar Clinic**, **Agendar Talk**, **Associar**, **+ Lead**.
- Equipamento: **fone USB Intelbras** com botão de mudo e volume no fio.

### Conversa aberta (centro)
- Cabeçalho: ícone do canal, nome do contato (número), **"Em conversa desde dd/mm/aaaa hh:mm com <atendente>"**, botão
  vermelho **Encerrar Conversa** e botão azul **Opções** (menu: **Associar, Agendar, Agendamentos, Confirmações
  automáticas, Gerar Lead**). Ícones de vídeo, ligar, convidar participante e informações.
- Linha "Paciente <nome>" logo abaixo (paciente vinculado).
- Mensagens: aviso "A conversa foi iniciada pelo usuário X"; a mensagem da atendente leva o **nome dela** no topo do
  balão. Rodapé com saldo de créditos/mensagens gratuitas da Meta.
- Campo "Digite aqui…" com **relógio (programar envio)**, microfone (áudio), GIF e emoji.
- Painel da direita com abas **Participantes / Arquivos / Frases** (Frases = respostas rápidas; Arquivos = enviar
  arquivo com legenda opcional).
- **Transferir ou Convidar** (janela): aba Transferir ("Transferir para quem?" → lista das atendentes) e aba Convidar
  (colocar outra pessoa na mesma conversa).

### O que ainda não apareceu nas fotos ❓
Painel de supervisão ("Painel Total" aberto), menu de voz (URA), status além de "Online", relatórios e a tela de
Atendimentos (histórico/protocolo).
