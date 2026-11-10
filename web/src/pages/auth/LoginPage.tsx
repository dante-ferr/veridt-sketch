import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthBrandLockup } from "@/components/auth/AuthBrandLockup";
import { api, userMessage } from "@/services/api";
import { saveSession } from "@/services/session-store";
import "./auth.css";
import "./LoginPage.css";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const tokens = await api<{ accessToken: string; refreshToken: string }>(
        "/v1/sessions",
        {
          method: "POST",
          body: { email, password },
        },
      );
      saveSession(tokens.accessToken, tokens.refreshToken);
      navigate("/records");
    } catch (caught) {
      setError(userMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="page login">
      <AuthBrandLockup />
      <p className="subtitle">
        Registro de evidências digitais com hash, data e hora verificáveis.
      </p>
      <form className="card" onSubmit={onSubmit}>
        <h2>Entrar</h2>
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nome@exemplo.com.br"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="row">
          <Link to="/forgot-password">Esqueci minha senha</Link>
          <button className="primary" type="submit" disabled={pending}>
            Entrar
          </button>
        </div>
        <p className="note">
          Após 5 tentativas sem sucesso, o acesso fica bloqueado por alguns
          minutos.
        </p>
      </form>
      <p className="below">
        Ainda não tem conta? <Link to="/register">Cadastre-se</Link>
      </p>
    </main>
  );
}
