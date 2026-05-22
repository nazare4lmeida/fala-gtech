import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:3001";

// ── Respostas instantâneas por tópico (sem chamar a API) ──────────────────────
const TOPICOS = [
  {
    id: "quem-pode",
    label: "Quem pode participar?",
    resposta: `*Quem pode participar do Geração Tech:*\n\n• Cearenses com idade mínima de 16 anos\n• *Full Stack:* não ter participado de edições anteriores\n• *IA Generativa:* ter noções de programação e dados\n• *IA e Soft Skills:* ter concluído o Geração Tech ou outro curso de programação (com comprovação)`,
  },
  {
    id: "formacoes",
    label: "Quais formações estão disponíveis?",
    resposta: `*Formações disponíveis (todas gratuitas):*\n\n📌 *Desenvolvedor Full Stack* — 500 vagas online\n📌 *IA Generativa* — 200 presenciais + 400 online\n📌 *IA e Soft Skills para Programadores* — 100 presenciais + 500 online\n\nTodas com duração de aproximadamente 3 meses.`,
  },
  {
    id: "horarios",
    label: "Como funcionam os horários?",
    resposta: `*Horários das aulas:*\n\n🖥️ *Online:* aulas gravadas + 1 aula ao vivo por semana (4h)\n🏫 *Presencial:* 2 encontros por semana (4h cada) — seg/qua ou ter/qui, manhã ou tarde`,
  },
  {
    id: "selecao",
    label: "Como é o processo seletivo?",
    resposta: `*Processo seletivo:*\n\n1️⃣ Inscrição no site\n2️⃣ Envio de documentos\n3️⃣ Testes: Raciocínio Lógico, Comportamental e Específico da formação\n\n✅ Todo o processo é *100% gratuito* — sem nenhuma taxa.`,
  },
  {
    id: "ex-alunos",
    label: "Ex-alunos podem participar?",
    resposta: `*Ex-alunos do Geração Tech:*\n\n✅ Podem se inscrever novamente\n✅ Foco especial em ex-alunos para *IA e Soft Skills*\n❌ *Full Stack:* ex-alunos NÃO podem participar`,
  },
  {
    id: "documentos",
    label: "Documentos necessários",
    resposta: `*Documentos para inscrição:*\n\nSe não tiver comprovante de endereço em seu nome, você pode usar a *autodeclaração de residência* (modelo no Anexo II do Edital).\n\nDúvidas sobre documentação? Digite sua pergunta ou clique em *Falar com a equipe*.`,
  },
  {
    id: "eventos",
    label: "Formatura e Recruiting Day",
    resposta: `*Eventos finais do programa:*\n\n🎓 *Formatura* — previsão para 06/05/2026\n💼 *Recruiting Day* — previsão para 27/05/2026\n\nNo Recruiting Day, empresas parceiras estarão presentes em busca de talentos!`,
  },
  {
    id: "contato",
    label: "Como entrar em contato?",
    resposta: `*Contato com a equipe:*\n\n📧 contato@geracaotech.iel-ce.org.br\n🕐 Segunda a sexta, das 9h às 17h\n📋 Prazo de resposta: até 48 horas úteis\n\nOu clique em *Falar com a equipe* para atendimento pelo chat.`,
  },
];

export default function SuporteAluno() {
  const [dados, setDados] = useState({ nome: "", telefone: "" });
  const [sessao, setSessao] = useState(null);
  const [msg, setMsg] = useState("");
  const [conversa, setConversa] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [escalado, setEscalado] = useState(false);
  const [mostrarMenu, setMostrarMenu] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!sessao) return;

    adicionarMsgSistema(
      `Olá, *${sessao.aluno_nome}*! 👋 Bem-vindo ao atendimento do *Geração Tech*.\n\nSelecione um assunto abaixo ou digite sua dúvida:`,
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
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [sessao]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversa]);

  const adicionarMsgSistema = (texto) => {
    setConversa((prev) => [
      ...prev,
      {
        id: `sistema-${Date.now()}`,
        remetente: "sistema",
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

  const escalarParaHumano = async (msgTexto) => {
    setEscalado(true);
    setMostrarMenu(false);
    adicionarMsgSistema(msgTexto);
    await supabase
      .from("chat_sessoes")
      .update({ status: "aberto" })
      .eq("id", sessao.id);
    await supabase.from("chat_mensagens").insert({
      sessao_id: sessao.id,
      remetente: "sistema",
      conteudo: msgTexto,
    });
  };

  // ── Clique em tópico do menu ──────────────────────────────────────────────
  const selecionarTopico = async (topico) => {
    setMostrarMenu(false);

    // Mensagem do aluno
    const msgAluno = {
      id: `aluno-${Date.now()}`,
      remetente: "aluno",
      conteudo: topico.label,
      created_at: new Date().toISOString(),
    };
    setConversa((prev) => [...prev, msgAluno]);

    await supabase.from("chat_mensagens").insert({
      sessao_id: sessao.id,
      remetente: "aluno",
      conteudo: topico.label,
    });

    // Resposta instantânea
    setTimeout(() => {
      adicionarMsgSistema(topico.resposta);
      // Mostra o menu novamente após responder
      setTimeout(() => setMostrarMenu(true), 400);
    }, 400);
  };

  // ── Envio de mensagem digitada ────────────────────────────────────────────
  const enviarMensagem = async () => {
    if (!msg.trim() || !sessao || enviando) return;
    const texto = msg.trim();
    setMsg("");
    setMostrarMenu(false);
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

    if (escalado) {
      setEnviando(false);
      return;
    }

    // Verifica palavras-chave para escalada imediata
    const palavrasHumano = [
      "falar com humano",
      "falar com a equipe",
      "atendente",
      "humano",
      "pessoa real",
    ];
    if (palavrasHumano.some((p) => texto.toLowerCase().includes(p))) {
      await escalarParaHumano(
        "Conectando você com nossa equipe... ⏳\n\nAtendimento disponível de *segunda a sexta, das 9h às 17h*.",
      );
      setEnviando(false);
      return;
    }

    // Verifica palavras-chave para resposta direta sem API
    const topicoEncontrado = TOPICOS.find((t) => {
      const palavras = t.label
        .toLowerCase()
        .split(" ")
        .filter((p) => p.length > 3);
      return palavras.some((p) => texto.toLowerCase().includes(p));
    });

    if (topicoEncontrado) {
      setTimeout(() => {
        adicionarMsgSistema(topicoEncontrado.resposta);
        setTimeout(() => setMostrarMenu(true), 400);
      }, 400);
      setEnviando(false);
      return;
    }

    // Pergunta fora do menu → chama o Gemini
    try {
      const historicoParaBot = conversa
        .filter((m) => m.remetente === "aluno" || m.remetente === "sistema")
        .slice(-8)
        .map((m) => ({
          remetente: m.remetente === "sistema" ? "admin" : "aluno",
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
        adicionarMsgSistema(data.resposta);
        setTimeout(() => setMostrarMenu(true), 400);
      }
    } catch {
      adicionarMsgSistema(
        'Não consegui processar sua pergunta. Digite *"falar com a equipe"* ou selecione um assunto abaixo.',
      );
      setMostrarMenu(true);
    } finally {
      setEnviando(false);
    }
  };

  const formatarTexto = (texto) => {
    return texto.split("\n").map((linha, li) => (
      <span key={li}>
        {linha
          .split(/(\*[^*]+\*)/g)
          .map((parte, pi) =>
            parte.startsWith("*") && parte.endsWith("*") ? (
              <strong key={pi}>{parte.slice(1, -1)}</strong>
            ) : (
              <span key={pi}>{parte}</span>
            ),
          )}
        {li < texto.split("\n").length - 1 && <br />}
      </span>
    ));
  };

  // ── Tela de entrada ───────────────────────────────────────────────────────
  if (!sessao) {
    return (
      <div className="suporte-page">
        <div className="suporte-card">
          <div className="suporte-header">
            <div className="suporte-logo">GT</div>
            <h2>Central de Atendimento</h2>
            <p>Geração Tech — Tire suas dúvidas aqui</p>
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
            ⚡ Atendimento imediato · 👤 Equipe disponível seg-sex 9h-17h
          </p>
        </div>
      </div>
    );
  }

  // ── Tela de chat ──────────────────────────────────────────────────────────
  return (
    <div className="suporte-chat-page">
      <div className="suporte-chat-header">
        <div className="suporte-chat-avatar">{escalado ? "👤" : "GT"}</div>
        <div>
          <strong>
            {escalado ? "Equipe Geração Tech" : "Atendimento Geração Tech"}
          </strong>
          <span>{escalado ? "🟡 Aguardando atendente" : "🟢 Online"}</span>
        </div>
        {!escalado && (
          <button
            className="suporte-btn-humano"
            onClick={() =>
              escalarParaHumano(
                "Conectando você com nossa equipe... ⏳\n\nAtendimento disponível de *segunda a sexta, das 9h às 17h*.",
              )
            }
          >
            👤 Falar com a equipe
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
                : m.remetente === "admin"
                  ? "suporte-bubble-admin"
                  : "suporte-bubble-bot"
            }`}
          >
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

        {/* Menu de tópicos */}
        {mostrarMenu && !escalado && (
          <div className="suporte-menu-topicos">
            <p>Selecione um assunto:</p>
            <div className="suporte-topicos-grid">
              {TOPICOS.map((t) => (
                <button
                  key={t.id}
                  className="suporte-topico-btn"
                  onClick={() => selecionarTopico(t)}
                >
                  {t.label}
                </button>
              ))}
              <button
                className="suporte-topico-btn suporte-topico-humano"
                onClick={() =>
                  escalarParaHumano(
                    "Conectando você com nossa equipe... ⏳\n\nAtendimento disponível de *segunda a sexta, das 9h às 17h*.",
                  )
                }
              >
                👤 Falar com a equipe
              </button>
            </div>
          </div>
        )}

        {enviando && (
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
              : "Digite sua dúvida ou selecione um assunto acima..."
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
