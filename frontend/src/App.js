import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import axios from "axios";
import { supabase } from "./supabaseClient";
import "./App.css";
import Login from "./Login";
import SuporteAluno from "./SuporteAluno";
import AtendimentoChat from "./AtendimentoChat";

import { Button } from "primereact/button";
import { InputTextarea } from "primereact/inputtextarea";
import { InputText } from "primereact/inputtext";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Tag } from "primereact/tag";
import { TabView, TabPanel } from "primereact/tabview";

import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

function AppRouter() {
  if (window.location.pathname === "/suporte") {
    return <SuporteAluno />;
  }
  return <App />;
}

function App() {
  const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:3001";

  const [token, setToken] = useState(localStorage.getItem("token"));
  const [nomeUsuario, setNomeUsuario] = useState(localStorage.getItem("nomeUsuario") || "");
  const [todosAlunos, setTodosAlunos] = useState([]);
  const [alunosPendentes, setAlunosPendentes] = useState([]);
  const [selecionados, setSelecionados] = useState([]);
  const [selecionadosPendentes, setSelecionadosPendentes] = useState([]);
  const [mensagem, setMensagem] = useState("Olá {nome}, confirmamos sua inscrição no curso de {curso}!");
  const [assunto, setAssunto] = useState("[Geração Tech] Confirmação de Matrícula");
  const [corpoEmail, setCorpoEmail] = useState("Olá {nome}, confirmamos sua inscrição no curso de {curso}.\n\nFique atento às próximas comunicações da equipe.");
  const [loading, setLoading] = useState(false);
  const [filtroGlobal, setFiltroGlobal] = useState("");
  const [filtroEnvio, setFiltroEnvio] = useState("");
  const [activeIndex, setActiveIndex] = useState(parseInt(localStorage.getItem("activeTab") || "0", 10));
  const fileInputRef = useRef(null);
  const fileEmailInputRef = useRef(null);

  // ── Estados do Chat WhatsApp ───────────────────────────────────────────────
  const [alunoChat, setAlunoChat] = useState(null);
  const [msgWhats, setMsgWhats] = useState("");
  const [enviandoWhats, setEnviandoWhats] = useState(false);
  const [mostrarEmoji, setMostrarEmoji] = useState(false);
  const [gravandoAudio, setGravandoAudio] = useState(false);
  const chatEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // ── Estados do modal de adicionar aluno ───────────────────────────────────
  const [modalAluno, setModalAluno] = useState(false);
  const [novoAluno, setNovoAluno] = useState({ nome: "", telefone: "", curso: "", email: "" });
  const [salvandoAluno, setSalvandoAluno] = useState(false);
  const [erroAluno, setErroAluno] = useState("");

  // ── Scroll automático ─────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [alunoChat]);

  useEffect(() => {
    if (alunoChat) {
      const atualizado = todosAlunos.find((a) => a.id === alunoChat.id);
      if (atualizado) setAlunoChat(atualizado);
    }
  }, [todosAlunos]);

  // ── Fecha emoji ao clicar fora ────────────────────────────────────────────
  useEffect(() => {
    const fechar = (e) => {
      if (!e.target.closest(".whats-emoji-wrapper")) setMostrarEmoji(false);
    };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  // ── Gravação de áudio ─────────────────────────────────────────────────────
  const iniciarGravacao = async (e) => {
    e.preventDefault();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (ev) => audioChunksRef.current.push(ev.data);
      mediaRecorder.start();
      setGravandoAudio(true);
    } catch {
      alert("Permita o acesso ao microfone para gravar áudio.");
    }
  };

  const pararGravacao = async (e) => {
    e.preventDefault();
    if (!mediaRecorderRef.current || !gravandoAudio) return;
    setGravandoAudio(false);
    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: "audio/ogg; codecs=opus" });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result;
        try {
          await axios.post(
            `${BACKEND}/send-audio`,
            { student: alunoChat, audioBase64: base64 },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch {
          alert("Erro ao enviar áudio. Verifique se o backend está rodando.");
        }
      };
      reader.readAsDataURL(blob);
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    };
    mediaRecorderRef.current.stop();
  };

  // ── Enviar mensagem WhatsApp ──────────────────────────────────────────────
  const enviarMensagemWhats = async () => {
    if (!msgWhats.trim() || !alunoChat || enviandoWhats) return;
    setEnviandoWhats(true);
    try {
      await axios.post(
        `${BACKEND}/send-bulk`,
        { message: msgWhats, students: [alunoChat], limit: 1 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMsgWhats("");
    } catch {
      alert("Erro ao enviar. Verifique se o backend está rodando.");
    } finally {
      setEnviandoWhats(false);
    }
  };

  // ── Renderiza mídias do histórico ─────────────────────────────────────────
  const renderMidia = (msg) => {
    const texto = msg.texto || "";

    if (msg.mimetype?.startsWith("audio") || texto.startsWith("data:audio") || /\.(ogg|mp3|opus|m4a|wav)$/i.test(texto)) {
      const src = texto.startsWith("data:") ? texto : (msg.mediaUrl || texto);
      return (
        <div className="whats-midia-audio">
          <i className="pi pi-microphone" />
          <audio controls src={src} style={{ maxWidth: "220px", height: "36px" }}>Seu navegador não suporta áudio.</audio>
        </div>
      );
    }

    if (msg.mimetype?.startsWith("image") || texto.startsWith("data:image") || /\.(jpg|jpeg|png|gif|webp)$/i.test(texto)) {
      const src = texto.startsWith("data:") ? texto : (msg.mediaUrl || texto);
      return <img src={src} alt="imagem" className="whats-midia-img" onClick={() => window.open(src, "_blank")} />;
    }

    if (msg.mimetype === "application/pdf" || texto.startsWith("data:application") || /\.(pdf|doc|docx|xlsx|zip)$/i.test(texto)) {
      const src = msg.mediaUrl || texto;
      return (
        <a href={src} target="_blank" rel="noreferrer" className="whats-midia-arquivo">
          <i className="pi pi-file" />
          <span>{msg.filename || "Arquivo anexado"}</span>
          <i className="pi pi-download" />
        </a>
      );
    }

    return <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{texto}</span>;
  };

  // ── Carrega dados ─────────────────────────────────────────────────────────
  const carregarDados = async () => {
    const { data, error } = await supabase.from("alunos").select("*").order("created_at", { ascending: false });
    if (error) { console.error("Erro ao carregar alunos:", error); return; }
    if (data) {
      setTodosAlunos(data);
      setAlunosPendentes(data.filter((a) => a.status === "pendente"));
    }
  };

  useEffect(() => {
    if (!token) return;
    carregarDados();
    const channel = supabase
      .channel("alunos_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "alunos" }, () => carregarDados())
      .subscribe((status) => { if (status === "SUBSCRIBED") console.log("✅ Realtime conectado na tabela alunos"); });
    return () => supabase.removeChannel(channel);
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("nomeUsuario");
    setToken(null);
    setNomeUsuario("");
  };

  const onTabChange = (e) => {
    setActiveIndex(e.index);
    localStorage.setItem("activeTab", e.index.toString());
  };

  if (!token) {
    return <Login onLogin={(t) => { setToken(t); setNomeUsuario(localStorage.getItem("nomeUsuario") || ""); }} />;
  }

  // ── Adicionar aluno manualmente ───────────────────────────────────────────
  const salvarNovoAluno = async () => {
    if (!novoAluno.nome.trim() || !novoAluno.telefone.trim()) {
      setErroAluno("Nome e telefone são obrigatórios.");
      return;
    }
    setSalvandoAluno(true);
    setErroAluno("");
    const { error } = await supabase.from("alunos").insert([{
      nome: novoAluno.nome.trim(),
      telefone: novoAluno.telefone.trim(),
      curso: novoAluno.curso.trim() || "Não informado",
      email: novoAluno.email.trim() || "",
      status: "pendente",
      respondeu: false,
    }]);
    setSalvandoAluno(false);
    if (error) {
      setErroAluno("Erro ao salvar: " + error.message);
    } else {
      setModalAluno(false);
      setNovoAluno({ nome: "", telefone: "", curso: "", email: "" });
      carregarDados();
    }
  };

  // ── Importar Excel ────────────────────────────────────────────────────────
  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(ws);
      const alunos = rawData.map((row) => {
        const nome = row.nome || row.Nome || row.NOME;
        const telefone = row.telefone || row.Telefone || row.TELEFONE;
        const curso = row.curso || row.Curso || row.CURSO;
        const email = row.email || row.Email || row.EMAIL;
        if (nome && (telefone || email)) {
          return { nome, telefone: telefone ? String(telefone).trim() : "Não informado", curso: curso || "Não informado", email: email || "", status: "pendente", respondeu: false };
        }
        return null;
      }).filter(Boolean);
      if (alunos.length === 0) { alert("Nenhum aluno válido encontrado. Verifique as colunas: nome, telefone, curso, email."); return; }
      const { error } = await supabase.from("alunos").insert(alunos);
      if (error) alert(`Erro: ${error.message}`);
      else { alert(`✅ ${alunos.length} aluno(s) importado(s) com sucesso!`); carregarDados(); }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  // ── Disparos ──────────────────────────────────────────────────────────────
  const dispararLote = async () => {
    if (alunosPendentes.length === 0) return;
    setLoading(true);
    try {
      await axios.post(`${BACKEND}/send-bulk`, { message: mensagem, students: alunosPendentes, limit: 50 }, { headers: { Authorization: `Bearer ${token}` } });
      alert("Lote iniciado! Acompanhe os status na tabela.");
    } catch { alert("Erro: verifique se o backend está rodando e o WhatsApp conectado."); }
    finally { setLoading(false); setTimeout(carregarDados, 3000); }
  };

  const dispararSelecionados = async () => {
    if (selecionadosPendentes.length === 0) return;
    setLoading(true);
    try {
      await axios.post(`${BACKEND}/send-bulk`, { message: mensagem, students: selecionadosPendentes, limit: selecionadosPendentes.length }, { headers: { Authorization: `Bearer ${token}` } });
      alert(`Disparo iniciado para ${selecionadosPendentes.length} aluno(s)!`);
      setSelecionadosPendentes([]);
    } catch { alert("Erro ao conectar com o servidor."); }
    finally { setLoading(false); }
  };

  const dispararEmails = async () => {
    if (selecionados.length === 0) return;
    if (!assunto || !corpoEmail) { alert("Preencha o assunto e o corpo do e-mail."); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${BACKEND}/send-email-bulk`, { students: selecionados, subject: assunto, messageBody: corpoEmail }, { headers: { Authorization: `Bearer ${token}` } });
      const { message, falhas } = res.data;
      let aviso = `✅ ${message}`;
      if (falhas?.length > 0) aviso += `\n\n⚠️ Falhas (${falhas.length}):\n` + falhas.map((f) => `• ${f.nome}: ${f.motivo}`).join("\n");
      alert(aviso);
      setSelecionados([]);
      carregarDados();
    } catch (err) { alert("Falha no disparo. " + (err.response?.data?.error || "Verifique o servidor.")); }
    finally { setLoading(false); }
  };

  // ── Exclusões ─────────────────────────────────────────────────────────────
  const excluirContato = async (id) => {
    if (!window.confirm("Excluir este aluno definitivamente?")) return;
    const { error } = await supabase.from("alunos").delete().eq("id", id);
    if (error) alert("Erro ao excluir."); else carregarDados();
  };

  const excluirEmMassa = async (lista, setLista) => {
    if (lista.length === 0) return;
    if (!window.confirm(`Excluir ${lista.length} contato(s)?`)) return;
    const ids = lista.map((s) => s.id).filter(Boolean);
    const { error } = await supabase.from("alunos").delete().in("id", ids);
    if (error) alert("Erro ao excluir.");
    else { setLista([]); carregarDados(); }
  };

  const onRowEditComplete = async (e) => {
    const { newData } = e;
    await supabase.from("alunos").update({ nome: newData.nome, telefone: newData.telefone, curso: newData.curso, email: newData.email, status: newData.status, ultima_resposta: newData.ultima_resposta }).eq("id", newData.id);
    carregarDados();
  };

  const exportarRelatorio = () => {
    const dados = todosAlunos.map((a) => ({ Nome: a.nome, Telefone: a.telefone, Curso: a.curso, Email: a.email || "", Status: a.status, Respondeu: a.respondeu ? "SIM" : "NÃO", "Última Resposta": a.ultima_resposta || "", "Data Envio": a.data_envio ? new Date(a.data_envio).toLocaleString("pt-BR") : "" }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `Relatorio_Alunos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── Templates ─────────────────────────────────────────────────────────────
  const statusTemplate = (row) => {
    const map = { pendente: "warning", enviado: "success", email_enviado: "info", concluido: "success", erro: "danger" };
    return <Tag value={row.status} severity={map[row.status] || "warning"} />;
  };

  const respondeuTemplate = (row) => <Tag value={row.respondeu ? "SIM" : "NÃO"} severity={row.respondeu ? "success" : "danger"} />;

  const textEditor = (options) => <InputText value={options.value} onChange={(e) => options.editorCallback(e.target.value)} style={{ width: "100%" }} />;

  // ── Stats ─────────────────────────────────────────────────────────────────
  const total = todosAlunos.length;
  const contatados = todosAlunos.filter((a) => a.status !== "pendente").length;
  const responderam = todosAlunos.filter((a) => a.respondeu).length;
  const pendentes = todosAlunos.filter((a) => a.status === "pendente").length;
  const taxaEngajamento = total > 0 ? ((responderam / total) * 100).toFixed(1) : "0.0";
  const taxaContato = total > 0 ? ((contatados / total) * 100).toFixed(1) : "0.0";

  const alunosFiltradosGestao = todosAlunos.filter((a) => {
    if (!filtroGlobal) return true;
    const q = filtroGlobal.toLowerCase();
    return a.nome?.toLowerCase().includes(q) || a.telefone?.toLowerCase().includes(q) || a.curso?.toLowerCase().includes(q) || a.status?.toLowerCase().includes(q);
  });

  const alunosFiltradosEnvio = alunosPendentes.filter((a) => {
    if (!filtroEnvio) return true;
    const q = filtroEnvio.toLowerCase();
    return a.nome?.toLowerCase().includes(q) || a.telefone?.includes(q);
  });

  const EMOJIS = ["😊","😂","❤️","👍","🙏","😍","🎉","😢","😮","🔥","✅","👋","💪","🤔","😅","🥰","👏","😭","🚀","💡","⭐","🎯","📱","💬","✨"];

  return (
    <div className="app-root">
      {/* ── Modal Adicionar Aluno ─────────────────────────────────────────── */}
      {modalAluno && (
        <div className="modal-overlay" onClick={() => setModalAluno(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Adicionar Aluno</h3>
              <button className="modal-close" onClick={() => setModalAluno(false)}>✕</button>
            </div>
            <div className="modal-body">
              {erroAluno && <div className="modal-erro">{erroAluno}</div>}
              <div className="modal-field">
                <label>Nome completo <span className="obrigatorio">*</span></label>
                <InputText value={novoAluno.nome} onChange={(e) => setNovoAluno({ ...novoAluno, nome: e.target.value })} placeholder="Ex: Maria Silva" style={{ width: "100%" }} autoFocus />
              </div>
              <div className="modal-field">
                <label>Telefone (WhatsApp) <span className="obrigatorio">*</span></label>
                <InputText value={novoAluno.telefone} onChange={(e) => setNovoAluno({ ...novoAluno, telefone: e.target.value })} placeholder="Ex: 85 9 9999-9999" style={{ width: "100%" }} />
              </div>
              <div className="modal-field">
                <label>Formação <span className="opcional">(opcional)</span></label>
                <InputText value={novoAluno.curso} onChange={(e) => setNovoAluno({ ...novoAluno, curso: e.target.value })} placeholder="Ex: Full Stack" style={{ width: "100%" }} />
              </div>
              <div className="modal-field">
                <label>E-mail <span className="opcional">(opcional)</span></label>
                <InputText value={novoAluno.email} onChange={(e) => setNovoAluno({ ...novoAluno, email: e.target.value })} placeholder="Ex: maria@email.com" style={{ width: "100%" }} type="email" />
              </div>
            </div>
            <div className="modal-footer">
              <Button label="Cancelar" className="p-button-text" onClick={() => setModalAluno(false)} />
              <Button label={salvandoAluno ? "Salvando..." : "Adicionar"} icon="pi pi-check" onClick={salvarNovoAluno} disabled={salvandoAluno} />
            </div>
          </div>
        </div>
      )}

      {/* ── Topbar ────────────────────────────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-logo">GT</div>
          <div>
            <span className="topbar-title">Geração Tech CRM</span>
            <span className="topbar-sub">3.0 — Sistema de Gestão</span>
          </div>
        </div>
        <div className="topbar-right">
          {nomeUsuario && <span className="topbar-user"><i className="pi pi-user" /> {nomeUsuario}</span>}
          <a href="/manual.html" target="_blank" rel="noreferrer" className="topbar-manual" title="Manual de Uso"><i className="pi pi-book" /> Manual</a>
          <button className="topbar-logout" onClick={handleLogout}><i className="pi pi-sign-out" /> Sair</button>
        </div>
      </header>

      {/* ── Conteúdo ──────────────────────────────────────────────────────── */}
      <main className="main-content">
        <TabView activeIndex={activeIndex} onTabChange={onTabChange}>

          {/* ══ Aba 1: Disparo WhatsApp ══════════════════════════════════════ */}
          <TabPanel header="Disparo WhatsApp" leftIcon="pi pi-whatsapp mr-2">
            <div className="card mb-4">
              <div className="card-header">
                <div>
                  <h3>Importar Planilha & Configurar Mensagem</h3>
                  <p>Colunas esperadas: nome, telefone, curso, email</p>
                </div>
                <div className="flex-gap">
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} style={{ display: "none" }} />
                  <Button icon="pi pi-user-plus" label="Adicionar Aluno" className="p-button-success p-button-outlined" onClick={() => { setModalAluno(true); setErroAluno(""); }} />
                  <Button icon="pi pi-upload" label="Importar Excel" className="p-button-outlined" onClick={() => fileInputRef.current?.click()} />
                  <Button icon="pi pi-refresh" className="p-button-text" onClick={carregarDados} tooltip="Atualizar lista" />
                </div>
              </div>
              <div className="card-body">
                <label className="field-label">Mensagem (use {"{nome}"} e {"{curso}"})</label>
                <InputTextarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={4} style={{ width: "100%" }} placeholder="Olá {nome}, confirmamos sua inscrição no curso de {curso}!" />
                <div className="flex-gap mt-3">
                  <Button label={loading ? "Enviando..." : `Disparar Lote (${alunosFiltradosEnvio.length} pendentes)`} icon="pi pi-send" onClick={dispararLote} disabled={loading || alunosFiltradosEnvio.length === 0} />
                  <Button label={`Enviar Selecionados (${selecionadosPendentes.length})`} icon="pi pi-check-circle" className="p-button-success" onClick={dispararSelecionados} disabled={loading || selecionadosPendentes.length === 0} />
                  {selecionadosPendentes.length > 0 && (
                    <Button label="Excluir Selecionados" icon="pi pi-trash" className="p-button-danger p-button-outlined" onClick={() => excluirEmMassa(selecionadosPendentes, setSelecionadosPendentes)} />
                  )}
                </div>
              </div>
            </div>

            <div className="table-toolbar">
              <span className="p-input-icon-left">
                <i className="pi pi-search" />
                <InputText value={filtroEnvio} onChange={(e) => setFiltroEnvio(e.target.value)} placeholder="Buscar por nome ou telefone..." className="search-input" />
              </span>
              <span className="table-count">{alunosFiltradosEnvio.length} contato(s) pendente(s)</span>
            </div>

            <DataTable value={alunosFiltradosEnvio} selection={selecionadosPendentes} onSelectionChange={(e) => setSelecionadosPendentes(e.value)} dataKey="id" paginator rows={10} rowsPerPageOptions={[10, 25, 50]} emptyMessage="Nenhum contato pendente." className="crm-table" stripedRows>
              <Column selectionMode="multiple" style={{ width: "3rem" }} />
              <Column field="nome" header="Nome" sortable />
              <Column field="telefone" header="Telefone" />
              <Column field="curso" header="Curso" sortable />
              <Column header="Status" body={statusTemplate} />
            </DataTable>
          </TabPanel>

          {/* ══ Aba 2: Gestão & Relatórios ══════════════════════════════════ */}
          <TabPanel header="Gestão & Relatórios" leftIcon="pi pi-users mr-2">
            <div className="card mb-4">
              <div className="card-header">
                <div>
                  <h3>Contatos Pendentes</h3>
                  <p>Selecione para excluir em massa</p>
                </div>
                <div className="flex-gap">
                  <Button icon="pi pi-user-plus" label="Adicionar Aluno" className="p-button-success p-button-outlined" onClick={() => { setModalAluno(true); setErroAluno(""); }} />
                  {selecionados.length > 0 && (
                    <Button label={`Excluir (${selecionados.length})`} icon="pi pi-trash" className="p-button-danger" onClick={() => excluirEmMassa(selecionados, setSelecionados)} />
                  )}
                </div>
              </div>
              <div className="card-body">
                <DataTable value={todosAlunos.filter((a) => a.status === "pendente")} selection={selecionados} onSelectionChange={(e) => setSelecionados(e.value)} dataKey="id" paginator rows={5} emptyMessage="Nenhum contato pendente." className="crm-table">
                  <Column selectionMode="multiple" style={{ width: "3rem" }} />
                  <Column field="nome" header="Nome" />
                  <Column field="telefone" header="Telefone" />
                  <Column field="curso" header="Curso" />
                </DataTable>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <h3>Histórico Geral</h3>
                  <p>Clique no lápis para editar um contato</p>
                </div>
                <div className="flex-gap">
                  <span className="p-input-icon-left">
                    <i className="pi pi-search" />
                    <InputText value={filtroGlobal} onChange={(e) => setFiltroGlobal(e.target.value)} placeholder="Buscar..." className="search-input" />
                  </span>
                  <Button label="Exportar Excel" icon="pi pi-file-excel" className="p-button-success" onClick={exportarRelatorio} />
                </div>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <DataTable value={alunosFiltradosGestao} editMode="row" onRowEditComplete={onRowEditComplete} dataKey="id" paginator rows={10} rowsPerPageOptions={[10, 25, 50]} emptyMessage="Nenhum registro encontrado." className="crm-table" stripedRows>
                  <Column field="nome" header="Nome" editor={textEditor} sortable />
                  <Column field="telefone" header="Telefone" editor={textEditor} />
                  <Column field="curso" header="Curso" editor={textEditor} />
                  <Column field="email" header="E-mail" editor={textEditor} />
                  <Column header="Status" body={statusTemplate} editor={textEditor} />
                  <Column header="Respondeu" body={respondeuTemplate} />
                  <Column field="ultima_resposta" header="Feedback" editor={textEditor} />
                  <Column rowEditor style={{ width: "6rem" }} />
                  <Column body={(row) => <Button icon="pi pi-trash" className="p-button-danger p-button-text p-button-sm" onClick={() => excluirContato(row.id)} tooltip="Excluir" />} style={{ width: "4rem" }} />
                </DataTable>
              </div>
            </div>
          </TabPanel>

          {/* ══ Aba 3: Chat WhatsApp ═════════════════════════════════════════ */}
          <TabPanel header="Chat WhatsApp" leftIcon="pi pi-whatsapp mr-2">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>Conversas WhatsApp</h3>
                  <p>Histórico e respostas em tempo real por contato</p>
                </div>
              </div>
              <div className="whats-chat-layout">
                <div className="whats-sidebar">
                  <div className="whats-sidebar-header">Contatos</div>
                  {todosAlunos.filter((a) => a.status !== "pendente").length === 0 ? (
                    <div className="whats-empty"><i className="pi pi-inbox" /><p>Nenhum contato ainda</p></div>
                  ) : (
                    todosAlunos.filter((a) => a.status !== "pendente").map((aluno) => (
                      <div key={aluno.id} className={"whats-contact " + (alunoChat?.id === aluno.id ? "whats-contact-ativo" : "")} onClick={() => setAlunoChat(aluno)}>
                        <div className="whats-avatar">{aluno.nome?.charAt(0).toUpperCase()}</div>
                        <div className="whats-contact-info">
                          <strong>{aluno.nome}</strong>
                          <span>{aluno.ultima_resposta ? aluno.ultima_resposta.substring(0, 28) + "..." : "Sem mensagens"}</span>
                        </div>
                        {aluno.respondeu && aluno.status !== "concluido" && <span className="whats-badge-new">NOVO</span>}
                      </div>
                    ))
                  )}
                </div>

                <div className="whats-chat">
                  {alunoChat ? (
                    <>
                      <div className="whats-chat-header">
                        <div className="whats-avatar">{alunoChat.nome?.charAt(0).toUpperCase()}</div>
                        <div>
                          <strong>{alunoChat.nome}</strong>
                          <span>{alunoChat.telefone}</span>
                        </div>
                        <Tag value={alunoChat.status} severity={alunoChat.status === "concluido" || alunoChat.status === "enviado" ? "success" : "warning"} />
                      </div>

                      <div className="whats-messages">
                        {!alunoChat.historico || alunoChat.historico.length === 0 ? (
                          <div className="whats-msg-vazio">Nenhuma mensagem ainda nesta conversa.</div>
                        ) : (
                          alunoChat.historico.map((msg, i) => (
                            <div key={i} className={"whats-bubble " + (msg.tipo === "saida" ? "whats-bubble-saida" : "whats-bubble-entrada")}>
                              {renderMidia(msg)}
                              <time>{new Date(msg.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
                            </div>
                          ))
                        )}
                        <div ref={chatEndRef} />
                      </div>

                      <div className="whats-input-area">
                        {/* Emoji */}
                        <div className="whats-emoji-wrapper">
                          <button className="whats-btn-icon" title="Emojis" onClick={() => setMostrarEmoji((v) => !v)} type="button">😊</button>
                          {mostrarEmoji && (
                            <div className="whats-emoji-picker">
                              {EMOJIS.map((emoji) => (
                                <button key={emoji} className="whats-emoji-btn" onClick={() => { setMsgWhats((v) => v + emoji); setMostrarEmoji(false); }}>{emoji}</button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Áudio */}
                        <button
                          className={"whats-btn-icon " + (gravandoAudio ? "whats-btn-gravando" : "")}
                          title={gravandoAudio ? "Solte para enviar" : "Segure para gravar áudio"}
                          onMouseDown={iniciarGravacao}
                          onMouseUp={pararGravacao}
                          onTouchStart={iniciarGravacao}
                          onTouchEnd={pararGravacao}
                          type="button"
                        >
                          🎤
                        </button>

                        <input
                          type="text"
                          placeholder={gravandoAudio ? "🔴 Gravando... solte para enviar" : "Responder via WhatsApp..."}
                          value={msgWhats}
                          onChange={(e) => setMsgWhats(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && enviarMensagemWhats()}
                          disabled={gravandoAudio}
                        />
                        <button onClick={enviarMensagemWhats} disabled={enviandoWhats || !msgWhats.trim() || gravandoAudio} className="whats-btn-send">
                          <i className="pi pi-send" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="whats-placeholder">
                      <i className="pi pi-comments" />
                      <p>Selecione um contato para ver a conversa</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabPanel>

          {/* ══ Aba 4: Suporte ao Aluno ══════════════════════════════════════ */}
          <TabPanel header="Suporte ao Aluno" leftIcon="pi pi-headphones mr-2">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>Chat de Suporte em Tempo Real</h3>
                  <p>Responda os chamados abertos pelos alunos via portal</p>
                </div>
                <a href="/suporte" target="_blank" rel="noreferrer" className="link-suporte">
                  <i className="pi pi-external-link" /> Abrir Portal do Aluno
                </a>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <AtendimentoChat />
              </div>
            </div>
          </TabPanel>

          {/* ══ Aba 5: Disparo E-mail ═════════════════════════════════════════ */}
          <TabPanel header="Disparo E-mail" leftIcon="pi pi-envelope mr-2">
            <div className="card mb-4">
              <div className="card-header">
                <div>
                  <h3>1. Selecionar Destinatários</h3>
                  <p>Apenas alunos com e-mail cadastrado aparecem aqui</p>
                </div>
                <div className="flex-gap">
                  <input ref={fileEmailInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} style={{ display: "none" }} />
                  <Button icon="pi pi-upload" label="Importar Excel" className="p-button-outlined" onClick={() => fileEmailInputRef.current?.click()} />
                </div>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <DataTable value={todosAlunos.filter((a) => a.email)} selection={selecionados} onSelectionChange={(e) => setSelecionados(e.value)} dataKey="id" paginator rows={5} emptyMessage="Nenhum aluno com e-mail encontrado. Importe uma planilha com a coluna 'email'." className="crm-table">
                  <Column selectionMode="multiple" style={{ width: "3rem" }} />
                  <Column field="nome" header="Nome" sortable />
                  <Column field="email" header="E-mail" />
                  <Column field="curso" header="Curso" />
                  <Column header="Status" body={statusTemplate} />
                </DataTable>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <h3>2. Configurar E-mail</h3>
                  <p>Use {"{nome}"} e {"{curso}"} como variáveis personalizadas</p>
                </div>
              </div>
              <div className="card-body">
                <div className="email-field">
                  <label>Assunto</label>
                  <InputText value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="[Geração Tech] Confirmação de Matrícula" style={{ width: "100%" }} />
                </div>
                <div className="email-field mt-3">
                  <label>Corpo da mensagem</label>
                  <InputTextarea value={corpoEmail} onChange={(e) => setCorpoEmail(e.target.value)} rows={6} style={{ width: "100%" }} placeholder="Olá {nome}, confirmamos sua inscrição no curso de {curso}..." />
                </div>
                <Button label={loading ? "Enviando..." : `Enviar para ${selecionados.length} destinatário(s)`} icon="pi pi-send" className="p-button-success mt-3" onClick={dispararEmails} disabled={loading || selecionados.length === 0} />
              </div>
            </div>
          </TabPanel>

          {/* ══ Aba 6: Dashboard ═════════════════════════════════════════════ */}
          <TabPanel header="Dashboard" leftIcon="pi pi-chart-bar mr-2">
            <div className="stats-grid">
              <div className="stat-card stat-blue"><div className="stat-icon"><i className="pi pi-users" /></div><div className="stat-body"><span>Total de Alunos</span><strong>{total}</strong></div></div>
              <div className="stat-card stat-orange"><div className="stat-icon"><i className="pi pi-clock" /></div><div className="stat-body"><span>Pendentes</span><strong>{pendentes}</strong></div></div>
              <div className="stat-card stat-green"><div className="stat-icon"><i className="pi pi-send" /></div><div className="stat-body"><span>Contatados</span><strong>{contatados}</strong></div></div>
              <div className="stat-card stat-purple"><div className="stat-icon"><i className="pi pi-comments" /></div><div className="stat-body"><span>Responderam</span><strong>{responderam}</strong></div></div>
            </div>

            <div className="dashboard-row">
              <div className="card flex-1">
                <div className="card-header"><h3>Taxa de Contato</h3></div>
                <div className="card-body dashboard-metric">
                  <div className="metric-value" style={{ color: "#1A6BBF" }}>{taxaContato}%</div>
                  <p>{contatados} de {total} alunos foram contatados</p>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${taxaContato}%`, background: "#1A6BBF" }} /></div>
                </div>
              </div>
              <div className="card flex-1">
                <div className="card-header"><h3>Taxa de Engajamento</h3></div>
                <div className="card-body dashboard-metric">
                  <div className="metric-value" style={{ color: "#16A34A" }}>{taxaEngajamento}%</div>
                  <p>{responderam} de {total} alunos responderam</p>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${taxaEngajamento}%`, background: "#16A34A" }} /></div>
                </div>
              </div>
            </div>

            <div className="card mt-4">
              <div className="card-header"><h3>Distribuição por Status</h3></div>
              <div className="card-body status-dist">
                {[
                  { label: "Pendente", key: "pendente", color: "#D97706" },
                  { label: "Enviado", key: "enviado", color: "#2563EB" },
                  { label: "E-mail enviado", key: "email_enviado", color: "#7C3AED" },
                  { label: "Concluído", key: "concluido", color: "#16A34A" },
                  { label: "Erro", key: "erro", color: "#DC2626" },
                ].map(({ label, key, color }) => {
                  const count = todosAlunos.filter((a) => a.status === key).length;
                  const pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
                  return (
                    <div key={key} className="dist-item">
                      <div className="dist-label"><span style={{ background: color }} className="dist-dot" />{label}</div>
                      <div className="dist-bar-wrap">
                        <div className="dist-bar"><div className="dist-bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
                        <span className="dist-count">{count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabPanel>

        </TabView>
      </main>
    </div>
  );
}

export default AppRouter;