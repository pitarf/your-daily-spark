import { createFileRoute, Link } from "@tanstack/react-router";

import { useSession } from "@/lib/auth/auth-client";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { session, loading } = useSession();

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 px-4"
      style={{ backgroundColor: "#fcfbf8" }}
    >
      <h1 className="text-3xl font-bold text-foreground">Marca Minha Vez</h1>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Organize sua agenda e permita que clientes agendem horários com você.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          to="/schedule"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          Agendar horário
        </Link>
        {loading ? null : session ? (
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium text-foreground"
          >
            Ir para o painel
          </Link>
        ) : (
          <Link
            to="/auth"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium text-foreground"
          >
            Sou do estabelecimento
          </Link>
        )}
      </div>
    </div>
  );
}
