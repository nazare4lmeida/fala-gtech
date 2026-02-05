import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import axios from "axios";
import { supabase } from "./supabaseClient";
import "./App.css";
import ChatComponent from "./ChatComponent";

// Componentes PrimeReact
import { Button } from "primereact/button";
import { InputTextarea } from "primereact/inputtextarea";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Tag } from "primereact/tag";
import { TabView, TabPanel } from "primereact/tabview";
import { InputText } from "primereact/inputtext";

// Estilos obrigatórios do PrimeReact
import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

function App() {
  const [alunosPendentes, setAlunosPendentes] = useState([]);
  const [todosAlunos, setTodosAlunos] = useState([]);
  const [selecionados, setSelecionados] = useState([]);
  const [mensagem, setMensagem] = useState(
    "Olá {nome}, confirmamos sua inscrição no curso de {curso}!",
  );
  const [loading, setLoading] = useState(false);

  // NOVOS ESTADOS PARA O CHAT
  const [alunoSelecionado, setAlunoSelecionado] = useState(null);
  const [textoChat, setTextoChat] = useState("");

  // Função para excluir contato definitivamente
  const excluirContato = async (id) => {
    if (
      window.confirm(
        "Nazaré, tem certeza que deseja excluir este aluno definitivamente?",
      )
    ) {
      const { error } = await supabase.from("alunos").delete().eq("id", id);

      if (error) {
        alert("Erro ao excluir do banco de dados.");
      } else {
        carregarDados(); // Atualiza a lista e o dashboard na hora
      }
    }
  };

  // 1. Carregar dados das listas
  const carregarDados = async () => {
    // Busca todos os alunos organizando por status e data
    const { data: todos } = await supabase
      .from("alunos")
      .select("*")
      .order("status", { ascending: false }) // 'pendente' vem antes de 'enviado'
      .order("created_at", { ascending: false });

    if (todos) {
      setTodosAlunos(todos);
      // Filtra apenas os pendentes para a lista de disparos
      setAlunosPendentes(todos.filter((a) => a.status === "pendente"));
    }
  };

  useEffect(() => {
    carregarDados(); // Carrega ao abrir a página

    // Cria o intervalo de 10 segundos (10000ms)
    const intervalo = setInterval(() => {
      console.log("Atualizando chat e dashboard...");
      carregarDados();
    }, 10000);

    // Limpa o intervalo se você fechar a aba ou o sistema
    return () => clearInterval(intervalo);
  }, [alunoSelecionado]); // Ele se reinicia se você trocar de aluno no chat
  // 2. Importação de Excel
  const handleImport = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(ws);

      const vistos = new Set();
      const alunosUnicos = [];

      for (const aluno of rawData) {
        const telOriginal = aluno.telefone;
        const telLimpo = String(telOriginal).replace(/\D/g, "");

        if (!vistos.has(telLimpo) && telLimpo !== "") {
          vistos.add(telLimpo);
          alunosUnicos.push({
            nome: aluno.nome,
            telefone: String(telOriginal),
            curso: aluno.curso,
            status: "pendente",
            respondeu: false,
          });
        }
      }

      const { error } = await supabase.from("alunos").insert(alunosUnicos);

      if (error) {
        console.error("Erro Supabase:", error);
        alert("Erro ao salvar. Verifique se as colunas existem no banco.");
      } else {
        alert(`${alunosUnicos.length} alunos importados com sucesso!`);
        carregarDados();
      }
    };
    reader.readAsBinaryString(file);
  };

  // 3. Disparo em Lote
  const dispararMensagens = async () => {
    if (alunosPendentes.length === 0) return;

    setLoading(true);
    try {
      await axios.post("http://localhost:3001/send-bulk", {
        message: mensagem,
        students: alunosPendentes,
        limit: 50,
      });
      alert("Lote de 50 mensagens iniciado!");
    } catch (error) {
      alert("Erro ao conectar ao servidor.");
    } finally {
      setLoading(false);
      setTimeout(carregarDados, 3000);
    }
  };

  const dispararSelecionados = async () => {
    if (selecionados.length === 0) return;
    setLoading(true);
    try {
      const response = await axios.post("http://localhost:3001/send-bulk", {
        message: mensagem,
        students: selecionados,
        limit: selecionados.length,
      });

      if (response.status === 200) {
        alert(`Processo iniciado! Verifique as mensagens chegando.`);
        setSelecionados([]);

        let tentativas = 0;
        const intervalo = setInterval(() => {
          carregarDados();
          tentativas++;
          if (tentativas >= 5) clearInterval(intervalo);
        }, 10000);
      }
    } catch (error) {
      alert("Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  // NOVA FUNÇÃO: Enviar resposta pelo Chat/Sistema
  const enviarRespostaChat = async () => {
    if (!textoChat || !alunoSelecionado) return;

    const { error } = await supabase
      .from("alunos")
      .update({
        ultima_resposta: textoChat,
        status: "concluido",
        respondeu: true,
      })
      .eq("id", alunoSelecionado.id);

    if (!error) {
      setTextoChat("");
      carregarDados();
      alert("Resposta/Feedback salvo no sistema!");
    } else {
      alert("Erro ao salvar resposta.");
    }
  };

  const excluirEmMassa = async () => {
    if (selecionados.length === 0) return;

    if (
      window.confirm(
        `Deseja excluir permanentemente os ${selecionados.length} contatos selecionados?`,
      )
    ) {
      const idsParaExcluir = selecionados.map((s) => s.id);

      const { error } = await supabase
        .from("alunos")
        .delete()
        .in("id", idsParaExcluir);

      if (!error) {
        setSelecionados([]);
        carregarDados();
        alert("Contatos excluídos com sucesso!");
      } else {
        alert("Erro ao excluir contatos.");
      }
    }
  };

  // 4. Edição de Linha (CRM)
  const onRowEditComplete = async (e) => {
    let { newData } = e;

    const { error } = await supabase
      .from("alunos")
      .update({
        nome: newData.nome,
        telefone: newData.telefone,
        curso: newData.curso,
        status: newData.status,
        ultima_resposta: newData.ultima_resposta,
      })
      .eq("id", newData.id);

    if (error) {
      alert("Erro ao salvar as alterações no banco de dados.");
      console.error(error);
    } else {
      carregarDados();
    }
  };

  // 5. Exportar para Excel
  const exportarRelatorio = () => {
    const dadosExportar = todosAlunos.map((a) => ({
      Nome: a.nome,
      Telefone: a.telefone,
      Curso: a.curso,
      Status: a.status,
      Interagiu: a.respondeu ? "Sim" : "Não",
      Feedback: a.ultima_resposta || "Sem observações",
      Data_Envio: a.data_envio
        ? new Date(a.data_envio).toLocaleString()
        : "N/A",
    }));

    const ws = XLSX.utils.json_to_sheet(dadosExportar);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatorio_Geral");
    XLSX.writeFile(wb, "CRM_Geracao_Tech_Atualizado.xlsx");
  };

  // Templates Visuais
  const statusBodyTemplate = (rowData) => (
    <Tag
      value={rowData.status}
      severity={
        rowData.status === "enviado" || rowData.status === "concluido"
          ? "success"
          : "warning"
      }
    />
  );

  const respondeuBodyTemplate = (rowData) => (
    <Tag
      value={rowData.respondeu ? "SIM" : "NÃO"}
      severity={rowData.respondeu ? "info" : "danger"}
    />
  );

  const textEditor = (options) => {
    return (
      <InputText
        type="text"
        value={options.value}
        onChange={(e) => options.editorCallback(e.target.value)}
      />
    );
  };

  // Nova função para enviar mensagens individuais pelo chat e salvar no histórico
  // Nazaré, esta função fica AQUI, fora do return.
  const enviarMensagemChat = async () => {
    if (!textoChat || !alunoSelecionado) return;

    try {
      await axios.post("http://localhost:3001/send-bulk", {
        message: textoChat,
        students: [alunoSelecionado],
        limit: 1,
      });

      const novoHistorico = [
        ...(alunoSelecionado.historico || []),
        {
          tipo: "saida",
          texto: textoChat,
          data: new Date().toISOString(),
        },
      ];

      const { error } = await supabase
        .from("alunos")
        .update({
          historico: novoHistorico,
          status: "concluido",
          ultima_resposta: textoChat,
        })
        .eq("id", alunoSelecionado.id);

      if (error) throw error;

      setTextoChat("");
      carregarDados();
    } catch (error) {
      console.error("Erro ao enviar mensagem pelo chat:", error);
      alert("Erro ao enviar mensagem. Verifique se o backend está rodando.");
    }
  };

  return (
    <div className="main-container">
      <header className="header-section">
        <h1>Geração Tech CRM 3.0</h1>
        <p>Gestão de alunos, disparos em lote e acompanhamento de feedbacks.</p>
      </header>

      <TabView>
        <TabPanel header="Envio de Lotes" leftIcon="pi pi-send mr-2">
          <div className="custom-card">
            <h3>Importar e Configurar</h3>
            <div style={{ display: "flex", gap: "15px", marginBottom: "20px" }}>
              <input type="file" onChange={handleImport} accept=".xlsx, .xls" />
              <Button
                icon="pi pi-refresh"
                className="p-button-text"
                onClick={carregarDados}
              />
            </div>
            <InputTextarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={5}
              style={{ width: "100%" }}
              placeholder="Mensagem..."
            />
            <div style={{ display: "flex", gap: "15px", marginTop: "20px" }}>
              <Button
                label={loading ? "Enviando..." : `Enviar Lote (Próximos 50)`}
                icon="pi pi-forward"
                className="p-button-outlined p-button-secondary"
                onClick={dispararMensagens}
                disabled={loading || alunosPendentes.length === 0}
              />
              <Button
                label={`Enviar Selecionados (${selecionados.length})`}
                icon="pi pi-check-circle"
                className="p-button-success"
                onClick={dispararSelecionados}
                disabled={loading || selecionados.length === 0}
              />
            </div>
          </div>

          <DataTable
            value={alunosPendentes}
            selection={selecionados}
            onSelectionChange={(e) => setSelecionados(e.value)}
            dataKey="id"
            paginator
            rows={10}
            className="custom-table"
            stripedRows
          >
            <Column
              selectionMode="multiple"
              headerStyle={{ width: "3rem" }}
            ></Column>
            <Column field="nome" header="Nome" sortable />
            <Column field="telefone" header="Telefone" />
            <Column field="curso" header="Curso" sortable />
            <Column header="Status" body={statusBodyTemplate} />
          </DataTable>
        </TabPanel>

        <TabPanel header="Chat em Tempo Real" leftIcon="pi pi-comments mr-2">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "300px 1fr",
              gap: "20px",
              height: "600px",
            }}
          >
            {/* Lista Lateral de Alunos que já foram contatados */}
            <div
              style={{
                borderRight: "1px solid #ddd",
                overflowY: "auto",
                background: "#fff",
              }}
            >
              {todosAlunos
                .filter((a) => a.status !== "pendente")
                .map((aluno) => (
                  <div
                    key={aluno.id}
                    onClick={() => setAlunoSelecionado(aluno)}
                    style={{
                      padding: "15px",
                      cursor: "pointer",
                      backgroundColor:
                        alunoSelecionado?.id === aluno.id ? "#e3f2fd" : "white",
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    <strong>{aluno.nome}</strong>
                    <p style={{ margin: 0, fontSize: "0.8em", color: "#666" }}>
                      {aluno.ultima_resposta?.substring(0, 30) ||
                        "Sem mensagens..."}
                    </p>
                  </div>
                ))}
            </div>

            {/* Janela de Mensagens Estilo WhatsApp */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                background: "#f0f2f5",
              }}
            >
              {alunoSelecionado ? (
                <>
                  <div
                    style={{
                      padding: "15px",
                      background: "#fff",
                      borderBottom: "1px solid #ddd",
                    }}
                  >
                    <strong>Conversando com: {alunoSelecionado.nome}</strong>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      padding: "20px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {/* Mapeia o histórico para criar bolhas de ENTRADA e SAÍDA */}
                    {(alunoSelecionado.historico || []).map((msg, idx) => (
                      <div
                        key={idx}
                        style={{
                          alignSelf:
                            msg.tipo === "saida" ? "flex-end" : "flex-start",
                          background: msg.tipo === "saida" ? "#dcf8c6" : "#fff",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          maxWidth: "70%",
                          boxShadow: "0 1px 1px rgba(0,0,0,0.1)",
                          fontSize: "0.9em",
                        }}
                      >
                        {msg.texto}
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      padding: "15px",
                      background: "#fff",
                    }}
                  >
                    <InputText
                      value={textoChat}
                      onChange={(e) => setTextoChat(e.target.value)}
                      style={{ flex: 1 }}
                      placeholder="Digite sua resposta..."
                      onKeyPress={(e) =>
                        e.key === "Enter" && enviarMensagemChat()
                      }
                    />
                    <Button icon="pi pi-send" onClick={enviarMensagemChat} />
                  </div>
                </>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "#888",
                  }}
                >
                  Selecione um aluno na lista ao lado para ver a conversa.
                </div>
              )}
            </div>
          </div>
        </TabPanel>

        <TabPanel header="Gestão & Relatórios" leftIcon="pi pi-users mr-2">
          <div
            className="custom-card"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div>
              <h3>Base de Dados Geral</h3>
              <p>
                <small>
                  Selecione os contatos para exclusão em massa ou use o lápis
                  para editar.
                </small>
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              {/* Botão de Excluir em Massa - Só aparece se houver selecionados */}
              {selecionados.length > 0 && (
                <Button
                  label={`Excluir (${selecionados.length})`}
                  icon="pi pi-trash"
                  className="p-button-danger"
                  onClick={excluirEmMassa}
                />
              )}
              <Button
                label="Exportar Excel"
                icon="pi pi-file-excel"
                className="p-button-success"
                onClick={exportarRelatorio}
              />
            </div>
          </div>

          <DataTable
            value={todosAlunos}
            selection={selecionados}
            onSelectionChange={(e) => setSelecionados(e.value)}
            dataKey="id"
            editMode="row"
            onRowEditComplete={onRowEditComplete}
            paginator
            rows={10}
          >
            {/* Coluna de Checkbox para seleção */}
            <Column
              selectionMode="multiple"
              headerStyle={{ width: "3rem" }}
            ></Column>

            <Column
              field="nome"
              header="Nome"
              editor={(o) => textEditor(o)}
              sortable
            />
            <Column
              field="telefone"
              header="Telefone"
              editor={(o) => textEditor(o)}
            />
            <Column
              field="status"
              header="Status"
              body={statusBodyTemplate}
              editor={(o) => textEditor(o)}
            />
            <Column
              field="ultima_resposta"
              header="Feedback"
              editor={(options) => (
                <InputTextarea
                  value={options.value || ""}
                  onChange={(e) => options.editorCallback(e.target.value)}
                  rows={2}
                  style={{ width: "100%" }}
                />
              )}
            />

            <Column
              rowEditor
              headerStyle={{ width: "7rem" }}
              bodyStyle={{ textAlign: "center" }}
            />

            {/* Botão de Excluir Individual */}
            <Column
              body={(rowData) => (
                <Button
                  icon="pi pi-trash"
                  className="p-button-danger p-button-text"
                  onClick={() => excluirContato(rowData.id)}
                />
              )}
            />
          </DataTable>
        </TabPanel>
        <TabPanel header="Dashboard" leftIcon="pi pi-chart-bar mr-2">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "20px",
            }}
          >
            <div className="stat-box">
              <h4>Total de Alunos</h4>
              <h2>{todosAlunos.length}</h2>
            </div>
            <div className="stat-box">
              <h4>Contatados</h4>
              <h2>
                {
                  todosAlunos.filter(
                    (a) => a.status === "enviado" || a.status === "concluido",
                  ).length
                }
              </h2>
            </div>
            <div className="stat-box">
              <h4>Respostas Recebidas</h4>
              <h2>{todosAlunos.filter((a) => a.respondeu).length}</h2>
            </div>
          </div>
          <div className="custom-card" style={{ marginTop: "20px" }}>
            <h3>Taxa de Engajamento</h3>
            <h1 style={{ color: "var(--accent-blue)", fontSize: "3rem" }}>
              {(
                (todosAlunos.filter((a) => a.respondeu).length /
                  todosAlunos.length) *
                  100 || 0
              ).toFixed(1)}
              %
            </h1>
            <p>Dos alunos cadastrados interagiram com suas mensagens.</p>
          </div>
        </TabPanel>
      </TabView>
    </div>
  );
}

export default App;
