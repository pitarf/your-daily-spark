import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useEstablishment } from "@/lib/auth/establishment-context";
import { addCalendarDays, addCalendarMonths, dateKeyInTimezone, monthGridDates, periodDates, periodRangeUtc, startOfWeekMonday, type CalendarView } from "@/lib/scheduling/calendar";
import { getAvailability, createAppointment } from "@/lib/scheduling/scheduling.functions";
import { zonedWallTimeToUtc } from "@/lib/scheduling/availability";
import { formatDate, formatDateTime, formatPrice, formatTime, todayInTimezone } from "@/lib/scheduling/format";

export const Route = createFileRoute("/_authenticated/dashboard/appointments")({
  component: AppointmentsPage,
});

type Row = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  custom_title: string | null;
  custom_price: number | null;
  duration_minutes_override: number | null;
  customers: { name: string; phone: string | null } | null;
  services: { name: string; price: number } | null;
  professionals: { name: string } | null;
};

type Block = {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  professional_id: string | null;
  professionals: { name: string } | null;
};

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  professionalIds: string[];
};

const STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"] as const;
const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};
const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function AppointmentsPage() {
  const { membership } = useEstablishment();
  const tz = membership.timezone;
  const queryClient = useQueryClient();
  const create = useServerFn(createAppointment);
  const availability = useServerFn(getAvailability);
  const [date, setDate] = useState(todayInTimezone(tz));
  const [view, setView] = useState<CalendarView>("day");
  const [blockStart, setBlockStart] = useState("12:00");
  const [blockEnd, setBlockEnd] = useState("13:00");
  const [blockProfessionalId, setBlockProfessionalId] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blockError, setBlockError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState("all");
  const [appointmentProfessionalFilter, setAppointmentProfessionalFilter] = useState("all");

  const period = periodRangeUtc(view, date, tz);
  const dates = periodDates(view, date, tz);

  const appointmentsQuery = useQuery({
    queryKey: ["admin-appointments", membership.establishmentId, view, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, starts_at, ends_at, status, notes, custom_title, custom_price, duration_minutes_override, customers(name, phone), services(name, price), professionals(name)")
        .eq("establishment_id", membership.establishmentId)
        .gte("starts_at", period.start)
        .lt("starts_at", period.end)
        .order("starts_at");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const professionalsQuery = useQuery({
    queryKey: ["admin-block-professionals", membership.establishmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("establishment_id", membership.establishmentId)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const servicesQuery = useQuery({
    queryKey: ["admin-manual-booking-services", membership.establishmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, duration_minutes, price, professional_services(professional_id)")
        .eq("establishment_id", membership.establishmentId)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((service) => ({
        id: service.id,
        name: service.name,
        duration_minutes: service.duration_minutes,
        price: Number(service.price),
        professionalIds: ((service.professional_services ?? []) as { professional_id: string }[]).map((item) => item.professional_id),
      })) as Service[];
    },
  });

  const blocksQuery = useQuery({
    queryKey: ["admin-blocked-slots", membership.establishmentId, view, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_slots")
        .select("id, starts_at, ends_at, reason, professional_id, professionals(name)")
        .eq("establishment_id", membership.establishmentId)
        .gte("starts_at", period.start)
        .lt("starts_at", period.end)
        .order("starts_at");
      if (error) throw error;
      return (data ?? []) as unknown as Block[];
    },
  });

  const blockMutation = useMutation({
    mutationFn: async () => {
      const startMinutes = Number(blockStart.slice(0, 2)) * 60 + Number(blockStart.slice(3, 5));
      const endMinutes = Number(blockEnd.slice(0, 2)) * 60 + Number(blockEnd.slice(3, 5));
      if (endMinutes <= startMinutes) throw new Error("O fim do bloqueio deve ser depois do início.");

      const startsAt = zonedWallTimeToUtc(date, startMinutes, tz);
      const endsAt = zonedWallTimeToUtc(date, endMinutes, tz);
      if (startsAt.getTime() <= Date.now()) throw new Error("Não é possível criar bloqueio no passado.");

      const { error } = await supabase.from("blocked_slots").insert({
        establishment_id: membership.establishmentId,
        professional_id: blockProfessionalId || null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        reason: blockReason.trim() || null,
      });
      if (error) {
        if (error.code === "23P01" || error.code === "P0001") {
          throw new Error("Esse bloqueio entra em conflito com um agendamento existente.");
        }
        throw error;
      }
    },
    onSuccess: async () => {
      setBlockError(null);
      setBlockReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin-blocked-slots"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
    },
    onError: (error: Error) => setBlockError(error.message),
  });

  const deleteBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("blocked_slots")
        .delete()
        .eq("id", id)
        .eq("establishment_id", membership.establishmentId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-blocked-slots"] }),
    onError: (error: Error) => setBlockError(error.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status: status as (typeof STATUSES)[number] })
        .eq("id", id)
        .eq("establishment_id", membership.establishmentId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-appointments"] }),
    onError: (error: Error) => setBlockError(error.message),
  });

  const professionals = professionalsQuery.data ?? [];
  const rows = appointmentsQuery.data ?? [];
  const blocks = blocksQuery.data ?? [];

  const filteredRows = useMemo(() => {
    const query = appointmentSearch.trim().toLocaleLowerCase("pt-BR");
    return rows.filter((row) => {
      const matchesSearch =
        query.length === 0 ||
        [
          row.customers?.name,
          row.customers?.phone,
          row.services?.name,
          row.custom_title,
          row.professionals?.name,
        ]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase("pt-BR").includes(query));
      const matchesStatus = appointmentStatusFilter === "all" || row.status === appointmentStatusFilter;
      const matchesProfessional =
        appointmentProfessionalFilter === "all" ||
        (row.professionals?.name && professionals.find((professional) => professional.id === appointmentProfessionalFilter)?.name === row.professionals.name);
      return matchesSearch && matchesStatus && matchesProfessional;
    });
  }, [appointmentProfessionalFilter, appointmentSearch, appointmentStatusFilter, professionals, rows]);

  const occupiedCount = useMemo(() => filteredRows.filter((row) => row.status !== "cancelled").length, [filteredRows]);

  function movePeriod(delta: number) {
    setDate(view === "day" ? addCalendarDays(date, delta) : view === "week" ? addCalendarDays(date, delta * 7) : addCalendarMonths(date, delta));
  }

  function goToday() {
    setDate(todayInTimezone(tz));
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of filteredRows) {
      const key = dateKeyInTimezone(row.starts_at, tz);
      const current = map.get(key) ?? [];
      current.push(row);
      map.set(key, current);
    }
    return map;
  }, [filteredRows, tz]);

  const title = getPeriodTitle(view, date, tz);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Gestão de agenda</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-sm text-muted-foreground">{occupiedCount} atendimento(s) ocupando o período{filteredRows.length !== rows.length ? ` · ${filteredRows.length} exibido(s)` : ""}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => movePeriod(-1)} className={navButton}>Anterior</button>
          <button type="button" onClick={goToday} className={navButton}>Hoje</button>
          <button type="button" onClick={() => movePeriod(1)} className={navButton}>Próximo</button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            aria-label="Escolher data"
          />
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold capitalize text-foreground">{title}</h2>
        <div className="flex rounded-lg border border-border bg-card p-1" role="tablist" aria-label="Visualização da agenda">
          {(["day", "week", "month"] as CalendarView[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              role="tab"
              aria-selected={view === option}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${view === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
            >
              {option === "day" ? "Dia" : option === "week" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
      </div>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_190px_220px_auto]">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">Buscar atendimento</span>
          <input
            type="search"
            value={appointmentSearch}
            onChange={(event) => setAppointmentSearch(event.target.value)}
            placeholder="Cliente, telefone, serviço ou profissional"
            className="w-full rounded-md border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">Status</span>
          <select
            value={appointmentStatusFilter}
            onChange={(event) => setAppointmentStatusFilter(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2"
          >
            <option value="all">Todos</option>
            {STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">Profissional</span>
          <select
            value={appointmentProfessionalFilter}
            onChange={(event) => setAppointmentProfessionalFilter(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2"
          >
            <option value="all">Todos</option>
            {professionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setAppointmentSearch("");
              setAppointmentStatusFilter("all");
              setAppointmentProfessionalFilter("all");
            }}
            className="w-full rounded-md border border-input px-4 py-2 text-sm sm:w-auto"
          >
            Limpar filtros
          </button>
        </div>
      </section>

      {filteredRows.length === 0 ? (
        <section className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="font-medium text-foreground">Nenhum atendimento encontrado.</p>
          <p className="mt-1 text-sm text-muted-foreground">Ajuste os filtros ou escolha outro período.</p>
        </section>
      ) : view === "day" ? (
        <DayView rows={filteredRows} tz={tz} updateStatus={updateStatus.mutate} />
      ) : view === "week" ? (
        <WeekView dates={dates} grouped={grouped} tz={tz} />
      ) : (
        <MonthView date={date} grouped={grouped} tz={tz} onSelectDate={(next) => { setDate(next); setView("day"); }} />
      )}

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Agendamento manual</h2>
            <p className="mt-1 text-xs text-muted-foreground">Crie um atendimento para um cliente diretamente pelo painel, usando a mesma validação de disponibilidade do fluxo público.</p>
          </div>
          <button type="button" onClick={() => setManualOpen((open) => !open)} className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
            {manualOpen ? "Fechar" : "Novo agendamento"}
          </button>
        </div>
        {manualOpen ? (
          <ManualBookingForm
            date={date}
            tz={tz}
            slug={membership.slug}
            services={servicesQuery.data ?? []}
            professionals={professionals}
            availability={availability}
            create={create}
            onCreated={async () => {
              setManualOpen(false);
              await queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
            }}
          />
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Bloquear horário</h2>
          <p className="mt-1 text-xs text-muted-foreground">Bloqueie um período para todos os profissionais ou somente para um profissional.</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm"><span className="text-muted-foreground">Início</span><input type="time" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span className="text-muted-foreground">Fim</span><input type="time" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span className="text-muted-foreground">Profissional</span><select value={blockProfessionalId} onChange={(e) => setBlockProfessionalId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2"><option value="">Todos</option>{professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="space-y-1 text-sm"><span className="text-muted-foreground">Motivo</span><input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Almoço, manutenção..." className="w-full rounded-md border border-input bg-background px-3 py-2" /></label>
        </div>
        {blockError ? <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{blockError}</p> : null}
        <div className="mt-3 flex justify-end"><button type="button" disabled={blockMutation.isPending} onClick={() => blockMutation.mutate()} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">{blockMutation.isPending ? "Bloqueando…" : "Bloquear horário"}</button></div>
        {blocks.length > 0 ? <div className="mt-4 rounded-lg border border-border"><div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Bloqueios do período</div><ul className="divide-y divide-border">{blocks.map((block) => <li key={block.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm"><span className="font-medium text-foreground">{formatDateTime(block.starts_at, tz)}–{formatTime(block.ends_at, tz)}</span><span className="text-muted-foreground">{block.professionals?.name ?? "Todos"}</span>{block.reason ? <span className="text-muted-foreground">{block.reason}</span> : null}<button type="button" onClick={() => deleteBlock.mutate(block.id)} disabled={deleteBlock.isPending} className="ml-auto text-xs underline disabled:opacity-60">Remover</button></li>)}</ul></div> : null}
      </section>
    </div>
  );
}

const navButton = "rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent";

function getPeriodTitle(view: CalendarView, date: string, tz: string) {
  if (view === "day") return formatDate(`${date}T12:00:00Z`, tz);
  if (view === "month") return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: tz }).format(new Date(`${date.slice(0, 7)}-15T12:00:00Z`));
  const start = startOfWeekMonday(date);
  const end = addCalendarDays(start, 6);
  return `${formatDate(`${start}T12:00:00Z`, tz)} a ${formatDate(`${end}T12:00:00Z`, tz)}`;
}

function DayView({ rows, tz, updateStatus }: { rows: Row[]; tz: string; updateStatus: (input: { id: string; status: string }) => void }) {
  return <div className="overflow-x-auto rounded-xl border border-border bg-card"><div className="min-w-[780px]"><div className="grid grid-cols-[110px_1fr_200px_160px_170px] border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium uppercase text-muted-foreground"><span>Horário</span><span>Cliente</span><span>Serviço</span><span>Profissional</span><span>Status</span></div>{rows.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Nenhum agendamento nesta data.</p> : rows.map((row) => <div key={row.id} className="grid grid-cols-[110px_1fr_200px_160px_170px] items-center border-b border-border px-3 py-3 text-sm last:border-0"><div className="font-medium text-foreground">{formatTime(row.starts_at, tz)}–{formatTime(row.ends_at, tz)}</div><div><span className="font-medium text-foreground">{row.customers?.name ?? "Cliente"}</span>{row.customers?.phone ? <span className="block text-xs text-muted-foreground">{row.customers.phone}</span> : null}</div><div className="text-muted-foreground"><span className="font-medium text-foreground">{getAppointmentLabel(row)}</span><span className="block text-xs">{getAppointmentPriceLabel(row)}</span>{row.duration_minutes_override ? <span className="block text-[11px] text-muted-foreground">{row.duration_minutes_override} min</span> : null}</div><div className="text-muted-foreground">{row.professionals?.name ?? "—"}</div><div><select value={row.status} onChange={(e) => updateStatus({ id: row.id, status: e.target.value })} className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs">{STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}</select></div></div>)}</div></div>;
}

function WeekView({ dates, grouped, tz }: { dates: string[]; grouped: Map<string, Row[]>; tz: string }) {
  return <div className="grid gap-2 md:grid-cols-7">{dates.map((day, index) => { const items = grouped.get(day) ?? []; return <section key={day} className="min-h-[220px] rounded-xl border border-border bg-card p-3"><div className="border-b border-border pb-2"><p className="text-xs font-semibold uppercase text-muted-foreground">{WEEKDAY_LABELS[index]}</p><p className="text-lg font-bold text-foreground">{day.slice(8, 10)}</p></div><div className="mt-2 space-y-2">{items.length === 0 ? <p className="text-xs text-muted-foreground">Livre</p> : items.map((row) => <CompactAppointment key={row.id} row={row} tz={tz} />)}</div></section>; })}</div>;
}

function MonthView({ date, grouped, tz, onSelectDate }: { date: string; grouped: Map<string, Row[]>; tz: string; onSelectDate: (date: string) => void }) {
  const cells = monthGridDates(date);
  const currentMonth = date.slice(0, 7);
  return <div className="overflow-hidden rounded-xl border border-border bg-card"><div className="grid grid-cols-7 border-b border-border bg-muted/40">{WEEKDAY_LABELS.map((label) => <div key={label} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">{label}</div>)}</div><div className="grid grid-cols-7">{cells.map((day) => { const items = grouped.get(day) ?? []; const muted = !day.startsWith(currentMonth); return <button key={day} type="button" onClick={() => onSelectDate(day)} className={`min-h-[100px] border-b border-r border-border p-2 text-left align-top hover:bg-accent/50 ${muted ? "bg-muted/20 text-muted-foreground" : "bg-card"}`}><div className="flex items-center justify-between"><span className={`text-xs font-semibold ${muted ? "text-muted-foreground" : "text-foreground"}`}>{day.slice(8, 10)}</span>{items.length > 0 ? <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground">{items.length}</span> : null}</div><div className="mt-2 space-y-1">{items.slice(0, 3).map((row) => <div key={row.id} className="truncate rounded bg-muted px-1.5 py-1 text-[10px] text-foreground">{formatTime(row.starts_at, tz)} · {row.customers?.name ?? "Cliente"} · {getAppointmentLabel(row)}</div>)}{items.length > 3 ? <p className="text-[10px] text-muted-foreground">+{items.length - 3} mais</p> : null}</div></button>; })}</div></div>;
}

function CompactAppointment({ row, tz }: { row: Row; tz: string }) {
  return <article className="rounded-lg bg-muted/50 p-2"><div className="text-xs font-semibold text-foreground">{formatTime(row.starts_at, tz)}–{formatTime(row.ends_at, tz)}</div><div className="mt-0.5 truncate text-xs text-foreground">{row.customers?.name ?? "Cliente"}</div><div className="truncate text-[11px] text-muted-foreground">{getAppointmentLabel(row)}</div></article>;
}

function getAppointmentLabel(row: Row) {
  return row.custom_title?.trim() || row.services?.name || "Atendimento avulso";
}

function getAppointmentPriceLabel(row: Row) {
  if (row.custom_price !== null) return formatPrice(Number(row.custom_price));
  if (row.services) return formatPrice(Number(row.services.price));
  return "Sem preço definido";
}

type ManualProps = {
  date: string;
  tz: string;
  slug: string;
  services: Service[];
  professionals: { id: string; name: string }[];
  availability: ReturnType<typeof useServerFn<typeof getAvailability>>;
  create: ReturnType<typeof useServerFn<typeof createAppointment>>;
  onCreated: () => Promise<void>;
};

function ManualBookingForm({ date: initialDate, tz, slug, services, professionals, availability, create, onCreated }: ManualProps) {
  const [date, setDate] = useState(initialDate);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [professionalId, setProfessionalId] = useState("");
  const [slot, setSlot] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const service = services.find((item) => item.id === serviceId);
  const serviceProfessionals = professionals.filter((p) => !service || service.professionalIds.includes(p.id));
  const slotsQuery = useQuery({
    queryKey: ["manual-availability", slug, date, serviceId, professionalId],
    enabled: Boolean(serviceId),
    queryFn: () => availability({ data: { slug, date, serviceId, professionalId: professionalId || null } }),
  });
  const mutation = useMutation({
    mutationFn: async () => {
      if (!slot) throw new Error("Escolha um horário.");
      return create({ data: { slug, date, serviceId, professionalId: professionalId || null, startsAt: slot, customerName: name, customerPhone: phone, ...(email ? { customerEmail: email } : {}) } });
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        setError(result.error);
        setSlot("");
        await slotsQuery.refetch();
        return;
      }
      await onCreated();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Não foi possível criar o agendamento."),
  });

  return <form className="mt-4 space-y-4 border-t border-border pt-4" onSubmit={(e) => { e.preventDefault(); setError(null); mutation.mutate(); }}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="space-y-1 text-sm"><span className="text-muted-foreground">Serviço</span><select required value={serviceId} onChange={(e) => { setServiceId(e.target.value); setProfessionalId(""); setSlot(""); }} className="w-full rounded-md border border-input bg-background px-3 py-2"><option value="">Selecione</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes} min</option>)}</select></label><label className="space-y-1 text-sm"><span className="text-muted-foreground">Profissional</span><select value={professionalId} onChange={(e) => { setProfessionalId(e.target.value); setSlot(""); }} className="w-full rounded-md border border-input bg-background px-3 py-2"><option value="">Qualquer</option>{serviceProfessionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="space-y-1 text-sm"><span className="text-muted-foreground">Data</span><input type="date" min={todayInTimezone(tz)} value={date} onChange={(e) => { setDate(e.target.value); setSlot(""); }} className="w-full rounded-md border border-input bg-background px-3 py-2" /></label><label className="space-y-1 text-sm"><span className="text-muted-foreground">Horário</span><select required value={slot} onChange={(e) => setSlot(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2"><option value="">Selecione</option>{(slotsQuery.data ?? []).filter((item) => item.available && new Date(item.startsAt).getTime() > Date.now()).map((item) => <option key={item.startsAt} value={item.startsAt}>{item.label}</option>)}</select></label></div><div className="grid gap-3 sm:grid-cols-3"><label className="space-y-1 text-sm"><span className="text-muted-foreground">Cliente</span><input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2" /></label><label className="space-y-1 text-sm"><span className="text-muted-foreground">Telefone/WhatsApp</span><input required minLength={8} value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2" /></label><label className="space-y-1 text-sm"><span className="text-muted-foreground">E-mail (opcional)</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2" /></label></div>{slotsQuery.isError ? <p className="text-sm text-destructive">Não foi possível carregar os horários.</p> : null}{slotsQuery.isSuccess && (slotsQuery.data ?? []).filter((item) => item.available && new Date(item.startsAt).getTime() > Date.now()).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum horário livre nesta data para o serviço selecionado.</p> : null}{error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}<button type="submit" disabled={mutation.isPending || !service || !slot} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">{mutation.isPending ? "Criando…" : "Confirmar agendamento"}</button></form>;
}
