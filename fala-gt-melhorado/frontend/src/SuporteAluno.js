import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

export default function SuporteAluno() {
  const [dados, setDados] = useState({ nome: "", telefone: "" });
  const [sessao, setSessao] = useState(null);
  const [msg, setMsg] = useState("");
  const [conversa, setConversa] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (sessao) {
      buscarMensagens();
      const channel = supabase
        .channel(`chat_aluno:${sessao.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_mensagens",
            filter: `sessao_id=eq.${sessao.id}`,
          },
          (payload) => setConversa((prev) => [...prev, payload.new])
        )
        .subscribe();
      return () => supabase.removeChannel(channel);
    }
  }, [sessao]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversa]);

  const buscarMensagens = async () => {
    const { data } = await supabase
      .from("chat_mensagens")
      .select("*")
      .eq("sessao_id", sessao.id)
      .order("created_at", { ascending: true });
    setConversa(data || []);
  };

  const iniciarChat = async () => {
    if (!dados.nome.trim() || !dados.telefone.trim()) {
      setErro("Preencha seu nome e telefone para continuar.");
      return;
    }
    setErro("");
    setEnviando(true);
    const { data, error } = await supabase
      .from("chat_sessoes")
      .insert([{ aluno_nome: dados.nome.trim(), aluno_telefone: dados.telefone.trim() }])
      .select()
      .single();
    setEnviando(false);
    if (data) setSessao(data);
    else setErro("Erro ao iniciar o chat. Tente novamente.");
  };

  const enviarMensagem = async () => {
    if (!msg.trim() || !sessao) return;
    setEnviando(true);
    const { error } = await supabase
      .from("chat_mensagens")
      .insert({ sessao_id: sessao.id, remetente: "aluno", conteudo: msg.trim() });
    if (!error) setMsg("");
    setEnviando(false);
  };

  // ── Tela de entrada ────────────────────────────────────────────────────────
  if (!sessao) {
    return (
      <div className="suporte-page">
        <div className="suporte-card">
          <div className="suporte-header">
            <div className="suporte-logo">GT</div>
            <h2>Suporte ao Aluno</h2>
            <p>Geração Tech 3.0 — Fale com nossa equipe agora</p>
          </div>

          <div className="suporte-form">
            {erro && <div className="suporte-erro">{erro}</div>}

            <div className="suporte-field">
              <label>Seu nome completo</label>
              <input
                type="text"
                placeholder="Ex: Maria Silva"
                value={dados.nome}
                onChange={(e) => setDados({ ...dados, nome: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && iniciarChat()}
                autoFocus
              />
            </div>

            <div className="suporte-field">
              <label>Seu telefone (WhatsApp)</label>
              <input
                type="tel"
                placeholder="Ex: 85 9 9999-9999"
                value={dados.telefone}
                onChange={(e) => setDados({ ...dados, telefone: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && iniciarChat()}
              />
            </div>

            <button className="suporte-btn" onClick={iniciarChat} disabled={enviando}>
              {enviando ? "Conectando..." : "Iniciar Atendimento"}
            </button>
          </div>

          <p className="suporte-aviso">
            🟢 Equipe disponível em horário comercial
          </p>
        </div>
      </div>
    );
  }

  // ── Tela de chat ───────────────────────────────────────────────────────────
  return (
    <div className="suporte-chat-page">
      <div className="suporte-chat-header">
        <div className="suporte-chat-avatar">GT</div>
        <div>
          <strong>Suporte Geração Tech</strong>
          <span>🟢 Online</span>
        </div>
      </div>

      <div className="suporte-chat-messages">
        <div className="suporte-msg-sistema">
          Olá, <strong>{sessao.aluno_nome}</strong>! Nossa equipe vai te atender em breve. 👋
        </div>

        {conversa.map((m, i) => (
          <div
            key={i}
            className={`suporte-bubble ${m.remetente === "aluno" ? "suporte-bubble-aluno" : "suporte-bubble-admin"}`}
          >
            <span>{m.conteudo}</span>
            <time>
              {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="suporte-chat-input">
        <input
          type="text"
          placeholder="Digite sua mensagem..."
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && enviarMensagem()}
        />
        <button onClick={enviarMensagem} disabled={enviando || !msg.trim()}>
          <i className="pi pi-send" />
        </button>
      </div>
    </div>
  );
}
