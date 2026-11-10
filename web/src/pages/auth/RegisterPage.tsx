import { FormEvent, useState } from "react";
import { AuthBrandLockup } from "@/components/auth/AuthBrandLockup";
import {
  ActionRow,
  Button,
  Card,
  Field,
  Heading,
  Input,
  Text,
  TextLink,
} from "@/components/ui";
import {
  DevExampleFill,
  loadDevSamples,
} from "@/components/dev/DevExampleFill";
import { api, userMessage } from "@/services/api";
import type { Profile } from "@/types/auth";
import { maskCpf } from "@/utils/cpf";
import "./auth.css";
import "./auth-screen.css";
import "./RegisterPage.css";

export function RegisterPage() {
  const [profile, setProfile] = useState<Profile>("lawyer");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [oab, setOab] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== passwordConfirmation) {
      setPasswordError(true);
      return;
    }
    setPasswordError(false);
    setPending(true);
    try {
      await api("/v1/accounts", {
        method: "POST",
        body: {
          profile,
          fullName,
          email,
          cpf: cpf.replace(/\D/g, ""),
          oab: profile === "lawyer" ? oab : undefined,
          password,
          passwordConfirmation,
          acceptedTerms,
        },
      });
      setDone(true);
    } catch (caught) {
      setError(userMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function fillExample() {
    const samples = await loadDevSamples();
    if (!samples) return;
    const sample = samples.registrationSample(profile);
    setFullName(sample.fullName);
    setEmail(sample.email);
    setCpf(sample.cpf);
    setOab(sample.oab);
    setPassword(sample.password);
    setPasswordConfirmation(sample.password);
    setAcceptedTerms(true);
    setPasswordError(false);
  }

  return (
    <main className="page auth-screen register">
      <AuthBrandLockup />
      <Card as="form" className="register-card" onSubmit={onSubmit}>
        {done ? (
          <>
            <Heading size="page">Verifique seu e-mail</Heading>
            <Text muted>
              Enviamos um link de confirmação. Abra o e-mail e confirme antes de
              entrar.
            </Text>
            <p className="below">
              <TextLink to="/">Ir para o login</TextLink>
            </p>
          </>
        ) : (
          <>
            <Heading size="page">Criar conta</Heading>
            {error ? (
              <p className="alert" role="alert">
                {error}
              </p>
            ) : null}
            <div className="option-group">
              <p className="label">Tipo de conta</p>
              <div className="types">
                <label
                  className={profile === "lawyer" ? "type selected" : "type"}
                >
                  <input
                    type="radio"
                    name="profile"
                    checked={profile === "lawyer"}
                    onChange={() => setProfile("lawyer")}
                  />
                  <span>
                    <strong>Advogado</strong>
                    Informe o número da OAB.
                  </span>
                </label>
                <label
                  className={
                    profile === "common_user" ? "type selected" : "type"
                  }
                >
                  <input
                    type="radio"
                    name="profile"
                    checked={profile === "common_user"}
                    onChange={() => setProfile("common_user")}
                  />
                  <span>
                    <strong>Usuário comum</strong>
                    Pessoa física, sem OAB.
                  </span>
                </label>
              </div>
            </div>
            <Field label="Nome completo" htmlFor="full-name">
              <Input
                id="full-name"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Ana Ribeiro"
              />
            </Field>
            <Field label="E-mail" htmlFor="register-email" hint="Enviaremos um link de confirmação para este endereço.">
              <Input
                id="register-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@exemplo.com.br"
              />
            </Field>
            <div className="split">
              <Field label="CPF" htmlFor="cpf" hint="Somente números.">
                <Input
                  id="cpf"
                  inputMode="numeric"
                  required
                  value={cpf}
                  onChange={(event) => setCpf(maskCpf(event.target.value))}
                  placeholder="000.000.000-00"
                />
              </Field>
              {profile === "lawyer" ? (
                <Field label="Número da OAB" htmlFor="oab">
                  <Input
                    id="oab"
                    required
                    value={oab}
                    onChange={(event) => setOab(event.target.value)}
                    placeholder="UF 000000"
                  />
                </Field>
              ) : null}
            </div>
            <Field label="Senha" htmlFor="new-password" hint="Mínimo de 8 caracteres.">
              <Input
                id="new-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <Field
              label="Confirmar senha"
              htmlFor="confirm-password"
              error={passwordError ? "As senhas não conferem." : undefined}
            >
              <Input
                id="confirm-password"
                invalid={passwordError}
                type="password"
                required
                value={passwordConfirmation}
                onChange={(event) => {
                  setPasswordConfirmation(event.target.value);
                  setPasswordError(false);
                }}
                placeholder="••••••••"
              />
            </Field>
            <label className="check">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
              />
              <span>
                Li e aceito os termos de uso e a política de privacidade.
              </span>
            </label>
            <DevExampleFill onClick={() => void fillExample()} />
            <ActionRow>
              <TextLink to="/">Já tenho conta</TextLink>
              <Button type="submit" disabled={pending}>
                Criar conta
              </Button>
            </ActionRow>
          </>
        )}
      </Card>
      <p className="fine">
        Empresas poderão se cadastrar em uma próxima versão. Telefone e endereço
        são pedidos apenas na compra de créditos.
      </p>
    </main>
  );
}
