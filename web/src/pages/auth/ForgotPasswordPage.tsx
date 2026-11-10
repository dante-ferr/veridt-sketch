import { FormEvent, useState } from "react";
import { AuthBrandLockup } from "@/components/auth/AuthBrandLockup";
import {
  ActionRow,
  Button,
  Card,
  Field,
  Heading,
  Hint,
  Input,
  Text,
  TextLink,
} from "@/components/ui";
import { api, userMessage } from "@/services/api";
import "./auth.css";
import "./auth-screen.css";
import "./ForgotPasswordPage.css";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      await api("/v1/password-recoveries", { method: "POST", body: { email } });
    } catch (caught) {
      setError(userMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="page auth-screen forgot-password">
      <AuthBrandLockup />
      <div className="pair">
        <Card as="form" className="auth-card" onSubmit={onSubmit}>
          <Heading size="card">Recuperar senha</Heading>
          <Text muted>
            Informe o e-mail cadastrado. Enviaremos um link de uso único, válido
            por 30 minutos.
          </Text>
          {error ? (
            <p className="alert" role="alert">
              {error}
            </p>
          ) : null}
          <Field label="E-mail cadastrado" htmlFor="recovery-email">
            <Input
              id="recovery-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome@exemplo.com.br"
            />
          </Field>
          <ActionRow>
            <TextLink to="/">Voltar ao login</TextLink>
            <Button type="submit" disabled={pending}>
              Enviar link
            </Button>
          </ActionRow>
        </Card>

        <Card className="auth-card">
          <Heading size="card">Verifique seu e-mail</Heading>
          <Text muted>
            Se houver uma conta com este e-mail, você receberá o link em alguns
            minutos.
          </Text>
          <Hint>
            Por segurança, a mensagem é a mesma quando o e-mail não está
            cadastrado. O link expira após o primeiro uso.
          </Hint>
          <Button
            variant="outline"
            className="resend"
            onClick={() => void onSubmit({ preventDefault() {} } as FormEvent)}
            disabled={pending || email.length === 0}
          >
            Reenviar link
          </Button>
        </Card>
      </div>
    </main>
  );
}
