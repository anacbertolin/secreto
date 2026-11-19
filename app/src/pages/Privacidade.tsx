// Página pública (sem login): Política de Privacidade da clínica (LGPD).
// Exigida pela Meta para publicar o aplicativo do WhatsApp oficial (17–18/11/2026).
// Texto preparado pelo Claude e APROVADO pela dona em 19/11/2026 — mudanças de conteúdo só com ela.
import type { ReactNode } from "react";
import { CLINICA } from "../lib/marca";

/** Canal para o paciente falar sobre os seus dados. E-mail: preencher quando a clínica definir. */
const CANAL = {
  email: "" as string,
  telefone: CLINICA.telefone,
};
const ATUALIZADA_EM = "18 de novembro de 2026";

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <h2 style={{ fontSize: "1.15rem", margin: "0 0 8px" }}>{titulo}</h2>
      {children}
    </section>
  );
}

export default function Privacidade() {
  const contato = (
    <>
      pelo telefone <b>{CANAL.telefone}</b>
      {CANAL.email && <>, pelo e-mail <b>{CANAL.email}</b></>}
      {" "}ou pessoalmente na recepção ({CLINICA.endereco})
    </>
  );
  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", padding: "24px 16px" }}>
      <article className="painel" style={{ maxWidth: 820, margin: "0 auto", padding: "28px 28px 36px", lineHeight: 1.6 }}>
        <img src="/logo-escuro.png" alt={`${CLINICA.nome} · ${CLINICA.subtitulo}`} style={{ height: 42 }} />
        <h1 style={{ margin: "18px 0 4px" }}>Política de Privacidade</h1>
        <p className="muted" style={{ margin: 0 }}>Atualizada em {ATUALIZADA_EM}</p>

        <p style={{ marginTop: 18 }}>
          Esta política explica, de forma simples, como a <b>{CLINICA.nome} {CLINICA.subtitulo}</b> cuida dos seus dados
          pessoais, de acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
        </p>

        <Secao titulo="1. Quem somos">
          <p>
            {CLINICA.razaoSocial}, CNPJ {CLINICA.cnpj}, {CLINICA.endereco}. Somos os responsáveis (controladores) pelos
            dados pessoais tratados no atendimento da clínica.
          </p>
        </Secao>

        <Secao titulo="2. Quais dados guardamos">
          <ul>
            <li><b>Cadastro:</b> nome, data de nascimento, CPF, telefone, endereço, e-mail e dados do convênio.</li>
            <li><b>Dados de saúde:</b> prontuário, exames, laudos, receitas, cirurgias e demais registros do seu atendimento.</li>
            <li>
              <b>Conversas pelo WhatsApp:</b> mensagens de texto, áudios, fotos e documentos que você envia ou recebe pelos
              números oficiais da clínica (atendimento e orientação cirúrgica). Os áudios podem ser transformados em texto
              automaticamente para facilitar o atendimento e a consulta posterior.
            </li>
            <li><b>Ligações:</b> registro das ligações feitas pelo telefone da clínica (data, horário e duração).</li>
            <li><b>Site:</b> mensagens enviadas pelo formulário de contato e cookies (veja a nossa política de cookies).</li>
          </ul>
        </Secao>

        <Secao titulo="3. Para que usamos">
          <ul>
            <li>Marcar, confirmar e lembrar consultas, exames e cirurgias.</li>
            <li>Prestar o atendimento médico, inclusive a orientação antes e depois de cirurgias.</li>
            <li>Manter o prontuário e o histórico do atendimento, como exige a lei.</li>
            <li>Faturar o atendimento junto ao seu convênio, quando for o caso.</li>
            <li>Responder às suas dúvidas, pedidos e reclamações.</li>
          </ul>
          <p>Não vendemos seus dados e não os usamos para publicidade de terceiros.</p>
        </Secao>

        <Secao titulo="4. Com base em quê (LGPD)">
          <p>
            Tratamos seus dados para a <b>proteção da sua saúde</b> (tutela da saúde, art. 7º, VIII, e art. 11, II, “f”),
            para <b>cumprir obrigações legais</b> (como a guarda do prontuário), para a <b>execução do atendimento</b> que
            você contratou e, quando for o caso, com o seu <b>consentimento</b> — por exemplo, para receber lembretes de
            consulta pelo WhatsApp.
          </p>
        </Secao>

        <Secao titulo="5. Com quem compartilhamos">
          <p>Só com quem precisa para o atendimento funcionar, sempre com contrato e cuidados de segurança:</p>
          <ul>
            <li><b>Seu convênio</b>, para autorização e cobrança do atendimento.</li>
            <li><b>Meta (WhatsApp)</b>, que transmite as mensagens trocadas pelo WhatsApp oficial da clínica.</li>
            <li><b>Supabase</b>, onde ficam guardados o sistema e os dados da clínica, em servidores em São Paulo (Brasil).</li>
            <li><b>Serviços de tecnologia</b> que nos ajudam no atendimento, como transcrição de áudios, receita digital e telefonia.</li>
            <li><b>Autoridades</b>, quando a lei exigir.</li>
          </ul>
          <p>
            Alguns desses serviços (como a Meta e o serviço de transcrição de áudios) podem processar dados fora do Brasil.
            Nesses casos, escolhemos empresas que adotam padrões de proteção compatíveis com a LGPD.
          </p>
        </Secao>

        <Secao titulo="6. Por quanto tempo guardamos">
          <p>
            O prontuário e os registros do atendimento — o que inclui as conversas pelo WhatsApp com a clínica — são guardados
            por <b>no mínimo 20 anos</b> após o último registro, como determina a Lei nº 13.787/2018. Os demais dados ficam
            guardados enquanto forem necessários para o atendimento ou para cumprir a lei.
          </p>
        </Secao>

        <Secao titulo="7. Como protegemos">
          <p>
            O acesso ao sistema é feito com usuário e senha individuais, e cada pessoa da equipe vê apenas o que precisa para a
            sua função. Os dados ficam em servidores protegidos, e os acessos ficam registrados.
          </p>
        </Secao>

        <Secao titulo="8. Seus direitos">
          <p>Você pode, a qualquer momento:</p>
          <ul>
            <li>saber se tratamos seus dados e ter acesso a eles;</li>
            <li>corrigir dados incompletos ou desatualizados;</li>
            <li>pedir informações sobre com quem compartilhamos seus dados;</li>
            <li>retirar o consentimento (por exemplo, deixar de receber lembretes pelo WhatsApp);</li>
            <li>pedir a eliminação dos dados que não precisamos guardar por lei.</li>
          </ul>
          <p>
            Para isso, fale conosco {contato}. Para parar de receber lembretes pelo WhatsApp, basta responder <b>SAIR</b>.
            Você também pode procurar a Autoridade Nacional de Proteção de Dados (ANPD).
          </p>
        </Secao>

        <Secao titulo="9. Mudanças nesta política">
          <p>
            Podemos atualizar esta política. A data da última atualização fica sempre no topo desta página.
          </p>
        </Secao>

        <p className="muted" style={{ marginTop: 28, fontSize: "0.85rem" }}>
          {CLINICA.nome} {CLINICA.subtitulo} · {CLINICA.site}
        </p>
      </article>
    </div>
  );
}
