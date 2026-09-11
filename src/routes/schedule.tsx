import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/schedule")({
  component: SchedulePage,
});

function SchedulePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <p className="text-lg text-gray-700">Página de Agendamento Padrão</p>
    </div>
  );
}
