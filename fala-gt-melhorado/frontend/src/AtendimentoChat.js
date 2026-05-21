import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

export default function AtendimentoChat() {
  const [sessoes, setSessoes] = useState([]);
  const [sessaoAtiva, setSessaoAtiva] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [novaMsg, setNovaMsg] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [naoLidas, setNaoLidas] = useState({});
  const messagesEndRef = useRef(null);

  // ── Buscar sessões abertas ─────────────────────────────────────────────────
  const buscarSessoes = async () => {
    const { data } = await supabase
      .from("chat_sessoes")
      .select("*")
      .eq("status", "aberto")
      .order("created_at", { ascending: false });
    setSessoes(data || []);
  };

  // ── Realtime: novas sessões e updates ─────────────────────────────────────
  useEffect(() => {
    buscarSessoes();
    const ch = supabase
      .channel("chat_sessoes_admin")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_sessoes" }, buscarSessoes)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_sessoes" }, buscarSessoes)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  // ── Realtime: mensagens da sessão ativa + notificação de não lidas ────────
  useEffect(() => {
    if (!sessaoAtiva) return;

    const ch = supabase
      .channel(`msgs_admin_${sessaoAtiva.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_mensagens",
          filter: `sessao_id=eq.${sessaoAtiva.id}`,
        },
        (payload) => {
          setMensagens((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    // Realtime para OUTRAS sessões → incrementa badge
    const chGlobal = supabase
      .channel("msgs_admin_global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_mensagens" },
        (payload) => {
          const sid = payload.new.sessao_id;
          if (sid !== sessaoAtiva?.id && payload.new.remetente !== "admin") {
            setNaoLidas((prev) => ({ ...prev, [sid]: (prev[sid] || 0) + 1 }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(chGlobal);
    };
  }, [sessaoAtiva]);

  // ── Realtime global (sem sessão ativa) ────────────────────────────────────
  useEffect(() => {
    if (sessaoAtiva) return;
    const ch = supabase
      .channel("msgs_admin_global_idle")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_mensagens" },
        (payload) => {
          if (payload.new.remetente !== "admin") {
            const sid = payload.new.sessao_id;
            setNaoLidas((prev) => ({ ...prev, [sid]: (prev[sid] || 0) + 1 }));
          }
        }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [sessaoAtiva]);

  // ── Scroll automático ─────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  // ── Selecionar sessão ─────────────────────────────────────────────────────
  const selecionarSessao = async (sessao) => {
    setSessaoAtiva(sessao);
    // Zera badge de não lidas
    setNaoLidas((prev) => ({ ...prev, [sessao.id]: 0 }));
    const { data } = await supabase
      .from("chat_mensagens")
      .select("*")
      .eq("sessao_id", sessao.id)
      .order("created_at", { ascending: true });
    setMensagens(data || []);
  };

  // ── Enviar resposta ───────────────────────────────────────────────────────
  const enviarResposta = async () => {
    if (!novaMsg.trim() || !sessaoAtiva || enviando) return;
    setEnviando(true);
    const { data, error } = await supabase
      .from("chat_mensagens")
      .insert({ sessao_id: sessaoAtiva.id, remetente: "admin", conteudo: novaMsg.trim() })
      .select()
      .single();
    if (!error && data) {
      setMensagens((prev) => [...prev, data]);
      setNovaMsg("");
    }
    setEnviando(false);
  };

  // ── Finalizar chamado ─────────────────────────────────────────────────────
  const finalizarChamado = async () => {
    if (!sessaoAtiva) return;
    if (!window.confirm(`Encerrar o atendimento de ${sessaoAtiva.aluno_nome}?`)) return;
    const { error } = await supabase
      .from("chat_sessoes")
      .update({ status: "finalizado" })
      .eq("id", sessaoAtiva.id);
    if (!error) {
      setSessaoAtiva(null);
      setMensagens([]);
      buscarSessoes();
    }
  };

  const formatarHora = (iso) =>
    new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="atend-layout">
      {/* ── Sidebar de sessões ─────────────────────────────────────────────── */}
      <div className="atend-sidebar">
        <div className="atend-sidebar-header">
          <span>Chamados Abertos</span>
          <span className="atend-badge-total">{sessoes.length}</span>
        </div>

        {sessoes.length === 0 ? (
          <div className="atend-empty-list">
            <i className="pi pi-inbox" />
            <p>Nenhum chamado no momento</p>
          </div>
        ) : (
          sessoes.map((s) => (
            <div
              key={s.id}
              className={`atend-session-item ${sessaoAtiva?.id === s.id ? "atend-session-ativo" : ""}`}
              onClick={() => selecionarSessao(s)}
            >
              <div className="atend-session-avatar">
                {s.aluno_nome?.charAt(0).toUpperCase()}
              </div>
              <div className="atend-session-info">
                <strong>{s.aluno_nome}</strong>
                <span>{s.aluno_telefone}</span>
              </div>
              {naoLidas[s.id] > 0 && (
                <span className="atend-badge-unread">{naoLidas[s.id]}</span>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Janela de chat ─────────────────────────────────────────────────── */}
      <div className="atend-chat">
        {sessaoAtiva ? (
          <>
            <div className="atend-chat-header">
              <div className="atend-session-avatar">
                {sessaoAtiva.aluno_nome?.charAt(0).toUpperCase()}
              </div>
              <div>
                <strong>{sessaoAtiva.aluno_nome}</strong>
                <span>{sessaoAtiva.aluno_telefone}</span>
              </div>
              <button className="atend-btn-finalizar" onClick={finalizarChamado}>
                <i className="pi pi-check-circle" /> Encerrar
              </button>
            </div>

            <div className="atend-messages">
              {mensagens.length === 0 && (
                <div className="atend-msg-inicio">
                  Início da conversa com {sessaoAtiva.aluno_nome}
                </div>
              )}
              {mensagens.map((m, i) => (
                <div
                  key={i}
                  className={`atend-bubble ${m.remetente === "admin" ? "atend-bubble-admin" : "atend-bubble-aluno"}`}
                >
                  <span>{m.conteudo}</span>
                  <time>{formatarHora(m.created_at)}</time>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="atend-input-area">
              <input
                type="text"
                placeholder="Responda ao aluno..."
                value={novaMsg}
                onChange={(e) => setNovaMsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enviarResposta()}
              />
              <button onClick={enviarResposta} disabled={enviando || !novaMsg.trim()}>
                <i className="pi pi-send" />
              </button>
            </div>
          </>
        ) : (
          <div className="atend-placeholder">
            <i className="pi pi-comments" />
            <p>Selecione um chamado ao lado para iniciar o atendimento</p>
          </div>
        )}
      </div>
    </div>
  );
}
