import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

/** Sessão persistente do usuário (client-side). */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export type EstablishmentRole = "admin" | "professional" | "staff";

export type Membership = {
  establishmentId: string;
  role: EstablishmentRole;
  name: string;
  slug: string;
  timezone: string;
};

/** Estabelecimentos aos quais o usuário autenticado pertence (RLS aplica). */
export async function fetchMemberships(): Promise<Membership[]> {
  const { data, error } = await supabase
    .from("establishment_users")
    .select("establishment_id, role, establishments(name, slug, timezone)")
    .order("created_at");
  if (error) throw error;

  return (data ?? []).map((row) => {
    const establishment = row.establishments as unknown as {
      name: string;
      slug: string;
      timezone: string;
    } | null;
    return {
      establishmentId: row.establishment_id,
      role: row.role as EstablishmentRole,
      name: establishment?.name ?? "Estabelecimento",
      slug: establishment?.slug ?? "",
      timezone: establishment?.timezone ?? "America/Sao_Paulo",
    };
  });
}
