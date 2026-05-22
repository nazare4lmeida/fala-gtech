import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:3001";

export default function SuporteAluno() {
  const [dados, setDados] = useState({ nome: "", telefone: "" });
  const [sessao, setSessao] = useState(null);
  const [msg, setMsg] = useState("");
  const [conversa, setConversa] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [modoBot, setModoBot] = useState(true);
  const [escalado, setEscalado] = useState(false);
  const messagesEndRef = useRef(null);

  // ── Realtime: escuta respostas do admin ───────────────────────────────────
  useEffect(() => {
    if (!sessao) return;

    adicionarMsgBot(
      `Olá, *${sessao.aluno_nome}*! 👋\n\n` +
        "Sou o assistente virtual do Geração Tech. Estou aqui para tirar suas dúvidas!\n\n" +
        'Se eu não conseguir te ajudar, é só digitar *"falar com humano"* que te conecto com nossa equipe. 😊'
    );

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
        (payload) => {
          if (payload.new.remetente === "admin") {
            setConversa((prev) => [...prev, payload.new]);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [sessao]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversa]);

  const adicionarMsgBot = (texto) => {
    setConversa((prev) => [
      ...prev,
      {
        id: `bot-${Date.now()}`,
        remetente: "bot",
        conteudo: texto,
        created_at: new Date().toISOString(),
      },
    ]);
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
      .insert([
        {
          aluno_nome: dados.nome.trim(),
          aluno_telefone: dados.telefone.trim(),
          status: "bot",
        },
      ])
      .select()
      .single();
    setEnviando(false);
    if (data) setSessao(data);
    else setErro("Erro ao iniciar o chat. Tente novamente.");
  };

  const escalarParaHumano = async (msgBot) => {
    setEscalado(true);
    setModoBot(false);
    adicionarMsgBot(msgBot);
    await supabase
      .from("chat_sessoes")
      .update({ status: "aberto" })
      .eq("id", sessao.id);
    await supabase.from("chat_mensagens").insert({
      sessao_id: sessao.id,
      remetente: "bot",
      conteudo: msgBot,
    });
  };

  const enviarMensagem = async () => {
    if (!msg.trim() || !sessao || enviando) return;
    const texto = msg.trim();
    setMsg("");
    setEnviando(true);

    setConversa((prev) => [
      ...prev,
      {
        id: `aluno-${Date.now()}`,
        remetente: "aluno",
        conteudo: texto,
        created_at: new Date().toISOString(),
      },
    ]);

    await supabase.from("chat_mensagens").insert({
      sessao_id: sessao.id,
      remetente: "aluno",
      conteudo: texto,
    });

    if (!modoBot || escalado) {
      setEnviando(false);
      return;
    }

    try {
      const historicoParaBot = conversa
        .filter((m) => m.remetente === "aluno" || m.remetente === "bot")
        .slice(-10)
        .map((m) => ({
          remetente: m.remetente === "bot" ? "admin" : "aluno",
          conteudo: m.conteudo,
        }));

      const res = await fetch(`${BACKEND}/chat-bot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem: texto, historico: historicoParaBot }),
      });

      const data = await res.json();

      if (data.escalar) {
        await escalarParaHumano(data.resposta);
      } else {
        adicionarMsgBot(data.resposta);
      }
    } catch {
      adicionarMsgBot(
        'Desculpe, tive um problema técnico. Digite *"falar com humano"* para falar com nossa equipe.'
      );
    } finally {
      setEnviando(false);
    }
  };

  const formatarTexto = (texto) => {
    return texto.split(/(\*[^*]+\*)/g).map((parte, i) =>
      parte.startsWith("*") && parte.endsWith("*") ? (
        <strong key={i}>{parte.slice(1, -1)}</strong>
      ) : (
        <span key={i}>{parte}</span>
      )
    );
  };

  // ── Tela de entrada ───────────────────────────────────────────────────────
  if (!sessao) {
    return (
      <div className="suporte-page">
        <div className="suporte-card">
          <div className="suporte-header">
            <div className="suporte-logo">GT</div>
            <h2>Suporte ao Aluno</h2>
            <p>Geração Tech — Fale com nossa equipe agora</p>
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
                onChange={(e) =>
                  setDados({ ...dados, telefone: e.target.value })
                }
                onKeyDown={(e) => e.key === "Enter" && iniciarChat()}
              />
            </div>

            <button
              className="suporte-btn"
              onClick={iniciarChat}
              disabled={enviando}
            >
              {enviando ? "Conectando..." : "Iniciar Atendimento"}
            </button>
          </div>

          <p className="suporte-aviso">
            🤖 Atendimento inicial por IA · 👤 Humano disponível seg-sex 9h-17h
          </p>
        </div>
      </div>
    );
  }

  // ── Tela de chat ──────────────────────────────────────────────────────────
  return (
    <div className="suporte-chat-page">
      <div className="suporte-chat-header">
        <div className="suporte-chat-avatar">{escalado ? "👤" : "🤖"}</div>
        <div>
          <strong>{escalado ? "Equipe Geração Tech" : "GT Bot"}</strong>
          <span>
            {escalado ? "🟡 Aguardando atendente" : "🟢 Assistente Virtual"}
          </span>
        </div>
        {!escalado && (
          <button
            className="suporte-btn-humano"
            onClick={() =>
              escalarParaHumano(
                "Conectando você com nossa equipe... ⏳\n\nAtendimento disponível de segunda a sexta, das 9h às 17h."
              )
            }
          >
            👤 Falar com humano
          </button>
        )}
      </div>

      <div className="suporte-chat-messages">
        {conversa.map((m, i) => (
          <div
            key={m.id || i}
            className={`suporte-bubble ${
              m.remetente === "aluno"
                ? "suporte-bubble-aluno"
                : m.remetente === "bot"
                ? "suporte-bubble-bot"
                : "suporte-bubble-admin"
            }`}
          >
            {m.remetente === "bot" && (
              <span className="suporte-bubble-label">🤖 GT Bot</span>
            )}
            {m.remetente === "admin" && (
              <span className="suporte-bubble-label">👤 Equipe GT</span>
            )}
            <span>{formatarTexto(m.conteudo)}</span>
            <time>
              {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </div>
        ))}
        {enviando && modoBot && !escalado && (
          <div className="suporte-bubble suporte-bubble-bot suporte-digitando">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="suporte-chat-input">
        <input
          type="text"
          placeholder={
            escalado
              ? "Digite sua mensagem para a equipe..."
              : 'Digite sua dúvida ou "falar com humano"...'
          }
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && !e.shiftKey && enviarMensagem()
          }
          disabled={enviando}
        />
        <button onClick={enviarMensagem} disabled={enviando || !msg.trim()}>
          <i className="pi pi-send" />
        </button>
      </div>
    </div>
  );
}