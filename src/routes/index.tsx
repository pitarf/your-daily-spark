import { createFileRoute, Link } from "@tanstack/react-router";



import { useSession } from "@/lib/auth/auth-client";

export const Route = createFileRoute("/")({
  component: Index,
});

const features = [
  {
    title: "Agenda inteligente",
    description: "Horários, intervalos, folgas, bloqueios e duração do serviço entram no cálculo automaticamente.",
  },
  {
    title: "Para qualquer negócio",
    description: "Barbearias, salões, nails, estética, clínicas e serviços que trabalham com hora marcada.",
  },
  {
    title: "Agendamento simples",
    description: "O cliente escolhe serviço, profissional, dia e horário sem enxergar dados de outras pessoas.",
  },
];

function Index() {
  const { session, loading } = useSession();

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#f5f0e7,transparent_45%)] text-foreground">
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pb-24 sm:pt-10">
        <nav className="flex items-center justify-between gap-4">
          <Link to="/" className="text-sm font-bold tracking-tight sm:text-base">
            Marca Minha Vez
          </Link>
          <div className="flex items-center gap-2">
            {!loading && session ? (
              <Link
                to="/dashboard"
                className="rounded-full border border-input bg-background px-4 py-2 text-xs font-semibold transition-colors hover:bg-accent sm:text-sm"
              >
                Ir para o painel
              </Link>
            ) : (
              <Link
                to="/auth"
                className="rounded-full border border-input bg-background px-4 py-2 text-xs font-semibold transition-colors hover:bg-accent sm:text-sm"
              >
                Entrar
              </Link>
            )}
          </div>
        </nav>

        <div className="mx-auto mt-20 max-w-4xl text-center sm:mt-28">
          <span className="inline-flex rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            Agendamento online para negócios de serviços
          </span>
          <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">
            Sua agenda organizada.
            <span className="block text-primary">Sua vez, no horário certo.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            O Marca Minha Vez transforma a disponibilidade do seu negócio em uma experiência de agendamento simples para você e para seus clientes.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/schedule"
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"
            >
              Ver agenda de demonstração
            </Link>
            {!loading && !session ? (
              <Link
                to="/auth"
                className="rounded-full border border-input bg-background px-6 py-3 text-sm font-semibold transition-colors hover:bg-accent"
              >
                Criar meu estabelecimento
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-3 sm:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-2xl border border-border bg-background/80 p-5 shadow-sm backdrop-blur">
              <h2 className="text-sm font-bold sm:text-base">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
            </article>
          ))}
        </div>

        <section className="mx-auto mt-5 max-w-5xl rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Como funciona</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Você configura a agenda. O sistema calcula o resto.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                Defina seu expediente, intervalos, profissionais e serviços. O cliente vê somente o que realmente pode ser reservado.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[
                ["01", "Configure"],
                ["02", "Compartilhe"],
                ["03", "Receba reservas"],
              ].map(([step, label]) => (
                <div key={step} className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
                  <span className="text-xs font-bold text-primary">{step}</span>
                  <span className="text-sm font-semibold">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
