import { createFileRoute, Link } from "@tanstack/react-router";
import { GStack } from "gstack";

import { useSession } from "@/lib/auth/auth-client";

export const Route = createFileRoute("/")({
  component: Index,
});

const features = [
  {
    title: "Agenda inteligente",
    description:
      "Horários, intervalos, folgas, bloqueios e duração do serviço entram no cálculo automaticamente.",
  },
  {
    title: "Para qualquer negócio",
    description:
      "Barbearias, salões, nails, estética, clínicas e outros serviços que trabalham com hora marcada.",
  },
  {
    title: "Agendamento simples",
    description:
      "Seu cliente escolhe o serviço, profissional, dia e horário sem enxergar dados de outras pessoas.",
  },
];

const businessTypes = [
  "Barbearia",
  "Salão de beleza",
  "Nails",
  "Sobrancelhas",
  "Estética",
  "Clínica",
  "Consultório",
  "Tatuagem",
];

function Index() {
  const { session, loading } = useSession();

  return (
    <main className="min-h-screen overflow-hidden bg-gradient-to-br from-background/90 to-background/70 text-foreground backdrop-blur-sm">
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pb-24 sm:pt-10 shadow-xl rounded-3xl bg-background/90 backdrop-blur-xl">
        <nav className="flex items-center justify-between gap-4" aria-label="Navegação principal">
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
          <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/80">
            Sua agenda organizada.
            <span className="block text-primary">Seu cliente marca a vez.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            O Marca Minha Vez transforma a disponibilidade do seu negócio em uma experiência de agendamento simples, profissional e segura para você e para seus clientes.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/schedule"
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl"
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
            <article
              key={feature.title}
              className="rounded-2xl border border-border bg-background/80 p-5 shadow-sm backdrop-blur"
            >
              <h2 className="text-sm font-bold sm:text-base">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
            </article>
          ))}
        </div>

        <section className="mx-auto mt-5 max-w-5xl rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Um sistema que se adapta
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                O seu negócio muda. A agenda acompanha.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                Escolha o tipo de negócio, personalize a identidade e configure sua rotina. O cliente encontra apenas os serviços, profissionais e horários que realmente podem ser reservados.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {businessTypes.map((business) => (
                  <span
                    key={business}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground"
                  >
                    {business}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[
                ["01", "Configure", "Expediente, serviços e profissionais"],
                ["02", "Compartilhe", "Uma página pública para sua agenda"],
                ["03", "Receba reservas", "Seu cliente marca sem precisar ligar"],
              ].map(([step, label, detail]) => (
                <div key={step} className="rounded-xl bg-muted/50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-primary">{step}</span>
                    <span className="text-sm font-semibold">{label}</span>
                  </div>
                  <p className="mt-1 pl-7 text-xs leading-5 text-muted-foreground">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto mt-5 max-w-5xl rounded-3xl border border-border bg-background/70 p-5 shadow-sm sm:p-8">
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Agenda</p>
              <h2 className="mt-2 text-lg font-bold">Disponibilidade real</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                O sistema respeita duração, intervalos, bloqueios, folgas e conflitos antes de mostrar uma vaga.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Cliente</p>
              <h2 className="mt-2 text-lg font-bold">Mais autonomia</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Agende, consulte, cancele e reagende com segurança, direto pela página pública.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">IA</p>
              <h2 className="mt-2 text-lg font-bold">Assistência inteligente</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Pergunte sobre sua operação em linguagem natural. A agenda continua sendo a fonte de verdade.
              </p>
            </div>
          </div>
        </section>

        <footer className="mx-auto mt-10 max-w-5xl text-center text-xs text-muted-foreground">
          Marca Minha Vez · Agendamento online para negócios de atendimento
        </footer>
      </section>
    </main>
  );
}
