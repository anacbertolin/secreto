# D) XML TISS — onde ficam os arquivos

**Status:** localizado. **Nenhum XML foi aberto nem copiado.** Só olhei o registro de "Ocorrências" de cada lote e a lista de nomes de pastas do disco C:.

## 1. Onde o XML é gerado no sistema
- Atendimentos ▸ Faturamento ▸ Cobranças ▸ **Cobranças de Convênios** → selecionar o processo (lote) → botão lateral **TISS**.
- Ao gerar, o sistema pede um **"Termo de concordância"** e grava uma **ocorrência automática** no processo (aba Detalhamento ▸ Ocorrências) com: usuário e data/hora, nº do(s) lote(s), computador, pasta, nome do(s) arquivo(s) gerado(s) por tipo de guia (SP/SADT, Consultas…), valor da cobrança e total lido nos XMLs.
- Conferência: aba Ocorrências ▸ **Verificação de Arquivos XMLs** (compara contas × XML, guias, procedimentos, despesas, OPME).
- Configuração por convênio: Cadastros ▸ Convênios ▸ Detalhamento ▸ 1ª/2ª/Outras Config. TISS (versão TISS, formato de data, codificação, nº de dígitos do lote, nº máximo de guias por XML…).

## 2. Onde os XML ficam guardados
- **Computador:** DESKTOP-MCDT7V5 (este computador).
- **Pasta:** uma pasta por convênio **direto no disco C:** — `C:\<Nome do convênio>\`.
- Pastas existentes no C: (só os nomes, conferidos agora):
  `C:\Amil` · `C:\Assim` · `C:\Assist` · `C:\Blue Saúde` · `C:\Bradesco` · `C:\Bradesco Saude Operadora` · `C:\CEDAE` · `C:\CEDAE - Periodico` · `C:\Fechamento Unimed` · `C:\Fundação Saúde` · `C:\Geap` · `C:\Golden` · `C:\Hapvida - Intermédica` · `C:\Intermédica` · `C:\Klini` · `C:\Med Service` · `C:\Notredame` · `C:\Porto Seguro` · `C:\Saude Caixa` · `C:\Select` · `C:\Unimed - Consumed Prestador` · `C:\Unimed Gelson` · `C:\Unimed Gisele` · `C:\Unimed Luciano` · `C:\Unimed Max`
- Exemplos confirmados pelas ocorrências de out/2026: Unimed (médicos) → `C:\Unimed Gelson`, `C:\Unimed Gisele`; Amil → `C:\Amil`; Geap → `C:\Geap`; Klini → `C:\Klini`; Porto Seguro → `C:\Porto Seguro`; Bradesco Operadora → `C:\Bradesco`.
- **Não há opção de "baixar XML" dentro do sistema**: os arquivos ficam nessas pastas do computador.
- Atenção: a geração foi feita **neste** computador; se outras pessoas geram XML em outras máquinas, pode haver pastas iguais nelas.

## 3. Padrão do nome do arquivo
`<Registro ANS com 6 dígitos><AAAA><MM><nº do lote com 4 dígitos>_<código hash de 32 caracteres>.XML`

Exemplo (Amil, lote 197, competência 08/2026): `3263052026080197_<hash>.XML`
- 326305 = registro ANS da Amil
- 2026 08 = ano/mês de competência
- 0197 = número do lote
- `_<hash>` = código de 32 caracteres (hash MD5 exigido pelo padrão TISS)

Outros exemplos do padrão: Porto Seguro `000582…` (ANS 582 com zeros à esquerda), Bradesco Operadora `421715…`, Klini `422029…`, Geap `323080…`, Unimed `344397…`.

## 4. Versões TISS usadas nos XML
4.01.00 (maioria) · 4.03.00 (Bradesco) · 4.02.00 (Cedae, Klini) · 3.02.01 (particulares Appai/Assist). Codificação UTF-8 ou ISO-8859-1 conforme o convênio.

## 5. Sugestão para enviar exemplos à equipe com segurança
Escolher 1 XML recente de cada versão/tipo (ex.: `C:\Amil`, `C:\Bradesco`, `C:\Klini`, `C:\Geap` – este último é de **Consulta**) e:
1. **Não enviar por WhatsApp/e-mail comum**: os XML têm nome, carteirinha e procedimentos dos pacientes (dados de saúde – LGPD).
2. Preferir enviar **XML de lotes do paciente de teste** ou pedir para a equipe técnica receber por canal seguro (pasta compartilhada com acesso restrito) e com termo de confidencialidade.
3. Se possível, a equipe pode **anonimizar** (trocar nomes/carteirinhas) antes de usar — mas atenção: alterar o XML muda o hash, então ele serve só como modelo.
