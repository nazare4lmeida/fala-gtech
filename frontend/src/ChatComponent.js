import React from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';

const ChatComponent = ({ 
  todosAlunos, 
  alunoSelecionado, 
  setAlunoSelecionado, 
  textoChat, 
  setTextoChat, 
  enviarMensagemChat 
}) => {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "20px", height: "650px" }}>
            {/* Lista Lateral */}
            <div style={{ borderRight: "1px solid #ddd", overflowY: "auto", background: '#fff' }}>
                {todosAlunos.filter(a => a.status !== 'pendente').map(aluno => (
                    <div key={aluno.id} onClick={() => setAlunoSelecionado(aluno)} 
                         style={{ padding: "15px", cursor: "pointer", borderBottom: '1px solid #eee', 
                         background: alunoSelecionado?.id === aluno.id ? '#e3f2fd' : 'transparent' }}>
                        <strong>{aluno.nome}</strong>
                        <div style={{ fontSize: '0.8em', color: '#666' }}>{aluno.telefone}</div>
                    </div>
                ))}
            </div>

            {/* Janela do Chat */}
            <div style={{ display: "flex", flexDirection: "column", background: "#f0f2f5" }}>
                {alunoSelecionado ? (
                    <>
                        <div style={{ padding: '15px', background: '#fff', borderBottom: '1px solid #ddd' }}>
                            <strong>{alunoSelecionado.nome}</strong>
                        </div>
                        <div style={{ flex: 1, padding: "20px", overflowY: "auto", display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {(alunoSelecionado.historico || []).map((msg, idx) => (
                                <div key={idx} style={{
                                    alignSelf: msg.tipo === 'saida' ? 'flex-end' : 'flex-start',
                                    background: msg.tipo === 'saida' ? '#dcf8c6' : '#fff',
                                    padding: '8px 12px', borderRadius: '8px', maxWidth: '70%', boxShadow: '0 1px 1px rgba(0,0,0,0.1)'
                                }}>
                                    {msg.texto}
                                    <div style={{ fontSize: '0.6em', textAlign: 'right', marginTop: '4px', color: '#999' }}>
                                        {new Date(msg.data).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: "flex", gap: "10px", padding: "15px", background: '#fff' }}>
                            <InputText value={textoChat} onChange={(e) => setTextoChat(e.target.value)} 
                                       onKeyPress={(e) => e.key === 'Enter' && enviarMensagemChat()}
                                       style={{ flex: 1 }} placeholder="Digite sua resposta..." />
                            <Button icon="pi pi-send" onClick={enviarMensagemChat} className="p-button-rounded" />
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        Selecione um aluno para ver o histórico.
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatComponent;