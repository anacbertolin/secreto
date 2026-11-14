# Guia da migração: Micrologos → sistema novo

Guia para a dona do projeto, em linguagem simples. A migração tem **4 etapas**. Em cada uma
está escrito o que **você** faz e o que o **Claude** faz.

```
1. PEDIR E EXPORTAR   →   2. ENVIAR   →   3. ENSAIO (cópia de teste)   →   4. VIRADA (dia D)
   (você)                  (você)          (Claude confere com você)       (todos)
```

---

## Etapa 1: Pedir e exportar os dados do Micrologos

### 1A. Pedido formal à Micrologos (faça já, porque pode demorar)
O melhor caminho é a Micrologos entregar **o banco de dados completo**. As planilhas que o
sistema exporta deixam coisas de fora, principalmente o que só existe no programa do
computador (o "Clinic Master").

Modelo de mensagem (pode copiar e ajustar):

> Prezados, em atenção à LGPD (art. 18, V — portabilidade) e à guarda obrigatória do prontuário
> (Lei 13.787/2018), solicitamos a **exportação completa dos dados** da [nome da clínica/CNPJ] no
> sistema Clinic/Micrologos, incluindo:
> 1. **Cópia integral do banco de dados** (backup/dump), em formato aberto, com o **dicionário de
>    dados** (o que é cada tabela e coluna) e a informação de qual banco é usado (SQL Server, Firebird etc.);
> 2. **Todos os arquivos anexos**: laudos e documentos (PDF), documentos assinados digitalmente com
>    seus arquivos de assinatura, fotos e imagens de pacientes, e imagens de exames (DICOM do PACS);
> 3. Prazo previsto para a entrega e eventuais custos.
> Pedimos que os arquivos sejam entregues por meio seguro (link com senha ou mídia criptografada).

### 1B. Enquanto a Micrologos não responde: exportar o que der pelas telas
Faça login no Micrologos com um usuário **administrador** e exporte, em **Excel ou CSV**:

| # | O quê | Onde costuma ficar | Prioridade |
|---|---|---|---|
| 1 | **Pacientes** (cadastro completo) | Cadastros → Pacientes → exportar/relatório | ⭐ essencial |
| 2 | **Médicos e equipe** (com CRM) | Cadastros → Staff médico | ⭐ essencial |
| 3 | **Convênios e planos** | Cadastros → Convênios | ⭐ essencial |
| 4 | **Agenda futura** (de hoje em diante) | Agenda → relatório "Agenda por médico" | ⭐ essencial |
| 5 | **Agenda passada** (histórico) | Mesmo relatório, período antigo | importante |
| 6 | Horários dos médicos | Staff → horários | importante |
| 7 | Locais e salas | Cadastros → Locais | importante |
| 8 | Procedimentos e exames (com TUSS) | Cadastros → Produtos/Procedimentos | importante |
| 9 | Prontuários / atendimentos | PEP (normalmente só vem pelo banco completo) | ⭐ essencial |
| 10 | Laudos | Fila de laudos | importante |
| 11 | Modelos de texto e de laudo | Cadastros → Textos/Modelos | desejável |
| 12 | Financeiro e faturamento | Cash / Faturamento | depois |

**Dicas**
- Se a tela perguntar o formato, prefira **CSV** ou **Excel (.xlsx)**.
- **Não abra e salve** os CSV no Excel antes de mandar: o Excel pode estragar CPFs (tira zeros à
  esquerda) e datas. Mande o arquivo exatamente como saiu.
- Se um relatório tiver limite de linhas, exporte por períodos (ex.: um arquivo por ano). Não tem problema.
- Anote num papel o que exportou e de qual tela. Isso me ajuda a entender cada arquivo.

---

## Etapa 2: Enviar os arquivos para cá (com segurança)

Use **um** destes caminhos:

**Caminho recomendado: depósito privado no Supabase (fica no Brasil)**
1. Entre em https://supabase.com/dashboard e abra o projeto **secreto**.
2. No menu da esquerda, clique em **Storage**.
3. Abra o depósito **migracao-micrologos**. Ele já está criado e é privado: só o sistema acessa.
4. Crie uma pasta com a data (ex.: `2026-11-20`) e **arraste os arquivos** para dentro.
5. Me avise aqui na conversa: *"enviei os arquivos na pasta 2026-11-20"*.

**Caminho alternativo: anexar aqui na conversa**
Serve para arquivos pequenos (algumas planilhas). Para o banco completo ou muitos PDFs, use o Supabase.

⚠️ **Não** mande dados de pacientes por e-mail comum, WhatsApp ou Google Drive pessoal.

---

## Etapa 3: Ensaio (fazemos juntas, sem risco)

O que eu faço:
1. **Leio e faço o inventário** dos arquivos (quantas linhas, quais colunas, que formato).
   O relatório que te mostro **não contém dados de pacientes**, só contagens e formatos.
2. **Coloco tudo na "área de espera"** do banco: um espaço isolado que o sistema não enxerga.
3. **Confiro e limpo**: CPFs inválidos, pacientes duplicados, datas impossíveis, telefones,
   acentos quebrados.
4. Te mostro um **relatório de conferência**, por exemplo:
   *"12.430 pacientes; 11.980 com CPF válido; 37 possíveis duplicados para você decidir."*
5. Passo os dados para as tabelas do sistema e você **confere na tela** alguns pacientes que
   você conhece (ex.: 10 pacientes e a agenda de amanhã).
6. Se faltar alguma coisa no sistema (um campo, uma tela), **eu peço à sessão de desenvolvimento**.

O ensaio pode ser repetido quantas vezes for preciso. Nada é apagado no Micrologos.

**Decisões que vou te pedir nessa etapa:**
- Duplicados: qual cadastro fica quando dois pacientes parecem ser a mesma pessoa.
- Até que data migrar o histórico da agenda (sugestão: tudo).
- Pacientes inativos ou falecidos: migrar marcados como inativos (sugestão: sim).

---

## Etapa 4: Virada (dia D)

1. **Escolher o dia D**: de preferência uma sexta à tarde ou um fim de semana.
2. **Congelar o Micrologos**: a partir do horário combinado, ninguém marca nem altera nada lá.
3. Você faz a **exportação final** (mesmos arquivos da etapa 1) e envia como na etapa 2.
4. Eu faço a carga final (o mesmo processo do ensaio, já testado) e mostro a conferência.
5. Vocês conferem a **agenda dos próximos dias**, um a um.
6. A equipe passa a usar o sistema novo.
7. **Mantenha o Micrologos só para consulta** por alguns meses (não cancele o contrato logo de cara).

---

## Resumo do que já está pronto (14/11/2026)
- ✅ Área de espera no banco (privada, no Brasil), com controle de cada carga.
- ✅ Funções de limpeza e conferência: CPF, cartão SUS, telefone, CEP, datas, valores, acentos, status da agenda.
- ✅ Depósito privado de arquivos `migracao-micrologos` no Supabase.
- ✅ Ferramenta que lê CSV/Excel, gera o inventário sem dados pessoais e carrega os dados em lotes.
- ✅ Testada de ponta a ponta com dados **fictícios** (já apagados).
- ✅ Acesso desta sessão ao Supabase liberado.
- ⏳ No dia da carga: autorizar a chave de acesso do Supabase nesta sessão (eu peço na hora, com um formulário seguro).
- ⏳ Ajustes no sistema que pedi à sessão de desenvolvimento (lista em `migracao/README.md`).
