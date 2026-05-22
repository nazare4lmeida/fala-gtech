import React, { useState } from "react";
import axios from "axios";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const handleLogin = async (e) => {
  e?.preventDefault();
  if (!email || !senha) {
    setErro("Preencha e-mail e senha.");
    return;
  }
  setErro("");
  setCarregando(true);

  // ← adiciona só essa linha
  const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:3001";

  try {
    const res = await axios.post(`${BACKEND}/login`, { email, senha });
    localStorage.setItem("token", res.data.token);
    localStorage.setItem("nomeUsuario", res.data.nome);
    onLogin(res.data.token);
  } catch (err) {
    setErro(err.response?.data?.error || "Falha na conexão com o servidor.");
  } finally {
    setCarregando(false);
  }
};
  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">
          <div className="login-logo-icon">GT</div>
          <h1>Geração Tech</h1>
          <p>Sistema de Gestão e Comunicação 3.0</p>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          {erro && (
            <div className="login-erro">
              <i className="pi pi-exclamation-triangle" />
              {erro}
            </div>
          )}

          <div className="login-field">
            <label>E-mail</label>
            <div className="login-input-wrapper">
              <i className="pi pi-envelope" />
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </div>
          </div>

          <div className="login-field">
            <label>Senha</label>
            <div className="login-input-wrapper">
              <i className="pi pi-lock" />
              <input
                type={mostrarSenha ? "text" : "password"}
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-toggle-senha"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                tabIndex={-1}
              >
                <i className={`pi ${mostrarSenha ? "pi-eye-slash" : "pi-eye"}`} />
              </button>
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={carregando}>
            {carregando ? (
              <>
                <i className="pi pi-spin pi-spinner" /> Entrando...
              </>
            ) : (
              <>
                <i className="pi pi-sign-in" /> Entrar
              </>
            )}
          </button>
        </form>

        <p className="login-footer">
          © {new Date().getFullYear()} Geração Tech — IEL-CE
        </p>
      </div>
    </div>
  );
}
