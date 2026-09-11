import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/establishment/settings")({
  component: EstablishmentSettings,
});

function EstablishmentSettings() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Configurações do Estabelecimento</h1>
      <p className="mt-2 text-muted-foreground">
        Defina as informações e regras do seu estabelecimento aqui.
      </p>
      {/* Futuros formulários e componentes serão adicionados aqui */}
    </div>
  );
}
