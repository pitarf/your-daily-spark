import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { fetchMemberships, type Membership } from "@/lib/auth/auth-client";
import { canAccessDashboardPath } from "@/lib/auth/role-access";
import { EstablishmentProvider } from "@/lib/auth/establishment-context";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

const ACTIVE_KEY = "mmv:active-establishment";
const DEMO_SLUG = "barbearia-marca-minha-vez";

const NAV = [
  { to: "/dashboard", label: "Visão geral", exact: true },
  { to: "/dashboard/appointments", label: "Agenda", exact: false },
  { to: "/dashboard/services", label: "Serviços", exact: false },
  { to: "/dashboard/professionals", label: "Profissionais", exact: false },
  { to: "/dashboard/customers", label: "Clientes", exact: false },
  { to: "/dashboard/plans", label: "Planos", exact: false },
  { to: "/dashboard/team", label: "Equipe", exact: false },
  { to: "/dashboard/assistant", label: "Assistente IA", exact: false },
  { to: "/dashboard/profile", label: "Perfil", exact: false },
  { to: "/dashboard/settings", label: "Configurações", exact: false },
] as const;

function DashboardLayout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [activeId, setActiveId] = useState<string | null>(null);

  const membershipsQuery = useQuery({
    queryKey: ["memberships"],
    queryFn: fetchMemberships,
  });

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_KEY) : null;
    if (stored) setActiveId(stored);
  }, []);

  const memberships = membershipsQuery.data ?? [];
  const membership: Membership | undefined =
    memberships.find((m) => m.establishmentId === activeId) ?? memberships[0];

  useEffect(() => {
    if (!membership || membershipsQuery.isPending || membershipsQuery.isError) return;
    if (membership.role === "professional" && !canAccessDashboardPath(membership.role, pathname)) {
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [membership, membershipsQuery.isPending, membershipsQuery.isError, navigate, pathname]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const visibleNav = membership?.role === "professional" ? NAV.filter((item) => item.exact) : NAV;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="text-sm font-bold text-foreground">
            Marca Minha Vez
          </Link>
          <span className="text-xs text-muted-foreground">{membership?.name}</span>
          <div className="ml-auto flex items-center gap-3">
            {memberships.length > 1 ? (
              <select
                className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                value={membership?.establishmentId ?? ""}
                onChange={(e) => {
                  setActiveId(e.target.value);
                  window.localStorage.setItem(ACTIVE_KEY, e.target.value);
                }}
              >
                {memberships.map((m) => (
                  <option key={m.establishmentId} value={m.establishmentId}>{m.name}</option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              Sair
            </button>
          </div>
        </div>
        {membership ? (
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2 text-sm">
            {visibleNav.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {membershipsQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Carregando seu painel…</p>
        ) : membershipsQuery.isError ? (
          <p className="text-sm text-destructive">Não foi possível carregar seus estabelecimentos.</p>
        ) : !membership ? (
          <Onboarding onDone={() => membershipsQuery.refetch()} />
        ) : (
          <EstablishmentProvider
            value={{
              membership,
              memberships,
              setActive: (id) => {
                setActiveId(id);
                window.localStorage.setItem(ACTIVE_KEY, id);
              },
              refresh: () => void membershipsQuery.refetch(),
            }}
          >
            <Outlet />
          </EstablishmentProvider>
        )}
      </main>
    </div>
  );
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function Onboarding({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("barbearia");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createEstablishment(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setError("Sessão expirada. Entre novamente.");
      setBusy(false);
      return;
    }
    const { data, error: err } = await supabase
      .from("establishments")
      .insert({ name, slug: `${slugify(name)}-${Date.now().toString(36)}`, business_type: businessType })
      .select("id")
      .single();
    if (err || !data) {
      setError(err?.message ?? "Não foi possível criar o estabelecimento.");
      setBusy(false);
      return;
    }
    const { error: memberError } = await supabase
      .from("establishment_users")
      .insert({ establishment_id: data.id, user_id: userId, role: "admin" });
    setBusy(false);
    if (memberError) {
      setError(memberError.message);
      return;
    }
    onDone();
  }

  async function claimDemo() {
    setBusy(true);
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    const { data: demo } = await supabase
      .from("establishments")
      .select("id")
      .eq("slug", DEMO_SLUG)
      .maybeSingle();
    if (!demo || !userId) {
      setError("Estabelecimento de demonstração indisponível.");
      setBusy(false);
      return;
    }
    const { error: err } = await supabase
      .from("establishment_users")
      .insert({ establishment_id: demo.id, user_id: userId, role: "admin" });
    setBusy(false);
    if (err) {
      setError("A barbearia de demonstração já tem um administrador. Crie seu próprio estabelecimento.");
      return;
    }
    onDone();
  }

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-6">
      <h1 className="text-xl font-bold text-foreground">Vamos configurar seu estabelecimento</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sua conta ainda não está ligada a nenhum estabelecimento.</p>
      <form className="mt-6 space-y-3" onSubmit={createEstablishment}>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground">Nome do estabelecimento</span>
          <input required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground">Tipo de negócio</span>
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
            {["barbearia", "salão", "nail designer", "sobrancelhas", "estética", "clínica", "outro"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        <button type="submit" disabled={busy} className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
          {busy ? "Criando…" : "Criar estabelecimento"}
        </button>
      </form>
      <button type="button" onClick={claimDemo} disabled={busy} className="mt-4 w-full rounded-md border border-input px-4 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-60">
        Usar a Barbearia Marca Minha Vez (demonstração)
      </button>
    </div>
  );
}