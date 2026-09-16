import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";

import { findCustomerAppointments } from "@/lib/scheduling/appointment-management.functions";
import { formatDate, formatTime, todayInTimezone } from "@/lib/scheduling/format";

export function CustomerAppointmentLookupPage({
  slug,
  timezone,
  establishmentName,
}: {
  slug: string;
  timezone: string;
  establishmentName: string;
}) {
  const findAppointments = useServerFn(findCustomerAppointments);
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(() => todayInTimezone(timezone));
  const [error, setError] = useState<string | null>(null);

  const search = useMutation({
    mutationFn: () => findAppointments({ data: { slug, customerPhone: phone, date } }),
    onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : "Não foi possível consultar seus agendamentos."),
    onSuccess: () => setError(null),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    search.mutate();
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:py-12">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Gerenciar agendamento</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Encontre seu atendimento</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Informe o telefone usado na reserva e a data do atendimento em {establishmentName}. Por segurança, exibimos somente os agendamentos que correspondem aos dois dados.
        </p>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Telefone/WhatsApp</span>
            <input required minLength={8} autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2" placeholder="(21) 99999-0000" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Data do atendimento</span>
            <input required type="date" value={date} min={todayInTimezone(timezone)} onChange={(event) => setDate(event.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2" />
          </label>

          {error ? <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-sm" role="alert">{error}</p> : null}

          <button type="submit" disabled={search.isPending} className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {search.isPending ? "Consultando…" : "Consultar agendamento"}
          </button>
        </form>

        {search.isSuccess ? (
          search.data.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhum agendamento pendente ou confirmado foi encontrado para esse telefone e essa data.</div>
          ) : (
            <div className="mt-6 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Agendamentos encontrados</h2>
              {search.data.map((appointment) => (
                <article key={appointment.id} className="rounded-xl border border-border p-4">
                  <p className="font-semibold text-foreground">{appointment.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{appointment.professionalName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{formatDate(appointment.startsAt, timezone)} · {formatTime(appointment.startsAt, timezone)} às {formatTime(appointment.endsAt, timezone)}</p>
                  <a href={appointment.managementPath} className="mt-4 inline-flex rounded-md border border-input px-3 py-2 text-sm font-medium text-foreground hover:bg-accent">Abrir meu agendamento</a>
                </article>
              ))}
            </div>
          )
        ) : null}
      </section>
    </main>
  );
}
