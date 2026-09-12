import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getAppointmentManagementUrl } from "@/lib/scheduling/appointment-management.functions";

export function AppointmentManagementLink({
  appointmentId,
  slug,
  customerPhone,
}: {
  appointmentId: string;
  slug: string;
  customerPhone: string;
}) {
  const createManagementUrl = useServerFn(getAppointmentManagementUrl);

  const query = useQuery({
    queryKey: ["appointment-management-link", appointmentId, slug, customerPhone],
    queryFn: () => createManagementUrl({ data: { appointmentId, slug, customerPhone } }),
    staleTime: Infinity,
    retry: false,
  });

  if (query.isError) return null;

  return (
    <a
      href={query.data?.path}
      aria-disabled={!query.data}
      className="rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-accent aria-disabled:pointer-events-none aria-disabled:opacity-60"
    >
      {query.isPending ? "Preparando link..." : "Gerenciar meu agendamento"}
    </a>
  );
}
