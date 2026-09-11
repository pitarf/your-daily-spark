import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useEstablishment } from "@/lib/auth/establishment-context";

export const Route = createFileRoute("/_authenticated/dashboard/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const { membership } = useEstablishment();

  const query = useQuery({
    queryKey: ["admin-customers", membership.establishmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, email, created_at")
        .eq("establishment_id", membership.establishmentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const customers = query.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Clientes criados pelos agendamentos do seu estabelecimento.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {query.isPending ? (
          <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
        ) : customers.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhum cliente ainda.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Telefone</th>
                <th className="px-3 py-2">E-mail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-medium text-foreground">{c.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.phone ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
