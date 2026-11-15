import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { FUNCOES, type Funcao } from "./lib/util";
import { CLINICA } from "./lib/marca";
import Login, { TrocarSenha } from "./pages/Login";
import Inicio from "./pages/Inicio";
import Agenda from "./pages/Agenda";
import Recepcao from "./pages/Recepcao";
import Pacientes, { PacienteEditar } from "./pages/Pacientes";
import PacienteFicha from "./pages/PacienteFicha";
import FilaMedico from "./pages/FilaMedico";
import Atendimento from "./pages/Atendimento";
import Exames, { ExameDetalhe } from "./pages/Exames";
import Imprimir from "./pages/Imprimir";
import { Equipe, Convenios, Locais, Horarios, CatalogoExames, Modelos } from "./pages/Cadastros";
import Faturamento, { ContaDetalhe, LoteDetalhe } from "./pages/Faturamento";
import Procedimentos from "./pages/Procedimentos";
import Relatorios from "./pages/Relatorios";
import WhatsApp from "./pages/WhatsApp";
import AssistenteWhatsApp from "./pages/AssistenteWhatsApp";
import PainelTV from "./pages/PainelTV";
import BuscaAtiva from "./pages/BuscaAtiva";
import Cirurgias, { CirurgiaDetalhe } from "./pages/Cirurgias";
import Estoque from "./pages/Estoque";
import Verificar from "./pages/Verificar";
import ConfigIA from "./pages/ConfigIA";
import { useNaoLidas } from "./lib/whatsapp";

interface ItemMenu { para: string; rotulo: string; icone: string; funcoes?: Funcao[]; grupo?: string }

const MENU: ItemMenu[] = [
  { para: "/", rotulo: "Início", icone: "🏠" },
  { para: "/agenda", rotulo: "Agenda", icone: "📅" },
  { para: "/recepcao", rotulo: "Recepção", icone: "🛎️", funcoes: ["medico", "enfermagem", "recepcao", "admin"] },
  { para: "/pacientes", rotulo: "Pacientes", icone: "👤" },
  { para: "/whatsapp", rotulo: "WhatsApp", icone: "💬", funcoes: ["medico", "enfermagem", "recepcao", "admin", "faturamento"] },
  { para: "/whatsapp/assistente", rotulo: "Assistente do WhatsApp", icone: "🤖", funcoes: ["recepcao", "admin"] },
  { para: "/consultorio", rotulo: "Consultório", icone: "🩺", funcoes: ["medico", "enfermagem"] },
  { para: "/busca-ativa", rotulo: "Busca ativa", icone: "📞", funcoes: ["medico", "enfermagem", "recepcao", "admin"] },
  { para: "/cirurgias", rotulo: "Centro cirúrgico", icone: "🏥", funcoes: ["medico", "enfermagem"] },
  { para: "/estoque", rotulo: "Estoque", icone: "📦", funcoes: ["medico", "enfermagem", "admin", "faturamento"] },
  { para: "/exames", rotulo: "Exames e laudos", icone: "🔬", funcoes: ["medico", "enfermagem"] },
  { para: "/faturamento", rotulo: "Faturamento", icone: "🧾", funcoes: ["faturamento", "recepcao", "admin"] },
  { para: "/relatorios", rotulo: "Relatórios", icone: "📊" },
  { grupo: "Cadastros", para: "/cadastros/equipe", rotulo: "Equipe", icone: "👥", funcoes: ["admin"] },
  { para: "/cadastros/horarios", rotulo: "Horários e bloqueios", icone: "🕒", funcoes: ["recepcao", "admin"] },
  { para: "/cadastros/convenios", rotulo: "Convênios", icone: "💳", funcoes: ["recepcao", "admin", "faturamento"] },
  { para: "/cadastros/procedimentos", rotulo: "Procedimentos e preços", icone: "💲", funcoes: ["faturamento", "admin"] },
  { para: "/cadastros/locais", rotulo: "Salas e consultórios", icone: "🚪", funcoes: ["recepcao", "admin"] },
  { para: "/cadastros/exames", rotulo: "Tipos de exame", icone: "📋", funcoes: ["recepcao", "admin"] },
  { para: "/cadastros/ia", rotulo: "Inteligência artificial", icone: "✨", funcoes: ["admin"] },
  { para: "/cadastros/modelos", rotulo: "Modelos de texto", icone: "📝", funcoes: ["medico", "enfermagem"] },
];

function Protegida({ funcoes, children }: { funcoes?: Funcao[]; children: ReactNode }) {
  const { pode } = useAuth();
  if (funcoes && !pode(...funcoes)) return <div className="painel vazio">Você não tem acesso a esta área.</div>;
  return <>{children}</>;
}

export default function App() {
  const { session, eu, carregando, sair, pode } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);
  const loc = useLocation();
  // Mensagens do WhatsApp não lidas: menu e título da aba, com som (só para quem responde: recepção e administração)
  const naoLidas = useNaoLidas(pode("recepcao", "admin"));
  useEffect(() => {
    document.title = (naoLidas ? `(${naoLidas}) ` : "") + "Consumed · Sistema da Clínica";
  }, [naoLidas]);

  // Conferência pública de documentos (QR): não precisa de login
  if (loc.pathname === "/verificar" || loc.pathname.startsWith("/verificar/")) {
    return (
      <Routes>
        <Route path="/verificar" element={<Verificar />} />
        <Route path="/verificar/:codigo" element={<Verificar />} />
      </Routes>
    );
  }

  if (carregando) return <div className="vazio">Carregando…</div>;
  if (!session) return <Login />;
  if (session.user.user_metadata?.trocar_senha) return <TrocarSenha obrigatoria />;
  if (!eu)
    return (
      <div className="tela-login">
        <div className="caixa-login">
          <h2>Acesso não liberado</h2>
          <p>O e-mail <b>{session.user.email}</b> não está cadastrado (ou está inativo) na equipe.</p>
          <p className="muted">Peça à administração para cadastrar você em Cadastros → Equipe.</p>
          <button onClick={sair}>Sair</button>
        </div>
      </div>
    );

  // TV da sala de espera: tela cheia, sem menu
  if (loc.pathname === "/painel-tv") return <PainelTV />;

  // Páginas de impressão ficam sem menu
  if (loc.pathname.startsWith("/imprimir/")) {
    return (
      <Routes>
        <Route path="/imprimir/:tipo/:id" element={<Imprimir />} />
      </Routes>
    );
  }

  let grupoAtual = "";
  return (
    <div className="app">
      <div className="topo-movel">
        <img src="/logo-branco.png" alt={CLINICA.nome} style={{ height: 22 }} />
        <button className="sutil" style={{ color: "white" }} onClick={() => setMenuAberto(true)}>☰ Menu</button>
      </div>
      <aside className={"lateral" + (menuAberto ? " aberta" : "")} onClick={() => setMenuAberto(false)}>
        <div className="marca">
          <img src="/logo-branco.png" alt={`${CLINICA.nome} · ${CLINICA.subtitulo}`} />
          <span>SISTEMA DA CLÍNICA</span>
        </div>
        <nav>
          {MENU.filter((m) => !m.funcoes || pode(...m.funcoes)).map((m) => {
            const cab = m.grupo && m.grupo !== grupoAtual ? ((grupoAtual = m.grupo), <div className="grupo" key={"g" + m.grupo}>{m.grupo}</div>) : null;
            return [
              cab,
              <NavLink key={m.para} to={m.para} end={m.para === "/" || m.para === "/whatsapp"}>
                <span aria-hidden>{m.icone}</span> {m.rotulo}
                {m.para === "/whatsapp" && naoLidas > 0 && <span className="wa-badge" style={{ marginLeft: "auto" }}>{naoLidas}</span>}
              </NavLink>,
            ];
          })}
        </nav>
        <div className="usuario">
          <div><b>{eu.nome}</b></div>
          <div style={{ opacity: 0.7 }}>{FUNCOES[eu.funcao]}</div>
          <NavLink to="/minha-conta" style={{ color: "#9fd3f7", fontSize: "0.82rem" }}>Trocar minha senha</NavLink>
          <button onClick={sair}>Sair</button>
        </div>
      </aside>
      <main className="conteudo">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/recepcao" element={<Recepcao />} />
          <Route path="/pacientes" element={<Pacientes />} />
          <Route path="/pacientes/novo" element={<PacienteEditar />} />
          <Route path="/pacientes/:id" element={<PacienteFicha />} />
          <Route path="/pacientes/:id/editar" element={<PacienteEditar />} />
          <Route path="/consultorio" element={<Protegida funcoes={["medico", "enfermagem"]}><FilaMedico /></Protegida>} />
          <Route path="/atendimento/:id" element={<Protegida funcoes={["medico", "enfermagem"]}><Atendimento /></Protegida>} />
          <Route path="/cirurgias" element={<Protegida funcoes={["medico", "enfermagem"]}><Cirurgias /></Protegida>} />
          <Route path="/cirurgias/:id" element={<Protegida funcoes={["medico", "enfermagem"]}><CirurgiaDetalhe /></Protegida>} />
          <Route path="/estoque" element={<Protegida funcoes={["medico", "enfermagem", "admin", "faturamento"]}><Estoque /></Protegida>} />
          <Route path="/busca-ativa" element={<Protegida funcoes={["medico", "enfermagem", "recepcao", "admin"]}><BuscaAtiva /></Protegida>} />
          <Route path="/exames" element={<Protegida funcoes={["medico", "enfermagem"]}><Exames /></Protegida>} />
          <Route path="/exames/:id" element={<Protegida funcoes={["medico", "enfermagem"]}><ExameDetalhe /></Protegida>} />
          <Route path="/faturamento" element={<Protegida funcoes={["faturamento", "recepcao", "admin"]}><Faturamento /></Protegida>} />
          <Route path="/faturamento/conta/:id" element={<Protegida funcoes={["faturamento", "recepcao", "admin"]}><ContaDetalhe /></Protegida>} />
          <Route path="/faturamento/lote/:id" element={<Protegida funcoes={["faturamento", "admin"]}><LoteDetalhe /></Protegida>} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/whatsapp" element={<Protegida funcoes={["medico", "enfermagem", "recepcao", "admin", "faturamento"]}><WhatsApp /></Protegida>} />
          <Route path="/whatsapp/assistente" element={<Protegida funcoes={["recepcao", "admin"]}><AssistenteWhatsApp /></Protegida>} />
          <Route path="/cadastros/procedimentos" element={<Protegida funcoes={["faturamento", "admin"]}><Procedimentos /></Protegida>} />
          <Route path="/cadastros/equipe" element={<Protegida funcoes={["admin"]}><Equipe /></Protegida>} />
          <Route path="/cadastros/horarios" element={<Protegida funcoes={["recepcao", "admin"]}><Horarios /></Protegida>} />
          <Route path="/cadastros/convenios" element={<Protegida funcoes={["recepcao", "admin", "faturamento"]}><Convenios /></Protegida>} />
          <Route path="/cadastros/locais" element={<Protegida funcoes={["recepcao", "admin"]}><Locais /></Protegida>} />
          <Route path="/cadastros/exames" element={<Protegida funcoes={["recepcao", "admin"]}><CatalogoExames /></Protegida>} />
          <Route path="/cadastros/ia" element={<Protegida funcoes={["admin"]}><ConfigIA /></Protegida>} />
          <Route path="/cadastros/modelos" element={<Protegida funcoes={["medico", "enfermagem"]}><Modelos /></Protegida>} />
          <Route path="/minha-conta" element={<TrocarSenha />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
