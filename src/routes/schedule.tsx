import { createFileRoute } from "@tanstack/react-router";
import { addDays, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo, useState } from "react";
import { CalendarDays, Check, Clock3, Scissors, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAvailableSlots } from "@/lib/scheduling/availability";

export const Route = createFileRoute("/schedule")({
  component: SchedulePage,
});

type Service = {
  id: string;
  name: string;
  duration: number;
  price: number;
};

type Professional = {
  id: string;
  name: string;
};

const services: Service[] = [
  { id: "corte", name: "Corte", duration: 30, price: 35 },
  { id: "barba", name: "Barba", duration: 30, price: 25 },
  { id: "combo", name: "Corte + Barba", duration: 60, price: 55 },
  { id: "platinado", name: "Platinado", duration: 120, price: 120 },
];

const professionals: Professional[] = [
  { id: "joao", name: "João" },
  { id: "carlos", name: "Carlos" },
];

function getDemoBookings(selectedDate: Date) {
  if (selectedDate.getDay() === 0) return [];

  return [
    { id: "booking-1", start: "10:00", end: "10:30", professionalId: "joao" },
    { id: "booking-2", start: "14:00", end: "15:00", professionalId: "carlos" },
  ];
}

function SchedulePage() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedServiceId, setSelectedServiceId] = useState("corte");
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("joao");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const selectedService = services.find((service) => service.id === selectedServiceId) ?? services[0];
  const dates = Array.from({ length: 7 }, (_, index) => addDays(today, index));

  const availableSlots = useMemo(
    () =>
      getAvailableSlots({
        date: selectedDate,
        businessHours: { start: "09:00", end: "18:00" },
        breaks: [{ start: "12:00", end: "13:00" }],
        bookings: getDemoBookings(selectedDate),
        serviceDurationMinutes: selectedService.duration,
        slotIntervalMinutes: 30,
        professionalId: selectedProfessionalId,
      }),
    [selectedDate, selectedProfessionalId, selectedService.duration],
  );

  return (
    <main className="min-h-screen bg-[#f7f7f5] px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Scissors className="size-3.5" />
            Marca Minha Vez
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Agende seu horário</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Escolha o serviço, o profissional, a data e um horário disponível. O sistema calcula os encaixes respeitando duração, intervalo e horários já reservados.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border bg-background p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-2 text-sm font-semibold">
              <Scissors className="size-4 text-primary" />
              1. Escolha o serviço
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map((service) => {
                const selected = service.id === selectedServiceId;
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => {
                      setSelectedServiceId(service.id);
                      setSelectedSlot(null);
                    }}
                    className={`rounded-xl border p-4 text-left transition ${selected ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "hover:border-primary/40 hover:bg-muted/30"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{service.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{service.duration} minutos</p>
                      </div>
                      <p className="font-semibold">R$ {service.price.toFixed(2).replace(".", ",")}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-7 mb-4 flex items-center gap-2 text-sm font-semibold">
              <UserRound className="size-4 text-primary" />
              2. Escolha o profissional
            </div>
            <div className="flex flex-wrap gap-2">
              {professionals.map((professional) => (
                <Button
                  key={professional.id}
                  type="button"
                  variant={professional.id === selectedProfessionalId ? "default" : "outline"}
                  onClick={() => {
                    setSelectedProfessionalId(professional.id);
                    setSelectedSlot(null);
                  }}
                >
                  {professional.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-background p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="size-4 text-primary" />
              3. Escolha a data
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {dates.map((date) => {
                const selected = date.getTime() === selectedDate.getTime();
                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => {
                      setSelectedDate(date);
                      setSelectedSlot(null);
                    }}
                    className={`rounded-xl border px-3 py-3 text-left transition ${selected ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/40"}`}
                  >
                    <p className="text-xs capitalize opacity-80">{format(date, "EEEE", { locale: ptBR })}</p>
                    <p className="mt-1 font-semibold">{format(date, "dd/MM")}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-7 mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Clock3 className="size-4 text-primary" />
                4. Horários disponíveis
              </div>
              <span className="text-xs text-muted-foreground">{selectedService.duration} min</span>
            </div>

            {availableSlots.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum horário disponível para essa combinação. Tente outro profissional, serviço ou data.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {availableSlots.map((slot) => {
                  const selected = selectedSlot === slot.start;
                  return (
                    <button
                      key={`${slot.start}-${slot.end}`}
                      type="button"
                      onClick={() => setSelectedSlot(slot.start)}
                      className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${selected ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50 hover:bg-muted/30"}`}
                    >
                      {slot.start}
                      <span className="ml-1 text-xs font-normal opacity-70">até {slot.end}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-background p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Resumo do agendamento</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
                <span>{selectedService.name}</span>
                <span className="text-muted-foreground">•</span>
                <span>{professionals.find((item) => item.id === selectedProfessionalId)?.name}</span>
                <span className="text-muted-foreground">•</span>
                <span>{format(selectedDate, "dd/MM/yyyy")}</span>
                {selectedSlot && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span>{selectedSlot}</span>
                  </>
                )}
              </div>
            </div>
            <Button size="lg" disabled={!selectedSlot}>
              <Check className="size-4" />
              Confirmar horário
            </Button>
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Demonstração do motor de disponibilidade. Ainda não há persistência, autenticação ou criação real de agendamentos.
        </p>
      </div>
    </main>
  );
}
