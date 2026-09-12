import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useEstablishment } from "@/lib/auth/establishment-context";

export const Route = createFileRoute("/_authenticated/dashboard/booking-rules")({
  component: BookingRulesPage,
});

function BookingRulesPage() {
  const { membership } = useEstablishment();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["booking-rules", membership.establishmentId],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("establishments")
        .select("allow_custom_duration")
        .eq("id", membership.establishmentId)
        .maybeSingle();
      if (queryError) throw queryError;
      return Boolean(data?.allow_custom_duration);
    },
  });

  const mutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (membership.role !== "admin") throw new Error("Somente administradores podem alterar estas regras.");
      const { error: updateError } = await supabase
        .from("establishments")
        .update({ allow_custom_duration: enabled })
        .eq("id", membership.establishmentId);
      if (updateError) throw updateError;
      return enabled;
    },
    onSuccess: async (enabled) => {
      setError(null);
      queryClient.setQueryData(["booking-rules", membership.establishmentId], enabled);
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const enabled = query.data ?? false;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Configurações</p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">Regras de agendamento</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          Controle recursos que mudam a forma como seus clientes enxergam e reservam horários.
        </p>
      </header>

      {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-base font-semibold text-foreground">Permitir duração personalizada</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Quando ativado, o cliente poderá escolher a duração do atendimento em intervalos de 15 minutos. O sistema só oferece horários em que o período inteiro cabe no expediente e na agenda do profissional.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              A regra de plano do cliente continua sendo validada no servidor no momento da reserva.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={query.isPending || mutation.isPending || membership.role !== "admin"}
            onClick={() => mutation.mutate(!enabled)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border transition-colors disabled:opacity-50 ${enabled ? "bg-primary" : "bg-muted"}`}
          >
            <span className={`h-5 w-5 rounded-full bg-background shadow-sm transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
        <div className="mt-4 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          Estado atual: <strong className="text-foreground">{query.isPending ? "carregando" : enabled ? "ativado" : "desativado"}</strong>
        </div>
      </section>
    </div>
  );
}
