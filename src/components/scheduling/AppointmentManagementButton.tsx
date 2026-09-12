import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { getAppointmentManagementUrl } from "@/lib/scheduling/appointment-management.functions";

type Props = {
  slug: string;
  appointmentId: string;
  customerPhone: string;
};

export function AppointmentManagementButton({ slug, appointmentId, customerPhone }: Props) {
  const createManagementUrl = useServerFn(getAppointmentManagementUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const result = await createManagementUrl({
        data: {
          slug,
          appointmentId,
          customerPhone,
        },
      });
      window.location.assign(result.path);
    } catch {
      setError("Não foi possível abrir o gerenciamento agora. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none">
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Abrindo…" : "Gerenciar agendamento"}
      </button>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
