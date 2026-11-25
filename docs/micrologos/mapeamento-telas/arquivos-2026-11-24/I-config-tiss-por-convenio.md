# I) Configurações TISS de cada convênio no Micrologos (vistas em 22/11/2026)

**Onde fica no Micrologos:** Cadastros ▸ Convênios/Planos Saúde ▸ Detalhamento. As configurações estão nas abas **1ª Config. TISS**, **2ª Config. TISS**, **Outras Config. TISS** (com as sub-abas SP/SADT, Hon/Outras Desp, Res.Intern., 1º, 2º, 3º e 4º Geral) e **Complementares**.
**Modo:** somente leitura. Nada foi alterado.
**Privacidade:** nos convênios "Unimed por médico", o código de cooperado aparece no campo CPF/código. Não copiei CPF de ninguém.

**Legenda:**
- **SIM:** a caixa está marcada.
- **NÃO:** a caixa está desmarcada.
- **(—):** a caixa está em estado "indeterminado" (azul com traço). No Delphi isso significa um valor nulo, que nunca foi gravado. Na prática o Micrologos trata como **NÃO**. Fica anotado para o caso de a Micrologos usar outro padrão.

> ✅ **Validado na prática (Ana Carolina, 22/11/2026):** com estas configurações a clínica **não tem tido glosa**. A regra para o sistema novo é **replicar exatamente** o que está aqui para cada convênio, sem "corrigir" nada. Onde houver dúvida sobre como um campo sai no XML (ex.: formato de data), copiar o que aparece nos **XML reais já aceitos** em `C:\<convênio>\`, e não a tela de cadastro.

Estas configurações são o "manual" de como a Micrologos ajustou cada XML às exigências de cada operadora. O sistema novo deve ter **as mesmas opções por convênio**, em uma tabela de regras.

---

## 1. Tabela comparativa (convênios com XML ativos)

| Convênio (cód) | ANS | Prestador (código usado) | Cód. na operadora | TISS | Encoding no cadastro | Formato de data | Nº guia automático | Máx. proc./guia | Honorário se cirurgia | Consulta na SP/SADT | Sessão em série | Obs. com CID | Dígitos Cód.TISS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Amil (28) | 326305 | PJ · Cód.Operadora | 10453164 | 4.01.00 | **UTF-8** | aaaa-mm-dd | SIM, numeração única (últ. 7000000164) | **10** | **SIM** | **SIM** | NÃO | NÃO | 10 |
| Blue (31) | 423173 | PJ · Cód.Operadora | 005858 | 4.01.00 | ISO-8859-1 | aaaa-mm-dd | NÃO | – | NÃO | NÃO | SIM | SIM | 10 |
| Bradesco Saúde (2) | 005711 | PJ · Cód.Operadora | 0000110502 | **4.03.00** | ISO-8859-1 | aaaa-mm-dd | NÃO | – | NÃO* | NÃO | SIM | NÃO | 10 |
| Bradesco Operadora (23) | 421715 | PJ · Cód.Operadora | 0000110502 | **4.03.00** | ISO-8859-1 | aaaa-mm-dd | NÃO | – | NÃO* | NÃO | SIM | NÃO | 10 |
| Fundação Saúde Itaú (21) | 312126 | PJ · Cód.Operadora | 00119315 | 4.01.00 | ISO-8859-1 | aaaa-mm-dd | SIM | – | **SIM** | NÃO | (—) | SIM | 10 |
| Geap (16) | 323080 | PJ · Cód.Operadora | 17101182 | 4.01.00 | ISO-8859-1 | **dd/mm/aaaa** | SIM | – | NÃO | NÃO | (—) | NÃO | 10 |
| Hapvida (17) | 359017 | PJ · **CPF/CNPJ** | CNPJ 05894660000187 | 4.01.00 | ISO-8859-1 | **dd/mm/aaaa** | NÃO | – | NÃO | NÃO | (—) | NÃO | 10 |
| Klini (25) | 422029 | PJ · **CPF/CNPJ** | CNPJ | **4.02.00** | ISO-8859-1 | aaaa-mm-dd | NÃO | – | NÃO | **SIM** | SIM | SIM | 10 |
| Mediservice (12) | 333689 | PJ · **CPF/CNPJ** | CNPJ | 4.01.00 | **UTF-8** | aaaa-mm-dd | NÃO | **5** | **SIM** | NÃO | (—) | NÃO | 10 |
| Porto Seguro (20) | 000582 | PJ · Cód.Operadora | 00119315 | 4.01.00 | ISO-8859-1 | **dd/mm/aaaa** | SIM, numeração única (últ. 12345685) | – | **SIM** | NÃO | (—) | SIM | 10 |
| Portomed (34) | 417491 | PJ · Cód.Operadora | 00119315 | 4.01.00 | ISO-8859-1 | **dd/mm/aaaa** | SIM | – | **SIM** | NÃO | NÃO | SIM | 10 |
| Saúde Caixa (27) | 312924 | PJ · **CPF/CNPJ** | CNPJ | 4.01.00 | ISO-8859-1 | aaaa-mm-dd | SIM, numeração única (últ. 1281) | – | NÃO | NÃO | SIM | SIM | 10 |
| Select (32) | 358053 | PJ · Cód.Operadora | 46994084 | 4.01.00 | ISO-8859-1 | aaaa-mm-dd | NÃO | – | NÃO | NÃO | SIM | SIM | 10 |
| **Unimed Consumed Cirurgia (26)** | 344397 | **PJ** · Cód.Operadora | **1474** | 4.01.00 | ISO-8859-1 | aaaa-mm-dd | SIM (últ. SP/SADT 0001187224) | – | NÃO (pacote em SP/SADT) | NÃO | NÃO | NÃO | 10 |
| Unimed Antonio (29) – cirurgião externo | 344397 | **PF** · Cód.Operadora | cód. cooperado | 4.01.00 | ISO-8859-1 | aaaa-mm-dd | SIM | – | NÃO | NÃO | NÃO | NÃO | 10 |
| Unimed Gelson (8) | 344397 | **PF** | cód. cooperado | 4.01.00 | ISO-8859-1 | aaaa-mm-dd | SIM | – | NÃO | NÃO | (—) | NÃO | **8** |
| Unimed Gisele (10) | 344397 | **PF** | cód. cooperado | 4.01.00 | ISO-8859-1 | aaaa-mm-dd | NÃO | – | NÃO | NÃO | (—) | NÃO | 10 |
| Unimed Luciano (15) | 344397 | **PF** | cód. cooperado | 4.01.00 | ISO-8859-1 | **dd/mm/aaaa** | NÃO | – | NÃO | NÃO | (—) | NÃO | 10 |
| Unimed Max (22) | 344397 | **PF** | cód. cooperado | 4.01.00 | ISO-8859-1 | aaaa-mm-dd | NÃO | – | NÃO | NÃO | (—) | NÃO | 10 |

\* No Bradesco, a caixa "Utiliza Guia de Honorário se Cirurgia" está desmarcada. Mesmo assim, os XML de cirurgia saem como Guia de Honorários, porque a **Classificação de Guia "Cirurgia" = Honorário individual** (C-faturamento.md) decide isso. A aba Hon. tem "Somente p/ procedimentos cirúrgicos" = SIM.

### Itens iguais em TODOS os convênios acima
- Código de produtos/serviços nas guias: **Brasíndice**.
- **Usa CBO-S Ago/2011** = SIM. Hora no formato 99:99:99. Diagnóstico na tag `diagnosticoAtendimento`.
- **Nº do lote com 12 dígitos**. Dígitos da guia = 0 (sem preenchimento com zeros).
- **Usa o campo "C.R.M." do médico completo** = SIM.
- **"Mostra % Red./Acresc. nas guias e XML"** = SIM em todos, exceto Unimed Antonio. É isso que leva o fator 2,00 ao XML.
- **"Se data de autorização em branco, usa a data da conta"** = SIM em todos, exceto Unimed Antonio.
- **"Não escreve a equipe na guia do médico principal"** = SIM na maioria. A Amil usa o contrário: **"Utiliza uma única guia para toda a equipe"**.
- Nenhum convênio tem procedimento na lista "não enviar via XML (autorizado on-line)".
- Nenhum convênio usa "XML com senha, data da senha e validade" na aba Hon. Na Unimed, a senha vai no bloco de autorização da SP/SADT.

### Formato de data/hora
- **aaaa-mm-dd** e **aaaa-mm-ddT99:99:99**: o padrão ANS (xs:date / xs:dateTime).
- **dd/mm/aaaa** e **dd/mm/aaaaH99:99:99**: usado por Geap, Hapvida, Porto Seguro, Portomed e Unimed Luciano.
- ✅ **Confirmado em 22/11/2026:** os XML reais da Geap e da Unimed Gelson saem com data **aaaa-mm-dd**. O "dd/mm/aaaa" do cadastro é só o formato de tela/impressão. Como as guias são aceitas sem glosa, o sistema novo deve gerar o XML **igual aos XML reais aceitos** desses convênios.

---

## 2. Regras especiais que o sistema novo PRECISA ter por convênio

| Regra | Convênios | Por que importa |
|---|---|---|
| Consulta enviada dentro da **SP/SADT** | Amil, Klini | Guia de consulta separada será glosada/rejeitada |
| Cirurgia em **Guia de Honorários** ("Utiliza Guia de Honorário Médico se for Cirurgia") | Amil, Fundação Itaú, Mediservice, Porto Seguro, Portomed (Bradesco pela classificação) | Tipo de guia errado = rejeição do lote |
| Cirurgia/injeção em **SP/SADT com pacote** (não usa Honorários) | Unimed Consumed Cirurgia | Ver D2 – pacotes tabela 98 |
| Máx. procedimentos por guia | Amil = 10 · **Mediservice = 5** | Acima do limite o portal rejeita |
| Numeração **única** de guia p/ todos os tipos (sequencial) | Amil, Porto Seguro, Saúde Caixa | Guarda o último nº usado |
| Nº de guia **sequencial automático** por tipo | Fundação Itaú, Geap, Portomed, Unimed Consumed, Unimed Antonio, Unimed Gelson | Guarda o último nº por tipo de guia |
| "Guia operadora = Guia prestador" | Fundação Itaú, Hapvida, Porto Seguro, Portomed, Unimed Gelson/Gisele/Luciano/Max | Repete o nº do prestador no campo da operadora quando não há nº da operadora |
| "Usa o mesmo nº da guia p/ a guia principal" | Fundação Itaú, Hapvida, Porto Seguro, Portomed | Preenche `guiaPrincipal` |
| "Não preenche a Guia Princ." | Unimed Consumed, Unimed Antonio | Deixa `guiaPrincipal` vazio |
| Identificação por **CNPJ** em vez de código | Hapvida, Klini, Mediservice, Saúde Caixa | `codigoPrestadorNaOperadora` × `cnpjContratado` |
| Prestador **Pessoa Física (médico)** | Unimed Gelson, Gisele, Luciano, Max, Antonio | Um "prestador" por médico, cada um com lote próprio |
| "Contratado solicitante é o próprio profissional solicitante" | Unimed Consumed, Luciano, Max | Muda o bloco do solicitante |
| "Cód. Operadora do Médico Executante = Cód. Contratado" | Unimed Luciano, Max | Executante = contratado |
| "C/ o nome do Contratado como sendo o próprio médico" (Honorários) | Unimed Max | |
| "Valor unitário = original (sem desconto quando qtd > 1)" | Unimed Consumed | Importante nos pacotes |
| "Ñ coloca zero no código TISS p/ produtos" | Unimed Consumed, Gelson, Gisele | Formatação do código |
| Dígitos do Cód. TISS = **8** | Unimed Gelson (os outros = 10) | Conferir se é intencional |
| Via de acesso: 1ª linha "Única", próximas "Diversas" / principal "Única" e demais "Mesma" | Unimed Consumed (SIM); Fundação Itaú (1ª Única/Diversas) | **Cirurgia bilateral/múltipla**: via de acesso errada é glosa clássica |
| "% Red./Acresc. será sempre 1" quando qtd > 1 | Fundação Itaú, Geap, Unimed Luciano, Max | Interage com o fator 2,00 |
| Observação da guia com a **descrição do CID** | Blue, Fundação Itaú, Klini, Porto Seguro, Portomed, Saúde Caixa, Select | |
| "Sessão" – procedimento com quantidade total + linhas de datas em série | Bradesco (2), Blue, Klini, Saúde Caixa, Select | Para tratamentos seriados |
| Usa executante/solicitante pelo cadastro de códigos do médico na operadora | quase todos (não em Unimed Gelson, Gisele, Antonio) | Exige tabela médico × operadora × código |

---

## 3. Detalhe completo por convênio

```
Cód 2 Bradesco Saúde
1ª: Código utilizado = Cód.Operadora; Prod/Serv = Brasíndice; Nº seq. automático NÃO; Numeração única NÃO; últimos nºs vazios.
TISSNet: Data aaaa-mm-dd; Data/Hora aaaa-mm-ddT99:99:99; Usa CBO-S Ago/2011 SIM; Hora 99:99:99; Diagnóstico=diagnosticoAtendimento; encoding ISO-8859-1; versaoPadrao 4.03.00.
2ª: proc. não enviados = nenhum; usa config própria nº guias/XML NÃO; nº guias/XML vazio; dígitos lote 12; dígitos lote nome arq vazio; dígitos senha vazio; dígitos CNES vazio; Não utiliza TISS = indeterminado(—).
   Guias: Info doença obrig NÃO; máx proc/guia vazio; dígitos nº guia 0; Não mostra CID NÃO; Grava CID na Indicação NÃO; Grava Obs Itens na Indic = —; Grava c/Cód = —; Não usa padrão ANS Reapresentação NÃO; Usa CRM completo SIM. Observação: Descrição CID NÃO; mensagem vazia. Logo Bradesco associado.
Outras/SP-SADT: marcados: Não escreve tipo de consulta(—); No médico executante usar sempre o CPF(—); Sessão (qtd total + linhas data realização em série) SIM; Procedim. categ Consulta com TpAtend<>Consulta => SP/SADT SIM. Consultas na guia SP/SADT NÃO; Utiliza Guia Honorário se Cirurgia NÃO; Tipo Atendimento padrão vazio. Demais NÃO.
Outras/Hon: Somente p/ proced. cirúrgicos SIM; Sempre Cód. na Operadora p/ Contratado e Executante (—); codigoPrestadorNaOperadora sempre CNPJ/CPF (—); demais NÃO (XML com senha/data/validade NÃO).
Outras/Res.Intern: todos NÃO.
Outras/1º Geral: Usa Executante e Solicitante pelo cadastro de códigos nas operadoras dos médicos SIM; Mostra % Red./Acresc. nas guias e XML SIM; Total geral igual em todas as páginas (—); demais NÃO; acrescenta 0 min hora final.
Outras/2º Geral: Se data autorização em branco usa data da conta SIM; Qtd dígitos Cód.TISS 10; "Mesmo se % Red.Acrésc igual a 0" (—); demais NÃO.
Outras/3º Geral: Não escreve a equipe na guia do médico principal SIM; (—): %Red/Acresc sempre 1; 1ª via Única/próximas Diversas; se não mostrar valor original %Red=1; Não mostra via de acesso; Não inclui material/medicamentos no XML; Proc principal Única Via e demais Mesma Via; qtd>1 Mesma Via. Demais NÃO.
Outras/4º Geral: todos (—) indeterminados: staff valor original; layout 1 proc por cabeçalho; código de barras; desmembra 2ª qtd %zerado; C.Resp na descrição; solicitante contato externo; não imprime assinatura; observação SP/SADT; não envia nº carteira.
Complementares: Razão social "Bradesco Saude"; conectividade vazio; ANS 5711; último lote 1676; Prestador PJ CNPJ 05894660000187; Consumed Consultorios Medicos Ltda; cód junto operadora 0000110502; CNES 3176479; emitente Consumed (23).
```

```
Cód 8 Unimed Gelson (médico cooperado, PF)
Complementares: razão "Unimed"; ANS 344397; último lote 1531; Pessoa FÍSICA; CPF/código = código de cooperado (6 dígitos); nome = o médico; cód junto operadora = código de cooperado; CNES 3176479.
1ª: Cód.Operadora; Brasíndice; seq. auto SIM; últimos: SP/SADT 9379060007; Consulta 2. Data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; Não utiliza TISS (—); Grava Obs Itens (—); Grava c/Cód (—); CRM completo SIM.
SP/SADT: Sessão (—); médico exec CPF (—); categ Consulta=>SP/SADT (—); Não escreve tipo consulta (—); Não preenche Guia Princ. (—).
Hon: Sempre Cód. Operadora p/ Contratado e Executante (—); codigoPrestadorNaOperadora CNPJ/CPF (—).
1º Geral: "Usa Exec/Solic pelo cadastro" NÃO; Mostra % SIM; Total geral igual (—).
2º Geral: data aut. em branco = data conta SIM; Ñ coloca zero no cód TISS p/ produtos SIM; **Qtd dígitos Cód.TISS = 8**; Guia operadora = Guia prestador SIM; qtde>1 linha p/ cada SIM; mesmo se %=0 (—).
3º Geral: Não escreve equipe SIM; Não mostra via de acesso SIM(?); (—): %Red 1; não mostra valor orig %=1; não inclui material; principal Única/Mesma; qtd>1 Mesma.
4º Geral: todos (—).
```

```
Cód 10 Unimed Gisele (médica cooperada, PF)
Complementares: Unimed; ANS 344397; último lote 986; PF; código de cooperado como CPF/código; CNES 3176479.
1ª: Cód.Operadora; Brasíndice; seq. auto NÃO; últimos vazios. Data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; ISO-8859-1; 4.01.00.
2ª: lote 12; Não utiliza TISS (—); Grava Obs Itens (—); Grava c/Cód (—); CRM completo SIM.
SP/SADT: Sessão (—); médico exec CPF (—); categ Consulta=>SP/SADT (—); Não escreve tipo consulta (—); Não preenche Guia Princ. (—).
Hon: Sempre Cód. Operadora (—); codigoPrestador CNPJ/CPF (—).
1º Geral: cadastro códigos NÃO; Mostra % SIM; Total geral igual (—).
2º Geral: data aut. = data conta SIM; Ñ coloca zero p/ produtos SIM; Guia operadora = prestador SIM; qtde>1 linha p/ cada SIM; mesmo se %=0 (—); **Cód.TISS 10** (Gelson usa 8).
3º Geral: Não escreve equipe SIM; Não mostra via SIM(?); demais (—).
4º Geral: todos (—).
```

```
Cód 12 Mediservice
Complementares: razão "Mediservice"; ANS 333689; último lote 222; PJ CNPJ 05894660000187; "Consumed Consultorios Medicos Ltda Me"; cód junto operadora 05894660000187; CNES 3176479.
1ª: CPF/CNPJ; Brasíndice; sem seq. auto. Data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; encoding UTF-8 (cadastro); 4.01.00.
2ª: lote 12; **Máx. 5 procedimentos por guia**; Não utiliza TISS (—); Grava Obs Itens (—); Grava c/Cód (—); CRM completo SIM.
SP/SADT: Utiliza Guia Honorário se Cirurgia SIM; Sessão (—); médico exec. CPF (—); categ Consulta=>SP/SADT (—); Não escreve tipo consulta (—).
Hon: Somente cirúrgicos SIM.
1º Geral: cadastro códigos SIM; Mostra % SIM; Total geral igual (—).
2º Geral: data aut. em branco = data conta SIM; qtde>1 linha p/ cada (—); mesmo se %=0 (—); Cód.TISS 10.
3º Geral: Não escreve equipe SIM; (—): %Red sempre 1; 1ª via Única/Diversas; se não mostrar valor original %=1; não mostra via; não inclui material; principal Única/demais Mesma; qtd>1 Mesma.
4º Geral: todos (—).
```

```
Cód 15 Unimed Luciano (médico cooperado, PF)
Complementares: Unimed; ANS 344397; último lote 690; PF; código de cooperado; CNES 3176479; emitente "Unimed Luciano" (203).
1ª: Cód.Operadora; Brasíndice; seq. auto NÃO. **Data dd/mm/aaaa; datahora dd/mm/aaaaH99:99:99**; CBO-S 2011 SIM; ISO-8859-1; 4.01.00.
2ª: lote 12; Não utiliza TISS (—); Grava Obs Itens (—); Grava c/Cód (—); CRM completo SIM.
SP/SADT: Sessão (—); médico exec CPF (—); categ Consulta=>SP/SADT (—); Não escreve tipo consulta (—); Não preenche Guia Princ. (—).
Hon: Sempre Cód. Operadora (—); codigoPrestador CNPJ/CPF (—).
1º Geral: Usa Exec/Solic pelo cadastro SIM; Contratado Solicitante = próprio profissional SIM; Cód.Operadora do Médico Executante = Cód.Contratado SIM; Mostra % SIM; Total geral igual (—).
2º Geral: data aut. = data conta SIM; Guia operadora = prestador SIM; qtde>1 linha p/ cada SIM; mesmo se %=0 (—); Cód.TISS 10; Ñ coloca zero p/ produtos NÃO.
3º Geral: Não escreve equipe SIM; Não escreve nome de médico repetido SIM; qtd>1 %Red sempre 1 SIM; %Red sempre 1 SIM; (—): não mostra valor orig %=1; não inclui material; principal Única/Mesma; qtd>1 Mesma.
4º Geral: todos (—).
```

```
Cód 16 Geap
Complementares: razão "Geap Autogestão Em Saude"; ANS 323080; último lote 376; PJ CNPJ 05894660000187; Consumed Consultorios Medicos Ltda; cód junto operadora 17101182; CNES 3176479.
1ª: Cód.Operadora; Brasíndice; seq. auto SIM; numeração única NÃO; últimos nºs: Resumo Intern. 51234637; Consulta 23660879; SP/SADT 82367340; Honorários 61234567. Data dd/mm/aaaa; datahora dd/mm/aaaaH99:99:99 (sic); CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; Não utiliza TISS (—); Grava Obs Itens Indic (—); Grava c/Cód (—); CRM completo SIM.
SP/SADT: Sessão (—); médico executante sempre CPF (—); categ Consulta c/ TpAtend<>Consulta => SP/SADT (—); Não escreve tipo consulta (—); Utiliza Guia Honorário se Cirurgia NÃO.
Hon: codigoPrestadorNaOperadora sempre CNPJ/CPF (—); Somente cirúrgicos NÃO.
1º Geral: cadastro de códigos SIM; Mostra % SIM; Total geral igual em todas as páginas (—).
2º Geral: data aut. em branco = data conta SIM; qtde>1 uma linha p/ cada (—); mesmo se %=0 (—); Cód.TISS 10.
3º Geral: Não escreve equipe SIM; %Red sempre 1 SIM; 1ª via Única/demais Diversas SIM; (—): se não mostrar valor original %=1; não mostra via de acesso; não inclui material; principal Única/demais Mesma; qtd>1 Mesma Via.
4º Geral: todos (—).
```

```
Cód 17 Hapvida Notredame/Intermedica
Complementares: razão "Hapvida Notredame/ Intermedica"; ANS 359017; último lote 1923; PJ CNPJ 05894660000187; cód junto operadora 05894660000187 (o próprio CNPJ); CNES 3176479.
1ª: código utilizado = CPF/CNPJ; Brasíndice; sem seq. auto; últimos nºs vazios. Data dd/mm/aaaa; datahora dd/mm/aaaaH99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; Não utiliza TISS (—); Grava Obs Itens (—); Grava c/Cód (—); CRM completo SIM.
SP/SADT: Sessão (—); médico exec. sempre CPF (—); categ Consulta=>SP/SADT (—); Não escreve tipo consulta (—). Honorário se cirurgia NÃO.
Hon: Somente cirúrgicos SIM; codigoPrestadorNaOperadora sempre CNPJ/CPF (—).
1º Geral: cadastro de códigos SIM; Mostra % SIM; Total geral igual (—).
2º Geral: mesmo nº guia p/ guia principal SIM; data aut. em branco = data conta SIM; Guia operadora = Guia prestador SIM; qtde>1 uma linha p/ cada (—); mesmo se %=0 (—); Cód.TISS 10.
3º Geral: (—): %Red sempre 1; se não mostrar valor original %=1; não mostra via; não inclui material; principal Única/demais Mesma; qtd>1 Mesma Via. Demais NÃO.
4º Geral: todos (—).
```

```
Cód 20 Porto Seguro Saúde
Complementares: razão "Porto Seguro Saude"; ANS 582 (000582); último lote 527; PJ CNPJ 05894660000187; Consumed Consultorios Medicos Ltda; cód junto operadora 00119315; CNES 3176479.
1ª: Cód.Operadora; Brasíndice; seq. auto SIM; numeração única SIM; último nº guia 12345685. Data dd/mm/aaaa; datahora dd/mm/aaaaH99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; Não utiliza TISS (—); Observação: Descrição CID SIM; Grava Obs Itens (—); Grava c/Cód (—); CRM completo SIM.
SP/SADT: Utiliza Guia Honorário se Cirurgia SIM; Sessão (—); médico exec CPF (—); categ Consulta=>SP/SADT (—); Não escreve tipo consulta (—).
Hon: Somente cirúrgicos NÃO; codigoPrestadorNaOperadora sempre CNPJ/CPF (—).
1º Geral: cadastro códigos SIM; Mostra % SIM; Total geral igual (—).
2º Geral: mesmo nº guia p/ guia principal SIM; data aut. em branco = data conta SIM; Guia operadora = Guia prestador SIM; qtde>1 linha p/ cada (—); mesmo se %=0 (—); Cód.TISS 10.
3º Geral: Não escreve equipe SIM; demais (—) (%Red 1; não mostra valor orig %=1; não mostra via; não inclui material; Única/Mesma; qtd>1 Mesma).
4º Geral: todos (—).
```

```
Cód 21 Fundação Saúde Itaú
Complementares: razão "Fundacao Saude Itau"; ANS 312126; último lote 521; PJ CNPJ 05894660000187; Consumed Consultorios Medicos Ltda; cód junto operadora 00119315; CNES 3176479.
1ª: Cód.Operadora; Brasíndice; Nº seq. guia automático SIM; numeração única NÃO; últimos nºs: Resumo Intern. 642383, Honorários 642381. Data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; Não utiliza TISS (—); Grava Obs Itens na Indic (—); Observação: Descrição CID SIM; CRM completo SIM.
SP/SADT: Sessão (—); No médico executante sempre CPF (—); Utiliza Guia Honorário se Cirurgia SIM; Procedim. categ Consulta c/ TpAtend<>Consulta => SP/SADT SIM; Não escreve tipo consulta (—).
Hon: Somente cirúrgicos SIM; codigoPrestadorNaOperadora sempre CNPJ/CPF (—).
1º Geral: cadastro de códigos SIM; Mostra % SIM; Total geral igual em todas as páginas (—).
2º Geral: mesmo nº da guia p/ guia principal SIM; data aut. em branco = data conta SIM; Guia operadora = Guia prestador SIM; qtde>1 uma linha p/ cada (—); mesmo se %=0 (—); Cód.TISS 10.
3º Geral: Não escreve equipe na guia do médico principal SIM; % Red sempre 1 SIM; 1ª via Única/demais Diversas SIM; se não mostrar valor original %=1 SIM; (—): não mostra via de acesso; não inclui material/med; principal Única Via/demais Mesma Via; qtd>1 Mesma Via.
4º Geral: todos (—).
```

```
Cód 22 Unimed Max (médico cooperado, PF)
Complementares: Unimed; ANS 344397; último lote 211; PF; código de cooperado; CNES 3176479; emitente "Unimed Max".
1ª: Cód.Operadora; Brasíndice; seq. auto NÃO. Data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; ISO-8859-1; 4.01.00.
2ª: lote 12; Não utiliza TISS (—); Grava Obs Itens (—); Grava c/Cód (—); CRM completo SIM.
SP/SADT: (—) em Sessão, médico exec CPF, categ Consulta=>SP/SADT, Não escreve tipo consulta, Não preenche Guia Princ.
Hon: **C/ o nome do Contratado como sendo o próprio médico SIM**; codigoPrestador CNPJ/CPF (—).
1º Geral: Usa Exec/Solic cadastro SIM; Contratado Solicitante = próprio profissional SIM; Cód.Operadora Médico Executante = Cód.Contratado SIM; Mostra % SIM; Total geral igual (—).
2º Geral: data aut. = data conta SIM; Guia operadora = prestador SIM; qtde>1 linha p/ cada SIM; mesmo se %=0 (—); Cód.TISS 10.
3º Geral: Não escreve equipe SIM; não escreve nome repetido SIM; qtd>1 %Red sempre 1 SIM; %Red sempre 1 SIM; demais (—).
4º Geral: todos (—).
```

```
Cód 23 Bradesco Saúde Operadora de Planos
Complementares: razão "Bradesco Saude Operadora de Planos"; ANS 421715; último lote 1674; PJ CNPJ 05894660000187; cód junto operadora 0000110502; CNES 3176479; emitente Consumed 23.
1ª: igual Bradesco Saúde (Cód.Operadora; Brasíndice; sem seq. auto; data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.03.00).
2ª: lote 12 dígitos; dígitos senha 0; Não utiliza TISS (—); máx proc vazio; dígitos guia 0; Grava Obs Itens Indic (—); Grava c/Cód SIM; Usa CRM completo SIM; demais NÃO.
SP/SADT: Sessão SIM; Não escreve tipo consulta (—); demais NÃO (diferença: "médico executante sempre CPF" NÃO e "categ Consulta c/ TpAtend<>Consulta => SP/SADT" NÃO).
Hon: Somente cirúrgicos SIM; demais NÃO.
1º Geral: Usa Executante/Solicitante pelo cadastro de códigos SIM; Mostra % Red./Acresc. SIM; demais NÃO.
2º Geral: data autorização em branco = data da conta SIM; "Mesmo se %Red=0" SIM; Cód.TISS 10 dígitos; demais NÃO.
3º Geral: Não escreve equipe na guia do médico principal SIM; Não inclui material/medicamentos no XML (—); demais NÃO.
4º Geral: (—) em: solicitante contato externo; não imprime assinatura; observação SP/SADT; não envia nº carteira. Demais NÃO.
```

```
Cód 25 Klini Saúde
Complementares: razão "Klini Saude"; ANS 422029; último lote 390; PJ CNPJ 05894660000187; nome prestador "Consumed Clinica de Olhos"; cód junto operadora 05894660000187; CNES 3176479.
1ª: CPF/CNPJ; Brasíndice; sem seq. auto. Data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; **4.02.00**.
2ª: lote 12; senha 0; CNES 0; Não utiliza TISS NÃO; Observação: Descrição CID SIM; CRM completo SIM.
SP/SADT: Sessão SIM; Consultas na guia SP/SADT SIM; Não escreve tipo consulta (—); Honorário se cirurgia NÃO.
Hon: Somente cirúrgicos SIM.
1º Geral: cadastro códigos SIM; Mostra % SIM.
2º Geral: data aut. em branco = data conta SIM; qtde>1 uma linha p/ cada (—); Cód.TISS 10.
3º Geral: Não escreve equipe SIM; Não inclui material (—).
4º Geral: Não envia nº carteira (—).
```

```
Cód 26 Unimed Consumed Cirurgia  (CIRURGIAS + INJEÇÕES — prioridade)
Complementares: razão "Unimed"; ANS 344397; último lote 260; PJ CNPJ 05894660000187; nome prestador "Consumed Olhos"; cód junto operadora 1474; CNES 3176479; sem emitente.
1ª: Cód.Operadora; Brasíndice; seq. auto SIM; numeração única NÃO; último SP/SADT 0001187224. Data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; senha 0; CNES 0; Não utiliza TISS NÃO; Grava c/Cód SIM; CRM completo SIM; Descrição CID NÃO; máx proc/guia vazio.
SP/SADT: Não preenche a Guia Princ. SIM; Não escreve tipo consulta (—); Sessão NÃO; Honorário se cirurgia NÃO (cirurgia vai em SP/SADT com pacote); Consultas na SP/SADT NÃO.
Hon: todos NÃO.
1º Geral: Usa Exec/Solic pelo cadastro de códigos SIM; **Contratado Solicitante é o próprio Profissional Solicitante SIM**; Mostra % Red./Acresc. SIM; **Valor Unitário da Guia = Original (sem desconto sobre qtd>1) SIM**.
2º Geral: data aut. em branco = data conta SIM; **Ñ coloca zero no código TISS p/ Produtos SIM**; qtde>1 linha p/ cada (—); Cód.TISS 10.
3º Geral: **1 linha p/ cada qtd; 1ª via "Única", próximas "Diversas" SIM**; **Procedimento principal "Única Via" e demais "Mesma Via" SIM**; Não inclui material/medicamentos (—); demais NÃO.
4º Geral: Não envia nº carteira (—); demais NÃO.
```

```
Cód 27 Saúde Caixa
Complementares: razão "Saude Caixa"; ANS 312924; último lote 74; PJ CNPJ 05894660000187; cód junto operadora 05894660000187; CNES 3176479.
1ª: CPF/CNPJ; Brasíndice; seq. auto SIM; numeração única SIM; último nº guia 1281. Data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; senha 0; CNES 0; Não utiliza TISS NÃO; Observação: Descrição CID SIM; CRM completo SIM.
SP/SADT: Sessão SIM; Não escreve tipo consulta (—); Honorário se cirurgia NÃO; Consultas na SP/SADT NÃO.
Hon: todos NÃO.
1º Geral: cadastro códigos SIM; Mostra % SIM.
2º Geral: data aut. em branco = data conta SIM; qtde>1 linha p/ cada (—); Cód.TISS 10.
3º Geral: Não escreve equipe SIM; Não inclui material (—).
4º Geral: Não envia nº carteira (—).
```

```
Cód 28 Amil
Complementares: razão "Amil Assistencia Medica Internacional S/a"; ANS 326305; último lote 198; PJ CNPJ 05894660000187; cód junto operadora 10453164; CNES 3176479; emitente Consumed 23.
1ª: Cód.Operadora; Brasíndice; Nº seq. guia automático SIM; Numeração única p/ todos os tipos SIM; último nº guia 7000000164. TISSNet: data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; encoding UTF-8 (cadastro); 4.01.00.
2ª: lote 12 dígitos; senha 0; CNES 0; Não utiliza TISS NÃO; máx proc/guia 10; dígitos guia 0; Usa CRM completo SIM; demais NÃO.
SP/SADT: Utiliza Guia Honorário Médico se Cirurgia SIM; Consultas na guia SP/SADT SIM; Não escreve tipo consulta (—); demais NÃO (Sessão NÃO).
Hon: todos NÃO (inclusive "Somente cirúrgicos").
1º Geral: Usa Executante/Solicitante pelo cadastro de códigos SIM; Mostra % Red./Acresc. SIM; demais NÃO.
2º Geral: data autorização em branco = data da conta SIM; Cód.TISS 10; demais NÃO.
3º Geral: Utiliza uma única guia para toda a equipe SIM; Não inclui material/medicamentos (—); demais NÃO.
4º Geral: Não envia nº carteira (—); demais NÃO.
```

```
Cód 29 Unimed Antonio (cirurgião externo)
Complementares: razão "Unimed"; ANS 344397; último lote vazio; Pessoa FÍSICA; CNPJ/CPF e cód junto operadora = código de cooperado do médico (6 dígitos); nome = o próprio médico; CNES 9999999 (genérico); sem emitente.
1ª: Cód.Operadora; Brasíndice; seq. auto SIM; último SP/SADT 1187057. Data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; senha 0; CNES 0; Não utiliza TISS NÃO; CRM completo SIM; Descrição CID NÃO.
SP/SADT: Não preenche a Guia Princ. SIM; Não escreve tipo consulta (—); Sessão NÃO; Honorário se cirurgia NÃO.
Hon: todos NÃO.
1º Geral: TODOS NÃO (inclusive "Usa Exec/Solic pelo cadastro" e "Mostra % Red./Acresc." = NÃO).
2º Geral: data aut. em branco = data conta NÃO; qtde>1 linha p/ cada (—); Cód.TISS 10.
3º Geral: Não inclui material (—); demais NÃO.
4º Geral: Não envia nº carteira (—).
```

```
Cód 31 Blue
Complementares: razão "Blue Company"; ANS 423173; último lote 4; PJ CNPJ 05894660000187; nome prestador "Consumed Olhos"; cód junto operadora 005858; CNES 3176479; emitente Consumed 23.
1ª: Cód.Operadora; Brasíndice; sem seq. auto; data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; senha 0; CNES 0; Não utiliza TISS NÃO; dígitos guia 0; Observação: Descrição CID SIM; CRM completo SIM; demais NÃO.
SP/SADT: Sessão SIM; demais NÃO.
Hon: Somente cirúrgicos SIM; demais NÃO.
1º Geral: cadastro de códigos SIM; Mostra % Red./Acresc. SIM.
2º Geral: data autorização em branco = data conta SIM; "qtde>1 uma linha p/ cada quantidade" (—); Cód.TISS 10.
3º Geral: Não escreve equipe na guia do médico principal SIM; Não inclui material/medicamentos (—).
4º Geral: Não envia nº carteira (—).
```

```
Cód 32 Select
Complementares: razão "Select Operadora de Planos de Saude Ltda"; ANS 358053; último lote 5; PJ CNPJ 05894660000187; cód junto operadora 46994084; CNES 3176479.
1ª: Cód.Operadora; Brasíndice; sem seq. auto. Data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; senha 0; CNES 0; Não utiliza TISS NÃO; Descrição CID SIM; CRM completo SIM.
SP/SADT: Sessão SIM; demais NÃO.
Hon: Somente cirúrgicos SIM.
1º Geral: cadastro códigos SIM; Mostra % SIM.
2º Geral: data aut. em branco = data conta SIM; qtde>1 linha p/ cada (—); Cód.TISS 10.
3º Geral: Não escreve equipe SIM; Não inclui material (—).
4º Geral: Não envia nº carteira (—).
```

```
Cód 34 Portomed
Complementares: razão "Portomed-porto Seguro Serviços de Saude S/a"; ANS 417491; último lote 487; PJ CNPJ 05894660000187; cód junto operadora 00119315; CNES 3176479.
1ª: Cód.Operadora; Brasíndice; seq. auto SIM; numeração única NÃO; últimos nºs vazios. Data dd/mm/aaaa; datahora dd/mm/aaaaH99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; senha 0; CNES 0; Não utiliza TISS NÃO; Observação: Descrição CID SIM; CRM completo SIM.
SP/SADT: Utiliza Guia Honorário se Cirurgia SIM; demais NÃO (Sessão NÃO).
Hon: todos NÃO.
1º Geral: cadastro códigos SIM; Mostra % SIM.
2º Geral: mesmo nº guia p/ principal SIM; data aut. em branco = data conta SIM; Guia operadora = Guia prestador SIM; qtde>1 linha p/ cada (—); Cód.TISS 10.
3º Geral: Não escreve equipe SIM; Não inclui material (—).
4º Geral: Não envia nº carteira (—).
```

---

## 4. Não conferidos (sem XML ou não atendidos)
Assim, Assist, Golden Cross, Notre Dame, Particular, Particular Appai, Particular Assist, Livre Escolha, Cedae Periódico, Cisbaf e Siass-Geap: sem XML ou não atendidos mais. Unimed Pedro: não atende pela Unimed. O convênio com nome de pessoa (cód. 19) é um particular.
Também não abri a **configuração geral do sistema** ("nº de guias por XML"), que vale quando o convênio não tem configuração própria. Nenhum convênio marca "Usa essa configuração de nº guias por XML".


---

## 5. Referência oficial da ANS (consultada em 22/11/2026)
- A versão vigente publicada é o **Padrão TISS – Setembro/2026**, com **Componente de Comunicação 04.03.00** (e 01.06.00).
- Hoje a clínica ainda envia **4.01.00** para Unimed, Amil e a maioria, 4.02.00 para Klini e 4.03.00 para Bradesco. As operadoras ainda aceitam essas versões, mas cada uma pode passar a exigir só a 4.03.00. Exemplo: um informativo da Unimed Planalto Médio (outra Unimed, do RS) avisou que, a partir de 01/07/2026, o sistema deles aceita só XML 4.03.00.
- ➜ O sistema novo deve **gerar 4.01.00, 4.02.00 e 4.03.00**, escolhida por convênio, e estar pronto para mudar cada convênio para 4.03.00 quando a operadora pedir.
- **Downloads oficiais para o Code** (schemas .xsd, tabelas de domínio e TUSS):
  - Página da versão vigente: https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/padrao-tiss-setembro-2026
  - Componente de Comunicação (XSD): https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/PadroTISSComunicao_202511.zip
  - Componente de Conteúdo e Estrutura: https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/PadroTISS_ComponentedeContedoeEstrutura_202511.zip
  - TUSS / tabelas de domínio: https://www.ans.gov.br/arquivos/extras/tiss/Padrao_TISS_Representacao_de_Conceitos_em_Saude_202609.zip
  - Componente Organizacional (regras): https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/PadroTISS_ComponenteOrganizacional_202609.pdf
  - Histórico das versões (para baixar os XSD 4.01.00 e 4.02.00): https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/padrao-tiss-historico-das-versoes-dos-componentes-do-padrao-tiss
