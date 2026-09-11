import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  computeAvailability,
  type AvailabilitySlot,
  type ScheduleExceptionInput,
  type WeeklyScheduleInput,
} from "./availability";

function publicClient() {
  return createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type EstablishmentSchedulingData = {
  establishment: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    timezone: string;
    address: string | null;
    phone: string | null;
  };
  services: {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    price: number;
    professionalIds: string[];
  }[];
  professionals: { id: string; name: string; description: string | null; photo_url: string | null }[];
  schedules: WeeklyScheduleInput[];
};

/** Carrega a configuração pública de agenda de um estabelecimento (sem dados de clientes). */
export const getEstablishmentScheduling = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<EstablishmentSchedulingData | null> => {
    const supabase = publicClient();

    const { data: establishment, error } = await supabase
      .from("establishments")
      .select("id, name, slug, description, timezone, address, phone")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (error) throw error;
    if (!establishment) return null;

    const [servicesRes, professionalsRes, schedulesRes] = await Promise.all([
      supabase
        .from("services")
        .select("id, name, description, duration_minutes, price")
        .eq("establishment_id", establishment.id)
        .eq("active", true)
        .order("duration_minutes"),
      supabase
        .from("professionals")
        .select("id, name, description, photo_url")
        .eq("establishment_id", establishment.id)
        .eq("active", true)
        .order("name"),
      supabase
        .from("weekly_schedules")
        .select("id, professional_id, weekday, start_time, end_time, active, schedule_breaks(start_time, end_time)")
        .eq("establishment_id", establishment.id)
        .eq("active", true),
    ]);
    if (servicesRes.error) throw servicesRes.error;
    if (professionalsRes.error) throw professionalsRes.error;
    if (schedulesRes.error) throw schedulesRes.error;

    const professionals = professionalsRes.data ?? [];
    const { data: links } = await supabase
      .from("professional_services")
      .select("professional_id, service_id")
      .in("professional_id", professionals.map((p) => p.id));

    return {
      establishment,
      services: (servicesRes.data ?? []).map((s) => ({
        ...s,
        price: Number(s.price),
        professionalIds: (links ?? [])
          .filter((l) => l.service_id === s.id)
          .map((l) => l.professional_id),
      })),
      professionals,
      schedules: (schedulesRes.data ?? []).map((s) => ({
        id: s.id,
        professional_id: s.professional_id,
        weekday: s.weekday,
        start_time: s.start_time,
        end_time: s.end_time,
        active: s.active,
        breaks: ((s as unknown as { schedule_breaks: { start_time: string; end_time: string }[] })
          .schedule_breaks ?? []).map((b) => ({ start: b.start_time, end: b.end_time })),
      })),
    };
  });

/**
 * Disponibilidade pública: devolve apenas livre/ocupado, nunca dados de clientes.
 * As ocupações são lidas no servidor com privilégio, mas só o intervalo sai daqui.
 */
export const getAvailability = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        slug: z.string().min(1),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        serviceId: z.string().uuid(),
        professionalId: z.string().uuid().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<AvailabilitySlot[]> => {
    const supabase = publicClient();

    const { data: establishment } = await supabase
      .from("establishments")
      .select("id, timezone")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (!establishment) return [];

    const { data: service } = await supabase
      .from("services")
      .select("id, duration_minutes")
      .eq("id", data.serviceId)
      .eq("establishment_id", establishment.id)
      .eq("active", true)
      .maybeSingle();
    if (!service) return [];

    const { data: schedules } = await supabase
      .from("weekly_schedules")
      .select("id, professional_id, weekday, start_time, end_time, active, schedule_breaks(start_time, end_time)")
      .eq("establishment_id", establishment.id)
      .eq("active", true);

    const { data: exceptions } = await supabase
      .from("schedule_exceptions")
      .select("professional_id, date, type, start_time, end_time")
      .eq("establishment_id", establishment.id)
      .eq("date", data.date);

    const professionalId = data.professionalId ?? null;

    // Ocupações (agendamentos e bloqueios) — só instantes, sem identificação.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dayStart = new Date(`${data.date}T00:00:00Z`);
    const from = new Date(dayStart.getTime() - 24 * 3600 * 1000).toISOString();
    const to = new Date(dayStart.getTime() + 48 * 3600 * 1000).toISOString();

    let appointmentsQuery = supabaseAdmin
      .from("appointments")
      .select("starts_at, ends_at, professional_id")
      .eq("establishment_id", establishment.id)
      .in("status", ["pending", "confirmed", "completed"])
      .gte("starts_at", from)
      .lte("starts_at", to);
    if (professionalId) appointmentsQuery = appointmentsQuery.eq("professional_id", professionalId);

    const [appointments, blocks] = await Promise.all([
      appointmentsQuery,
      supabaseAdmin
        .from("blocked_slots")
        .select("starts_at, ends_at, professional_id")
        .eq("establishment_id", establishment.id)
        .gte("starts_at", from)
        .lte("starts_at", to),
    ]);

    const busy = [
      ...(appointments.data ?? []),
      ...(blocks.data ?? []).filter(
        (b) => b.professional_id === null || !professionalId || b.professional_id === professionalId,
      ),
    ].map((b) => ({ startsAt: new Date(b.starts_at), endsAt: new Date(b.ends_at) }));

    return computeAvailability({
      date: data.date,
      timezone: establishment.timezone,
      serviceDurationMinutes: service.duration_minutes,
      professionalId,
      schedules: (schedules ?? []).map((s) => ({
        id: s.id,
        professional_id: s.professional_id,
        weekday: s.weekday,
        start_time: s.start_time,
        end_time: s.end_time,
        active: s.active,
        breaks: ((s as unknown as { schedule_breaks: { start_time: string; end_time: string }[] })
          .schedule_breaks ?? []).map((b) => ({ start: b.start_time, end: b.end_time })),
      })),
      exceptions: (exceptions ?? []) as ScheduleExceptionInput[],
      busy,
    });
  });
