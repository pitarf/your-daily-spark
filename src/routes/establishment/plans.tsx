import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/establishment/plans")({
  component: ClientPlans,
});

function ClientPlans() {
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Planos de Cliente</h2>
      <p className="text-muted-foreground">
        Aqui você pode gerenciar os planos de clientes do seu estabelecimento.
      </p>
    </div>
  );
}
