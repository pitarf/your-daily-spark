import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/establishment/plans")({
  component: LegacyPlans,
});

function LegacyPlans() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Marca Minha Vez</p>
        <h1 className="mt-2 text-xl font-bold text-foreground">A gestão de planos agora fica no painel</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Entre na sua conta para administrar planos, duração máxima e serviços permitidos aos clientes.
        </p>
        <Link
          to="/dashboard/plans"
          className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Abrir gestão de planos
        </Link>
      </section>
    </main>
  );
}
