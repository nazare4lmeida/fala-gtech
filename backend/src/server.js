const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:3000", "https://fala-gtech.vercel.app"],
  }),
);

const PORT = process.env.PORT || 3001;
const SECRET_KEY =
  process.env.JWT_SECRET || "gtech_dev_secret_troque_em_producao";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// ─── Middleware JWT ───────────────────────────────────────────────────────────
const verificarToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader)
    return res.status(403).json({ error: "Token não fornecido." });
  const token = authHeader.replace("Bearer ", "");
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err)
      return res.status(401).json({ error: "Token inválido ou expirado." });
    req.userId = decoded.id;
    req.userEmail = decoded.email;
    next();
  });
};

// ─── Normaliza string: minúsculo + sem acento ─────────────────────────────────
function norm(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Busca aluno por nome com tolerância total a acentos/caixa ───────────────
async function buscarAlunoPorNome(nomeRecebido) {
  const { data: todos, error } = await supabase
    .from("alunos")
    .select("id, nome, historico, telefone");

  if (error || !todos || todos.length === 0) {
    console.log("⚠️ Banco vazio ou erro ao buscar alunos:", error?.message);
    return null;
  }

  const nomeNorm = norm(nomeRecebido);
  const partes = nomeNorm.split(" ").filter((p) => p.length > 2);

  console.log(`🔍 Buscando: "${nomeRecebido}" → normalizado: "${nomeNorm}"`);
  console.log(`🔍 Partes: [${partes.join(", ")}]`);

  // Nível 1: match exato normalizado
  let found = todos.find((a) => norm(a.nome) === nomeNorm);
  if (found) {
    console.log(`✅ Nível 1 (exato): "${found.nome}"`);
    return found;
  }

  // Nível 2: banco contém todas as partes do pushname
  if (partes.length >= 2) {
    found = todos.find((a) => partes.every((p) => norm(a.nome).includes(p)));
    if (found) {
      console.log(`✅ Nível 2 (todas partes): "${found.nome}"`);
      return found;
    }
  }

  // Nível 3: pushname contém o primeiro nome do banco E banco contém primeiro nome do pushname
  if (partes.length >= 1) {
    found = todos.find((a) => {
      const nomeAluno = norm(a.nome);
      const primeiroParte = norm(a.nome.split(" ")[0]);
      return nomeNorm.includes(primeiroParte) && nomeAluno.includes(partes[0]);
    });
    if (found) {
      console.log(`✅ Nível 3 (cruzado): "${found.nome}"`);
      return found;
    }
  }

  // Nível 4: só primeiro nome do pushname começa o nome do banco
  if (partes.length >= 1) {
    found = todos.find((a) => norm(a.nome).startsWith(partes[0]));
    if (found) {
      console.log(`✅ Nível 4 (prefixo): "${found.nome}"`);
      return found;
    }
  }

  console.log(`❌ Nenhum aluno encontrado para "${nomeRecebido}"`);
  console.log(
    "📋 Nomes no banco (normalizados):",
    todos.slice(0, 10).map((a) => norm(a.nome)),
  );
  return null;
}

// ─── GET /status ──────────────────────────────────────────────────────────────
app.get("/status", (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// ─── POST /login ──────────────────────────────────────────────────────────────
app.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha)
    return res.status(400).json({ error: "E-mail e senha são obrigatórios." });

  try {
    const { data: usuario, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .single();

    if (error || !usuario)
      return res.status(401).json({ error: "Credenciais inválidas." });

    let senhaValida = false;
    if (usuario.senha.startsWith("$2")) {
      senhaValida = await bcrypt.compare(senha, usuario.senha);
    } else {
      senhaValida = usuario.senha === senha;
    }

    if (!senhaValida)
      return res.status(401).json({ error: "Credenciais inválidas." });

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, nome: usuario.nome },
      SECRET_KEY,
      { expiresIn: "8h" },
    );

    res.json({ nome: usuario.nome, token });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// ─── POST /send-email-bulk ────────────────────────────────────────────────────
app.post("/send-email-bulk", verificarToken, async (req, res) => {
  const { students, subject, messageBody } = req.body;

  if (!students || !Array.isArray(students) || students.length === 0)
    return res.status(400).json({ error: "Nenhum aluno selecionado." });
  if (!subject || !messageBody)
    return res
      .status(400)
      .json({ error: "Assunto e mensagem são obrigatórios." });

  const resultados = { enviados: 0, falhas: [] };

  try {
    for (const student of students) {
      const email = student.email || student.contato;
      if (!email || !email.includes("@")) {
        resultados.falhas.push({
          nome: student.nome,
          motivo: "E-mail inválido ou ausente.",
        });
        continue;
      }

      const corpoPersonalizado = messageBody
        .replace(/{nome}/g, student.nome || "")
        .replace(/{curso}/g, student.curso || "");

      const htmlContent = `
        <div style="font-family:'Segoe UI',Arial,sans-serif;color:#1E293B;max-width:600px;margin:0 auto;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#1A365D,#2D5A9B);padding:30px 24px;text-align:center;">
            <h1 style="color:white;margin:0;font-size:1.4rem;font-weight:700;">Geração Tech 3.0</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:0.9rem;">Programa de Qualificação Profissional</p>
          </div>
          <div style="padding:30px 24px;">
            <h2 style="color:#1A365D;margin:0 0 16px;font-size:1.1rem;">Olá, ${student.nome}!</h2>
            <div style="color:#4A5568;line-height:1.7;font-size:0.95rem;">${corpoPersonalizado.replace(/\n/g, "<br/>")}</div>
          </div>
          <div style="background:#F7FAFC;padding:20px 24px;border-top:1px solid #E2E8F0;text-align:center;">
            <p style="margin:0 0 12px;font-size:0.85rem;color:#718096;">Precisa de ajuda? Acesse nosso suporte:</p>
            <a href="http://localhost:3000/suporte" style="background:#1A365D;color:white;padding:10px 22px;text-decoration:none;border-radius:6px;font-weight:600;font-size:0.9rem;display:inline-block;">Chat de Suporte</a>
            <p style="margin:16px 0 0;font-size:0.75rem;color:#A0AEC0;">Equipe Geração Tech 3.0 — IEL-CE</p>
          </div>
        </div>`;

      try {
        await transporter.sendMail({
          from: `"Geração Tech 3.0" <${process.env.EMAIL_USER}>`,
          to: email,
          subject,
          html: htmlContent,
        });
        await supabase
          .from("alunos")
          .update({
            status: "email_enviado",
            data_envio: new Date().toISOString(),
          })
          .eq("id", student.id);
        resultados.enviados++;
        console.log(`✅ E-mail → ${student.nome} (${email})`);
      } catch (emailErr) {
        resultados.falhas.push({
          nome: student.nome,
          motivo: emailErr.message,
        });
        console.error(`❌ E-mail falhou → ${student.nome}:`, emailErr.message);
      }
    }

    res.json({
      message: `${resultados.enviados} e-mail(s) enviado(s) com sucesso.`,
      falhas: resultados.falhas,
    });
  } catch (err) {
    console.error("Erro geral e-mail:", err);
    res.status(500).json({ error: "Falha interna ao disparar e-mails." });
  }
});

// ─── WhatsApp ─────────────────────────────────────────────────────────────────
const wppconnect = require("@wppconnect-team/wppconnect");
let whatsappClient = null;

wppconnect
  .create({
    session: "geracao-tech",
    autoClose: false,
    puppeteerOptions: {
      executablePath: undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
      ],
    },
  })
  .then((client) => {
    whatsappClient = client;
    console.log("✅ WhatsApp conectado!");

    client.onMessage(async (message) => {
      if (message.isGroupMsg) return;
      if (message.from === "status@broadcast") return;

      const nomeRecebido = message.sender?.pushname || message.notifyName || "";
      const corpo = message.body;

      console.log("\n" + "═".repeat(50));
      console.log(`📩 MENSAGEM RECEBIDA`);
      console.log(`   De:      ${message.from}`);
      console.log(`   Nome:    ${nomeRecebido}`);
      console.log(`   Texto:   ${corpo}`);
      console.log("═".repeat(50));

      if (!nomeRecebido) {
        console.warn(
          "⚠️ pushname vazio, não foi possível identificar o aluno.",
        );
        return;
      }

      try {
        const aluno = await buscarAlunoPorNome(nomeRecebido);

        if (!aluno) {
          console.warn(`⚠️ Aluno não encontrado. Mensagem ignorada.`);
          return;
        }

        const novoHistorico = [
          ...(aluno.historico || []),
          { tipo: "entrada", texto: corpo, data: new Date().toISOString() },
        ];

        const { error: updateError } = await supabase
          .from("alunos")
          .update({
            respondeu: true,
            ultima_resposta: corpo,
            data_resposta: new Date().toISOString(),
            status: "concluido",
            historico: novoHistorico,
          })
          .eq("id", aluno.id);

        if (updateError) {
          console.error("❌ Erro ao salvar no banco:", updateError.message);
        } else {
          console.log(
            `✅ Salvo! Aluno: "${aluno.nome}" | Mensagem: "${corpo}"`,
          );
        }
      } catch (err) {
        console.error("❌ Erro inesperado no onMessage:", err.message);
      }
    });
  })
  .catch((err) => {
    console.error("❌ Erro ao iniciar WPPConnect:", err.message);
  });

// ─── POST /send-bulk ──────────────────────────────────────────────────────────
app.post("/send-bulk", verificarToken, async (req, res) => {
  const { message, students, limit = 50 } = req.body;

  if (!whatsappClient)
    return res.status(503).json({ error: "WhatsApp não conectado." });

  const lote = students.slice(0, limit);
  res.json({ status: `Lote de ${lote.length} mensagens iniciado.` });

  (async () => {
    for (const student of lote) {
      try {
        let num = String(student.telefone).replace(/\D/g, "");
        if (!num.startsWith("55")) num = "55" + num;

        const check = await whatsappClient.checkNumberStatus(`${num}@c.us`);
        if (!check.canReceiveMessage)
          throw new Error("Número sem WhatsApp ativo");

        const msg = message
          .replace(/{nome}/g, student.nome || "")
          .replace(/{curso}/g, student.curso || "");

        await whatsappClient.sendText(check.id._serialized, msg);

        const { data: atual } = await supabase
          .from("alunos")
          .select("historico")
          .eq("id", student.id)
          .single();

        const hist = [
          ...(atual?.historico || []),
          { tipo: "saida", texto: msg, data: new Date().toISOString() },
        ];

        await supabase
          .from("alunos")
          .update({
            status: "enviado",
            data_envio: new Date().toISOString(),
            historico: hist,
          })
          .eq("id", student.id);

        console.log(`✅ Enviado → ${student.nome}`);
        if (lote.indexOf(student) < lote.length - 1) {
          await new Promise((r) => setTimeout(r, 15000));
        }
      } catch (err) {
        console.error(`❌ Falha → ${student.nome}:`, err.message);
        await supabase
          .from("alunos")
          .update({ status: "erro" })
          .eq("id", student.id);
      }
    }
    console.log("🏁 Lote finalizado.");
  })();
});


// ─── POST /send-audio ─────────────────────────────────────────────────────────
app.post("/send-audio", verificarToken, async (req, res) => {
  const { student, audioBase64 } = req.body;
  if (!whatsappClient)
    return res.status(503).json({ error: "WhatsApp não conectado." });

  try {
    let num = String(student.telefone).replace(/\D/g, "");
    if (!num.startsWith("55")) num = "55" + num;
    const check = await whatsappClient.checkNumberStatus(`${num}@c.us`);
    if (!check.canReceiveMessage) throw new Error("Número sem WhatsApp ativo");

    await whatsappClient.sendVoice(check.id._serialized, audioBase64);

    const { data: atual } = await supabase
      .from("alunos").select("historico").eq("id", student.id).single();

    const hist = [
      ...(atual?.historico || []),
      { tipo: "saida", texto: audioBase64, mimetype: "audio/ogg", data: new Date().toISOString() },
    ];

    await supabase.from("alunos")
      .update({ historico: hist })
      .eq("id", student.id);

    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao enviar áudio:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Iniciar servidor ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor Geração Tech 3.0 rodando na porta ${PORT}`);
  console.log(`📧 E-mail: ${process.env.EMAIL_USER || "⚠️ Não configurado"}`);
  console.log(
    `🔒 JWT: ${SECRET_KEY !== "gtech_dev_secret_troque_em_producao" ? "✅ Configurado" : "⚠️ Usando chave padrão"}\n`,
  );
});
