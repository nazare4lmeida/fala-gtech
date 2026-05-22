import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:3001";

// ── Tópicos com palavras-chave para match preciso ─────────────────────────────
const TOPICOS = [
  {
    id: "quem-pode",
    label: "Quem pode participar?",
    palavrasChave: ["quem pode", "participar", "requisito", "elegivel", "elegível", "idade", "cearense"],
    resposta: `*Quem pode participar do Geração Tech:*\n\n• Cearenses com idade mínima de 16 anos\n\n• *Full Stack:* não ter participado de edições anteriores do Geração Tech\n• *IA Generativa:* ter noções de programação e dados\n• *IA e Soft Skills:* ter concluído o Geração Tech ou outro curso de programação (com comprovação)`,
  },
  {
    id: "formacoes",
    label: "Quais formações estão disponíveis?",
    palavrasChave: ["formação", "formações", "curso", "cursos", "trilha", "disponível", "disponíveis", "opcoes", "opções"],
    resposta: `*Formações disponíveis — todas gratuitas:*\n\n📌 *Desenvolvedor Full Stack* — 500 vagas online\n📌 *IA Generativa* — 200 presenciais + 400 online\n📌 *IA e Soft Skills para Programadores* — 100 presenciais + 500 online\n\nTodas com duração de aproximadamente 3 meses.`,
  },
  {
    id: "horarios",
    label: "Como funcionam os horários?",
    palavrasChave: ["horario", "horário", "horarios", "horários", "aula", "aulas", "dias", "turno", "manhã", "tarde", "semana"],
    resposta: `*Horários das aulas:*\n\n🖥️ *Online:* aulas gravadas + 1 aula ao vivo por semana (4h)\n🏫 *Presencial:* 2 encontros por semana, 4h cada — seg/qua ou ter/qui, manhã ou tarde`,
  },
  {
    id: "selecao",
    label: "Como é o processo seletivo?",
    palavrasChave: ["seletivo", "seleção", "selecao", "inscricao", "inscrição", "teste", "testes", "processo", "como participar", "como se inscrever"],
    resposta: `*Processo seletivo:*\n\n1️⃣ Inscrição no site\n2️⃣ Envio de documentos\n3️⃣ Testes: Raciocínio Lógico, Comportamental e Específico da formação\n\n✅ Todo o processo é *100% gratuito* — sem nenhuma taxa.`,
  },
  {
    id: "gratuito",
    label: "É gratuito?",
    palavrasChave: ["gratuito", "gratis", "grátis", "pagar", "pago", "taxa", "custo", "valor", "quanto custa"],
    resposta: `✅ Sim! O Geração Tech é *100% gratuito*.\n\nTanto o processo seletivo quanto as formações não têm nenhum custo para o aluno.`,
  },
  {
    id: "ex-alunos",
    label: "Ex-alunos podem participar?",
    palavrasChave: ["ex-aluno", "ex aluno", "participei antes", "edição anterior", "edicao anterior", "ja fiz", "já fiz", "participei"],
    resposta: `*Ex-alunos do Geração Tech:*\n\n✅ Podem se inscrever novamente\n✅ Foco especial em ex-alunos para *IA e Soft Skills*\n❌ *Full Stack:* ex-alunos NÃO podem participar`,
  },
  {
    id: "documentos",
    label: "Documentos necessários",
    palavrasChave: ["documento", "documentos", "comprovante", "endereco", "endereço", "autodeclaracao", "autodeclaração", "rg", "cpf"],
    resposta: `*Documentos para inscrição:*\n\nSe não tiver comprovante de endereço em seu nome, você pode usar a *autodeclaração de residência* (modelo no Anexo II do Edital).\n\nDúvidas sobre documentação? Clique em *Falar com a equipe*.`,
  },
  {
    id: "recruiting",
    label: "O que é o Recruiting Day?",
    palavrasChave: ["recruiting", "recruiting day", "feira", "emprego", "empregabilidade", "empresa", "vaga", "vagas", "contratacao", "contratação", "evento"],
    resposta: `*Recruiting Day Geração Tech 3.0* 🚀\n\n📅 *Data:* 27 de maio de 2026\n📍 *Local:* FIEC — Fortaleza/CE\n✅ *Participação gratuita*\n\nA feira oficial de empregabilidade do programa — onde empresas encontram os novos talentos da tecnologia.\n\n*O que acontece no evento:*\n• Empresas com vagas abertas\n• +3.000 profissionais formados\n• +30 empresas expositoras\n• +150 vagas ofertadas\n• Ciclo de palestras com especialistas\n• Desafio IEL — premiação dos 5 melhores talentos\n• Networking estratégico\n\n🔗 Saiba mais: geracaotech.iel-ce.org.br/recruitingday`,
  },
  {
    id: "formatura",
    label: "Formatura e eventos finais",
    palavrasChave: ["formatura", "certificado", "certificação", "conclusao", "conclusão", "evento final", "encerramento"],
    resposta: `*Eventos finais do programa:*\n\n🎓 *Formatura* — previsão para 06/05/2026\n💼 *Recruiting Day* — 27/05/2026 na FIEC, Fortaleza\n\nNo Recruiting Day, +30 empresas parceiras estarão presentes com vagas reais para os formandos!`,
  },
  {
    id: "contato",
    label: "Como entrar em contato?",
    palavrasChave: ["contato", "email", "e-mail", "duvida", "dúvida", "falar", "atendimento", "ajuda", "suporte"],
    resposta: `*Contato com a equipe:*\n\n📧 contato@geracaotech.iel-ce.org.br\n🕐 Segunda a sexta, das 9h às 17h\n📋 Prazo de resposta: até 48 horas úteis\n\nOu clique em *Falar com a equipe* para atendimento pelo chat agora.`,
  },
];

// ── Normaliza texto para comparação ──────────────────────────────────────────
function normTexto(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// ── Encontra tópico pela mensagem digitada ────────────────────────────────────
function encontrarTopico(mensagem) {
  const msgNorm = normTexto(mensagem);
  let melhorMatch = null;
  let melhorScore = 0;

  for (const topico of TOPICOS) {
    for (const palavra of topico.palavrasChave) {
      const palavraNorm = normTexto(palavra);
      // Match exato da frase-chave
      if (msgNorm.includes(palavraNorm)) {
        const score = palavraNorm.length; // frases mais longas = score maior
        if (score > melhorScore) {
          melhorScore = score;
          melhorMatch = topico;
        }
      }
    }
  }

  return melhorMatch;
}

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
      `Olá, *${sessao.aluno_nome}*! 👋 Bem-vindo ao atendimento do *Geração Tech*.\n\nSelecione um assunto abaixo ou digite sua dúvida:`
    );

    const channel = supabase
      .channel(`chat_aluno:${sessao.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_mensagens",
        filter: `sessao_id=eq.${sessao.id}`,
      }, (payload) => {
        if (payload.new.remetente === "admin") {
          setConversa((prev) => [...prev, payload.new]);
        }
      })
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
        id: `sistema-${Date.now()}-${Math.random()}`,
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
      .insert([{ aluno_nome: dados.nome.trim(), aluno_telefone: dados.telefone.trim(), status: "bot" }])
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
    await supabase.from("chat_sessoes").update({ status: "aberto" }).eq("id", sessao.id);
    await supabase.from("chat_mensagens").insert({ sessao_id: sessao.id, remetente: "sistema", conteudo: msgTexto });
  };

  const selecionarTopico = async (topico) => {
    setMostrarMenu(false);
    const msgAluno = {
      id: `aluno-${Date.now()}`,
      remetente: "aluno",
      conteudo: topico.label,
      created_at: new Date().toISOString(),
    };
    setConversa((prev) => [...prev, msgAluno]);
    await supabase.from("chat_mensagens").insert({ sessao_id: sessao.id, remetente: "aluno", conteudo: topico.label });
    setTimeout(() => {
      adicionarMsgSistema(topico.resposta);
      setTimeout(() => setMostrarMenu(true), 300);
    }, 350);
  };

  const enviarMensagem = async () => {
    if (!msg.trim() || !sessao || enviando) return;
    const texto = msg.trim();
    setMsg("");
    setMostrarMenu(false);
    setEnviando(true);

    setConversa((prev) => [
      ...prev,
      { id: `aluno-${Date.now()}`, remetente: "aluno", conteudo: texto, created_at: new Date().toISOString() },
    ]);

    await supabase.from("chat_mensagens").insert({ sessao_id: sessao.id, remetente: "aluno", conteudo: texto });

    if (escalado) { setEnviando(false); return; }

    // Verifica escalada para humano
    const palavrasHumano = ["falar com humano", "falar com a equipe", "falar com equipe", "atendente", "humano", "pessoa real", "quero falar com alguem", "quero falar com alguém"];
    const msgNorm = normTexto(texto);
    if (palavrasHumano.some((p) => msgNorm.includes(normTexto(p)))) {
      await escalarParaHumano("Conectando você com nossa equipe... ⏳\n\nAtendimento disponível de *segunda a sexta, das 9h às 17h*.");
      setEnviando(false);
      return;
    }

    // Busca tópico por palavras-chave (preciso)
    const topicoEncontrado = encontrarTopico(texto);
    if (topicoEncontrado) {
      setTimeout(() => {
        adicionarMsgSistema(topicoEncontrado.resposta);
        setTimeout(() => setMostrarMenu(true), 300);
      }, 350);
      setEnviando(false);
      return;
    }

    // Pergunta fora do menu → Gemini
    try {
      const historicoParaBot = conversa
        .filter((m) => m.remetente === "aluno" || m.remetente === "sistema")
        .slice(-8)
        .map((m) => ({ remetente: m.remetente === "sistema" ? "admin" : "aluno", conteudo: m.conteudo }));

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
        setTimeout(() => setMostrarMenu(true), 300);
      }
    } catch {
      adicionarMsgSistema('Não consegui processar sua pergunta agora. Selecione um assunto abaixo ou clique em *Falar com a equipe*.');
      setMostrarMenu(true);
    } finally {
      setEnviando(false);
    }
  };

  const formatarTexto = (texto) => {
    return texto.split("\n").map((linha, li, arr) => (
      <span key={li}>
        {linha.split(/(\*[^*]+\*)/g).map((parte, pi) =>
          parte.startsWith("*") && parte.endsWith("*")
            ? <strong key={pi}>{parte.slice(1, -1)}</strong>
            : <span key={pi}>{parte}</span>
        )}
        {li < arr.length - 1 && <br />}
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
              <input type="text" placeholder="Ex: Maria Silva" value={dados.nome}
                onChange={(e) => setDados({ ...dados, nome: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && iniciarChat()} autoFocus />
            </div>
            <div className="suporte-field">
              <label>Seu telefone (WhatsApp)</label>
              <input type="tel" placeholder="Ex: 85 9 9999-9999" value={dados.telefone}
                onChange={(e) => setDados({ ...dados, telefone: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && iniciarChat()} />
            </div>
            <button className="suporte-btn" onClick={iniciarChat} disabled={enviando}>
              {enviando ? "Conectando..." : "Iniciar Atendimento"}
            </button>
          </div>
          <p className="suporte-aviso">⚡ Atendimento imediato · 👤 Equipe disponível seg-sex 9h-17h</p>
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
          <strong>{escalado ? "Equipe Geração Tech" : "Atendimento Geração Tech"}</strong>
          <span>{escalado ? "🟡 Aguardando atendente" : "🟢 Online"}</span>
        </div>
        {!escalado && (
          <button className="suporte-btn-humano" onClick={() =>
            escalarParaHumano("Conectando você com nossa equipe... ⏳\n\nAtendimento disponível de *segunda a sexta, das 9h às 17h*.")
          }>
            👤 Falar com a equipe
          </button>
        )}
      </div>

      <div className="suporte-chat-messages">
        {conversa.map((m, i) => (
          <div key={m.id || i} className={`suporte-bubble ${
            m.remetente === "aluno" ? "suporte-bubble-aluno"
            : m.remetente === "admin" ? "suporte-bubble-admin"
            : "suporte-bubble-bot"
          }`}>
            {m.remetente === "admin" && <span className="suporte-bubble-label">👤 Equipe GT</span>}
            <span>{formatarTexto(m.conteudo)}</span>
            <time>{new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
          </div>
        ))}

        {mostrarMenu && !escalado && (
          <div className="suporte-menu-topicos">
            <p>Selecione um assunto:</p>
            <div className="suporte-topicos-grid">
              {TOPICOS.map((t) => (
                <button key={t.id} className="suporte-topico-btn" onClick={() => selecionarTopico(t)}>
                  {t.label}
                </button>
              ))}
              <button className="suporte-topico-btn suporte-topico-humano"
                onClick={() => escalarParaHumano("Conectando você com nossa equipe... ⏳\n\nAtendimento disponível de *segunda a sexta, das 9h às 17h*.")}>
                👤 Falar com a equipe
              </button>
            </div>
          </div>
        )}

        {enviando && (
          <div className="suporte-bubble suporte-bubble-bot suporte-digitando">
            <span className="dot" /><span className="dot" /><span className="dot" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="suporte-chat-input">
        <input type="text"
          placeholder={escalado ? "Digite sua mensagem para a equipe..." : "Digite sua dúvida ou selecione um assunto acima..."}
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && enviarMensagem()}
          disabled={enviando}
        />
        <button onClick={enviarMensagem} disabled={enviando || !msg.trim()}>
          <i className="pi pi-send" />
        </button>
      </div>
    </div>
  );
}