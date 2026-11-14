import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useCarregar, ok, Aviso, Carregando, Campo } from "../components/ui";
import { listaConvenios, listaPlanos, filtroBuscaPaciente } from "../lib/dados";
import { fmtCPF, fmtData, fmtTelefone, idade, nomeExibicao, soNumeros, cpfValido } from "../lib/util";

interface PacLinha {
  id: string; numero_prontuario: number; prontuario_anterior: string | null; nome: string; nome_social: string | null; data_nascimento: string | null;
  cpf: string | null; telefone: string | null; convenios: { nome: string } | null;
}

export default function Pacientes() {
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTermo(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const { dados, erro, carregando } = useCarregar(async () => {
    let q = supabase.from("pacientes")
      .select("id, numero_prontuario, prontuario_anterior, nome, nome_social, data_nascimento, cpf, telefone, convenios(nome)")
      .eq("ativo", true).limit(50);
    if (!termo) q = q.order("criado_em", { ascending: false });
    else q = filtroBuscaPaciente(q.order("nome"), termo, true);
    return ok(await q) as unknown as PacLinha[];
  }, [termo]);
  const nav = useNavigate();

  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>Pacientes</h1>
          <p className="sub" style={{ margin: 0 }}>Busque por nome, CPF, telefone, nome da mãe ou nº do prontuário (novo ou do Micrologos)</p>
        </div>
        <Link className="botao primario" to="/pacientes/novo">➕ Novo paciente</Link>
      </div>
      <div className="painel">
        <input autoFocus placeholder="Digite para buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ marginBottom: 14, fontSize: "1.05rem" }} />
        <Aviso>{erro}</Aviso>
        {carregando && !dados ? <Carregando /> : (
          <div className="rolagem">
            <table className="tabela">
              <thead><tr><th>Pront.</th><th>Nome</th><th>Nascimento</th><th>CPF</th><th>Telefone</th><th>Convênio</th></tr></thead>
              <tbody>
                {(dados ?? []).map((p) => (
                  <tr key={p.id} className="clicavel" onClick={() => nav(`/pacientes/${p.id}`)}>
                    <td>{p.numero_prontuario}{p.prontuario_anterior && <div className="muted pequeno">antigo {p.prontuario_anterior}</div>}</td>
                    <td><b>{nomeExibicao(p)}</b></td>
                    <td>{p.data_nascimento ? `${fmtData(p.data_nascimento)} (${idade(p.data_nascimento)})` : "—"}</td>
                    <td>{fmtCPF(p.cpf) || "—"}</td>
                    <td>{fmtTelefone(p.telefone) || "—"}</td>
                    <td>{p.convenios?.nome ?? "Particular"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dados?.length === 0 && <div className="vazio">Nenhum paciente encontrado. <Link to="/pacientes/novo">Cadastrar novo</Link></div>}
            {!termo && (dados?.length ?? 0) > 0 && <p className="muted pequeno">Mostrando os últimos cadastrados.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

const VAZIO: Record<string, string> = {
  nome: "", nome_social: "", data_nascimento: "", sexo: "nao_informado", cpf: "", cns: "", rg: "", nome_mae: "",
  profissao: "", telefone: "", telefone_secundario: "", email: "", cep: "", logradouro: "", numero: "",
  complemento: "", bairro: "", cidade: "", uf: "", responsavel_nome: "", responsavel_telefone: "",
  responsavel_parentesco: "", convenio_id: "", plano_id: "", convenio_carteirinha: "", prontuario_anterior: "", convenio_validade: "", observacoes: "",
};

export function PacienteEditar() {
  const { id } = useParams();
  const nav = useNavigate();
  const [f, setF] = useState<Record<string, string>>(VAZIO);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const convs = useCarregar(listaConvenios, []);
  const planos = useCarregar(listaPlanos, []);
  const planosDoConvenio = (planos.dados ?? []).filter((x) => x.convenio_id === f.convenio_id);
  const pac = useCarregar(async () => (id ? ok(await supabase.from("pacientes").select("*").eq("id", id).single()) : null), [id]);

  useEffect(() => {
    if (pac.dados) {
      const d = pac.dados as Record<string, unknown>;
      const x: Record<string, string> = {};
      for (const k of Object.keys(VAZIO)) x[k] = (d[k] as string) ?? "";
      setF(x);
    }
  }, [pac.dados]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function buscarCEP() {
    const c = soNumeros(f.cep);
    if (c.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${c}/json/`);
      const j = await r.json();
      if (!j.erro) setF((x) => ({ ...x, logradouro: j.logradouro || x.logradouro, bairro: j.bairro || x.bairro, cidade: j.localidade || x.cidade, uf: j.uf || x.uf }));
    } catch { /* sem internet: preenche à mão */ }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (f.nome.trim().length < 3) return setErro("Informe o nome completo.");
    if (f.cpf && !cpfValido(f.cpf)) return setErro("CPF inválido. Confira os números.");
    if (f.cns && soNumeros(f.cns).length !== 15) return setErro("O Cartão SUS (CNS) tem 15 números.");
    const dados: Record<string, string | null> = {};
    for (const k of Object.keys(VAZIO)) dados[k] = f[k]?.trim() ? f[k].trim() : null;
    dados.nome = f.nome.trim().toUpperCase();
    dados.sexo = f.sexo || "nao_informado";
    for (const k of ["cpf", "cns", "telefone", "telefone_secundario", "responsavel_telefone", "cep"]) dados[k] = dados[k] ? soNumeros(dados[k]!) : null;
    if (dados.uf) dados.uf = dados.uf.toUpperCase().slice(0, 2);
    setSalvando(true);
    const r = id
      ? await supabase.from("pacientes").update(dados).eq("id", id).select("id").single()
      : await supabase.from("pacientes").insert(dados).select("id").single();
    setSalvando(false);
    if (r.error) return setErro(msgErro(r.error));
    nav(`/pacientes/${(r.data as { id: string }).id}`);
  }

  if (id && pac.carregando) return <Carregando />;
  return (
    <form onSubmit={salvar}>
      <div className="cabecalho">
        <div>
          <h1>{id ? "Editar cadastro" : "Novo paciente"}</h1>
          <p className="sub" style={{ margin: 0 }}>Campos com * são obrigatórios. O resto pode ser completado depois.</p>
        </div>
        <div className="linha">
          <button type="button" onClick={() => nav(-1)}>Cancelar</button>
          <button className="primario" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
      <Aviso>{erro || pac.erro}</Aviso>
      <div className="painel">
        <h2>Identificação</h2>
        <div className="grade g4">
          <Campo rotulo="Nome completo *" className="span2"><input value={f.nome} onChange={set("nome")} required /></Campo>
          <Campo rotulo="Nome social"><input value={f.nome_social} onChange={set("nome_social")} /></Campo>
          <Campo rotulo="Data de nascimento"><input type="date" value={f.data_nascimento} onChange={set("data_nascimento")} /></Campo>
          <Campo rotulo="Sexo">
            <select value={f.sexo} onChange={set("sexo")}>
              <option value="nao_informado">Não informado</option><option value="feminino">Feminino</option>
              <option value="masculino">Masculino</option><option value="intersexo">Intersexo</option>
            </select>
          </Campo>
          <Campo rotulo="CPF"><input value={fmtCPF(f.cpf)} onChange={set("cpf")} inputMode="numeric" /></Campo>
          <Campo rotulo="RG"><input value={f.rg} onChange={set("rg")} /></Campo>
          <Campo rotulo="Cartão SUS (CNS)"><input value={f.cns} onChange={set("cns")} inputMode="numeric" /></Campo>
          <Campo rotulo="Nome da mãe" className="span2"><input value={f.nome_mae} onChange={set("nome_mae")} /></Campo>
          <Campo rotulo="Profissão"><input value={f.profissao} onChange={set("profissao")} /></Campo>
          <Campo rotulo="Nº do prontuário no Micrologos"><input value={f.prontuario_anterior} onChange={set("prontuario_anterior")} /></Campo>
        </div>
      </div>
      <div className="painel">
        <h2>Contato e endereço</h2>
        <div className="grade g4">
          <Campo rotulo="Telefone / WhatsApp"><input value={fmtTelefone(f.telefone)} onChange={set("telefone")} inputMode="tel" /></Campo>
          <Campo rotulo="Outro telefone"><input value={fmtTelefone(f.telefone_secundario)} onChange={set("telefone_secundario")} inputMode="tel" /></Campo>
          <Campo rotulo="E-mail" className="span2"><input type="email" value={f.email} onChange={set("email")} /></Campo>
          <Campo rotulo="CEP (preenche o endereço)"><input value={f.cep} onChange={set("cep")} onBlur={buscarCEP} inputMode="numeric" /></Campo>
          <Campo rotulo="Rua / avenida" className="span2"><input value={f.logradouro} onChange={set("logradouro")} /></Campo>
          <Campo rotulo="Número"><input value={f.numero} onChange={set("numero")} /></Campo>
          <Campo rotulo="Complemento"><input value={f.complemento} onChange={set("complemento")} /></Campo>
          <Campo rotulo="Bairro"><input value={f.bairro} onChange={set("bairro")} /></Campo>
          <Campo rotulo="Cidade"><input value={f.cidade} onChange={set("cidade")} /></Campo>
          <Campo rotulo="UF"><input value={f.uf} onChange={set("uf")} maxLength={2} /></Campo>
        </div>
      </div>
      <div className="painel">
        <h2>Convênio</h2>
        <div className="grade g4">
          <Campo rotulo="Convênio">
            <select value={f.convenio_id} onChange={(e) => setF({ ...f, convenio_id: e.target.value, plano_id: "" })}>
              <option value="">Particular</option>
              {(convs.dados ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
          {planosDoConvenio.length > 0 && (
            <Campo rotulo="Plano">
              <select value={f.plano_id} onChange={set("plano_id")}>
                <option value="">—</option>
                {planosDoConvenio.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select>
            </Campo>
          )}
          <Campo rotulo="Nº da carteirinha"><input value={f.convenio_carteirinha} onChange={set("convenio_carteirinha")} /></Campo>
          <Campo rotulo="Validade"><input type="date" value={f.convenio_validade} onChange={set("convenio_validade")} /></Campo>
        </div>
      </div>
      <div className="painel">
        <h2>Responsável (menores ou pacientes com acompanhante)</h2>
        <div className="grade g4">
          <Campo rotulo="Nome do responsável" className="span2"><input value={f.responsavel_nome} onChange={set("responsavel_nome")} /></Campo>
          <Campo rotulo="Parentesco"><input value={f.responsavel_parentesco} onChange={set("responsavel_parentesco")} /></Campo>
          <Campo rotulo="Telefone"><input value={fmtTelefone(f.responsavel_telefone)} onChange={set("responsavel_telefone")} /></Campo>
          <Campo rotulo="Observações administrativas" className="inteiro"><textarea value={f.observacoes} onChange={set("observacoes")} placeholder="Ex.: prefere contato por WhatsApp; precisa de cadeira de rodas…" /></Campo>
        </div>
      </div>
    </form>
  );
}
