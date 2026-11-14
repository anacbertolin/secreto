import { useState, type ReactNode } from "react";
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

interface ItemMenu { para: string; rotulo: string; icone: string; funcoes?: Funcao[]; grupo?: string }

const MENU: ItemMenu[] = [
  { para: "/", rotulo: "Início", icone: "🏠" },
  { para: "/agenda", rotulo: "Agenda", icone: "📅" },
  { para: "/recepcao", rotulo: "Recepção", icone: "🛎️" },
  { para: "/pacientes", rotulo: "Pacientes", icone: "👤" },
  { para: "/consultorio", rotulo: "Consultório", icone: "🩺", funcoes: ["medico", "enfermagem"] },
  { para: "/exames", rotulo: "Exames e laudos", icone: "🔬", funcoes: ["medico", "enfermagem"] },
  { grupo: "Cadastros", para: "/cadastros/equipe", rotulo: "Equipe", icone: "👥", funcoes: ["admin"] },
  { para: "/cadastros/horarios", rotulo: "Horários e bloqueios", icone: "🕒", funcoes: ["recepcao", "admin"] },
  { para: "/cadastros/convenios", rotulo: "Convênios", icone: "💳", funcoes: ["recepcao", "admin"] },
  { para: "/cadastros/locais", rotulo: "Salas e consultórios", icone: "🚪", funcoes: ["recepcao", "admin"] },
  { para: "/cadastros/exames", rotulo: "Tipos de exame", icone: "📋", funcoes: ["recepcao", "admin"] },
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
              <NavLink key={m.para} to={m.para} end={m.para === "/"}>
                <span aria-hidden>{m.icone}</span> {m.rotulo}
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
          <Route path="/exames" element={<Protegida funcoes={["medico", "enfermagem"]}><Exames /></Protegida>} />
          <Route path="/exames/:id" element={<Protegida funcoes={["medico", "enfermagem"]}><ExameDetalhe /></Protegida>} />
          <Route path="/cadastros/equipe" element={<Protegida funcoes={["admin"]}><Equipe /></Protegida>} />
          <Route path="/cadastros/horarios" element={<Protegida funcoes={["recepcao", "admin"]}><Horarios /></Protegida>} />
          <Route path="/cadastros/convenios" element={<Protegida funcoes={["recepcao", "admin"]}><Convenios /></Protegida>} />
          <Route path="/cadastros/locais" element={<Protegida funcoes={["recepcao", "admin"]}><Locais /></Protegida>} />
          <Route path="/cadastros/exames" element={<Protegida funcoes={["recepcao", "admin"]}><CatalogoExames /></Protegida>} />
          <Route path="/cadastros/modelos" element={<Protegida funcoes={["medico", "enfermagem"]}><Modelos /></Protegida>} />
          <Route path="/minha-conta" element={<TrocarSenha />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
