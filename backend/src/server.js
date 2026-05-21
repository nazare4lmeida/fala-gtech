const express = require("express");
const wppconnect = require("@wppconnect-team/wppconnect");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

// Conexão com o Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

let whatsappClient;

// Inicialização do WPPConnect
wppconnect
  .create({
    session: "geracao-tech",
    autoClose: false, // Mantém a sessão aberta para não deslogar
    statusFind: (statusSession, session) => {
      console.log("Status da Sessão:", statusSession);
    },
    puppeteerOptions: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: null, // O WPPConnect encontrará o Chrome automaticamente
    },
  })
  .then((client) => {
    whatsappClient = client;
    console.log("✅ WhatsApp Conectado com sucesso para o Geração Tech!");

    // --- ESCUTADOR DE MENSAGENS RECEBIDAS (CORREÇÃO HISTÓRICO) ---
    client.onMessage(async (message) => {
      // Ignora mensagens de grupo e foca no contato individual
      if (message.isGroupMsg === false) {
        const remetente = message.sender.pushname || message.from;
        const telLimpo = message.from.replace("@c.us", ""); // Extrai apenas os números

        console.log(`\n📩 NOVA RESPOSTA de [${remetente}]:`);
        console.log(`💬 Conteúdo: ${message.body}`);
        console.log("---------------------------------------");

        // 1. Busca o histórico atual desse aluno no banco para não sobrescrever
        const { data: aluno } = await supabase
          .from("alunos")
          .select("historico")
          .ilike("telefone", `%${telLimpo.slice(-8)}%`)
          .single();

        // 2. Prepara o novo histórico adicionando a mensagem de ENTRADA (aluno)
        const novoHistorico = [
          ...(aluno?.historico || []),
          {
            tipo: "entrada", // Aparecerá na esquerda no chat
            texto: message.body,
            data: new Date().toISOString(),
          },
        ];

        // 3. Atualiza o banco com o histórico COMPLETO
        const { error } = await supabase
          .from("alunos")
          .update({
            respondeu: true,
            ultima_resposta: message.body,
            data_resposta: new Date(),
            status: "concluido",
            historico: novoHistorico, // Salva a lista atualizada
          })
          .ilike("telefone", `%${telLimpo.slice(-8)}%`);

        if (error)
          console.error("Erro ao registrar resposta no banco:", error.message);
      }
    });

    // Endpoint para envio de Lotes (Segurança: 50 por vez)
    app.post("/send-bulk", async (req, res) => {
      const { message, students, limit = 50 } = req.body;

      if (!whatsappClient) {
        return res
          .status(500)
          .send({ error: "WhatsApp ainda não está conectado." });
      }

      // Resposta imediata para evitar timeout no Frontend
      res.send({
        status: `Processamento de lote iniciado para ${limit} alunos.`,
      });

      let sentCount = 0;

      for (const student of students) {
        if (sentCount >= limit) {
          console.log(
            `\n🛑 Lote finalizado: ${sentCount} mensagens enviadas hoje.`,
          );
          break;
        }

        try {
          // 1. Limpeza do número
          let rawNumber = String(student.telefone).replace(/\D/g, "");
          if (!rawNumber.startsWith("55")) rawNumber = "55" + rawNumber;

          const contactId = `${rawNumber}@c.us`;
          console.log(`🔍 Validando contato: ${contactId}`);

          // 2. Resolve o LID interno
          const checkContact =
            await whatsappClient.checkNumberStatus(contactId);

          if (checkContact.canReceiveMessage) {
            // 3. Formata mensagem
            const finalMessage = message
              .replace(/{nome}/g, student.nome || "")
              .replace(/{curso}/g, student.curso || "");

            // 4. Envia
            await whatsappClient.sendText(
              checkContact.id._serialized,
              finalMessage,
            );

            // 5. ATUALIZAÇÃO DO HISTÓRICO (SAÍDA)
            // Buscamos o histórico atual antes de atualizar
            const { data: currentStudent } = await supabase
              .from("alunos")
              .select("historico")
              .eq("id", student.id)
              .single();

            const novoHistorico = [
              ...(currentStudent?.historico || []),
              {
                tipo: "saida", // Aparecerá na direita (verde) no chat
                texto: finalMessage,
                data: new Date().toISOString(),
              },
            ];

            const { error: dbError } = await supabase
              .from("alunos")
              .update({
                status: "enviado",
                data_envio: new Date(),
                historico: novoHistorico,
              })
              .eq("id", student.id);

            if (dbError)
              console.error("Erro ao atualizar banco:", dbError.message);

            sentCount++;
            console.log(`✅ [${sentCount}] Enviado para: ${student.nome}`);
          } else {
            throw new Error(
              "LID não encontrado: Este número não possui WhatsApp.",
            );
          }

          // Delay de segurança de 15 segundos
          await new Promise((r) => setTimeout(r, 15000));
        } catch (err) {
          console.error(`❌ Erro no envio para ${student.nome}:`, err.message);
          await supabase
            .from("alunos")
            .update({ status: "erro" })
            .eq("id", student.id);
        }
      }
    });

    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`🚀 Servidor CRM Geração Tech rodando na porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Erro ao inicializar WPPConnect:", err);
  });
