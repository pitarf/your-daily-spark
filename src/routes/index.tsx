import { createFileRoute } from "@tanstack/react-router";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  component: Index,
});

// Página inicial do Marca Minha Vez — ponto de partida do MVP.
// Futuramente será expandida com listagem de serviços, calendário e
// integração completa de agendamentos.
function Index() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6"
      style={{ backgroundColor: "#fcfbf8" }}
    >
      <h1 className="text-3xl font-bold text-foreground">
        Marca Minha Vez
      </h1>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Organize sua agenda e permita que clientes agendem horários com você.
      </p>
      <a
        href="/schedule"
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
      >
        Agendar horário
      </a>
    </div>
  );
}
