import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { getAppointmentManagementUrl } from "@/lib/scheduling/appointment-management.functions";

type Props = {
  slug: string;
  appointmentId: string;
  customerPhone: string;
};

function whatsappPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

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

  async function handleWhatsApp() {
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
      const text = encodeURIComponent(
        `Olá! Quero acessar meu agendamento no Marca Minha Vez.\n\n${window.location.origin}${result.path}`,
      );
      window.location.assign(`https://wa.me/${whatsappPhone(customerPhone)}?text=${text}`);
    } catch {
      setError("Não foi possível preparar o WhatsApp agora. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-none">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleOpen}
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Abrindo…" : "Gerenciar agendamento"}
        </button>
        <button
          type="button"
          onClick={handleWhatsApp}
          disabled={loading}
          className="rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          Enviar pelo WhatsApp
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        O WhatsApp abre com a mensagem pronta e o envio continua sob sua confirmação.
      </p>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
