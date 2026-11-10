import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthBrandLockup } from "@/components/auth/AuthBrandLockup";
import {
  ActionRow,
  Button,
  Card,
  Field,
  Heading,
  Hint,
  Input,
  TextLink,
} from "@/components/ui";
import { api, userMessage } from "@/services/api";
import { saveSession } from "@/services/session-store";
import "./auth.css";
import "./auth-screen.css";
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
    <main className="page auth-screen login">
      <AuthBrandLockup />
      <p className="subtitle">
        Registro de evidências digitais com hash, data e hora verificáveis.
      </p>
      <Card as="form" className="auth-card" onSubmit={onSubmit}>
        <Heading size="card">Entrar</Heading>
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
        <Field label="E-mail" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nome@exemplo.com.br"
          />
        </Field>
        <Field label="Senha" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <ActionRow>
          <TextLink to="/forgot-password">Esqueci minha senha</TextLink>
          <Button type="submit" disabled={pending}>
            Entrar
          </Button>
        </ActionRow>
        <Hint>
          Após 5 tentativas sem sucesso, o acesso fica bloqueado por alguns
          minutos.
        </Hint>
      </Card>
      <p className="below">
        Ainda não tem conta? <TextLink size="md" to="/register">
          Cadastre-se
        </TextLink>
      </p>
    </main>
  );
}
