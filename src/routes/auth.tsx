import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth/auth-client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar ou criar conta | Marca Minha Vez" },
      {
        name: "description",
        content:
          "Acesse o painel do seu estabelecimento para gerenciar agenda, serviços e profissionais.",
      },
      { property: "og:title", content: "Entrar ou criar conta | Marca Minha Vez" },
      {
        property: "og:description",
        content: "Painel de gestão de agendamentos do Marca Minha Vez.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "register" | "recover";

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { session, loading } = useSession();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) {
      void router.invalidate();
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, session, navigate, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);

    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else if (mode === "register") {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name },
          },
        });
        if (err) throw err;
        if (!data.session) {
          setInfo("Conta criada! Confirme o e-mail que enviamos para poder entrar.");
        }
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (err) throw err;
        setInfo("Se o e-mail existir, enviamos um link para redefinir a senha.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível concluir.";
      setError(traduzir(message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <Link to="/" className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Marca Minha Vez
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-foreground">
          {mode === "login" ? "Entrar" : mode === "register" ? "Criar conta" : "Recuperar senha"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "recover"
            ? "Informe seu e-mail para receber o link de redefinição."
            : "Acesse o painel do seu estabelecimento."}
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <Field label="Seu nome">
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </Field>
          ) : null}

          <Field label="E-mail">
            <input
              type="email"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </Field>

          {mode !== "recover" ? (
            <Field label="Senha">
              <input
                type="password"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </Field>
          ) : null}

          {error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          ) : null}
          {info ? (
            <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-foreground">{info}</p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {busy
              ? "Aguarde…"
              : mode === "login"
                ? "Entrar"
                : mode === "register"
                  ? "Criar conta"
                  : "Enviar link"}
          </button>
        </form>

        <div className="mt-6 space-y-2 text-sm text-muted-foreground">
          {mode !== "login" ? (
            <button type="button" className="underline" onClick={() => setMode("login")}>
              Já tenho conta — entrar
            </button>
          ) : (
            <>
              <button type="button" className="block underline" onClick={() => setMode("register")}>
                Não tenho conta — criar agora
              </button>
              <button type="button" className="block underline" onClick={() => setMode("recover")}>
                Esqueci minha senha
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function traduzir(message: string) {
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(message)) return "Confirme seu e-mail antes de entrar.";
  if (/already registered|already exists/i.test(message)) return "Este e-mail já possui conta.";
  if (/password/i.test(message) && /6/.test(message)) return "A senha precisa ter ao menos 6 caracteres.";
  return message;
}
