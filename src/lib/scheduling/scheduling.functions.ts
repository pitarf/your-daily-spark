import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
      schedules: (schedulesRes.data ?? []).map(mapSchedule),
    };
  });

type RawSchedule = {
  id: string;
  professional_id: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  active: boolean;
};

function mapSchedule(s: RawSchedule): WeeklyScheduleInput {
  return {
    id: s.id,
    professional_id: s.professional_id,
    weekday: s.weekday,
    start_time: s.start_time,
    end_time: s.end_time,
    active: s.active,
    breaks: ((s as unknown as { schedule_breaks: { start_time: string; end_time: string }[] })
      .schedule_breaks ?? []).map((b) => ({ start: b.start_time, end: b.end_time })),
  };
}

/**
 * Núcleo compartilhado: recalcula no servidor a disponibilidade de um dia.
 * Devolve apenas instantes livres/ocupados — nunca dados de clientes.
 */
async function computeDayAvailability(params: {
  supabase: SupabaseClient;
  establishment: { id: string; timezone: string };
  serviceDurationMinutes: number;
  date: string;
  professionalId: string | null;
}): Promise<AvailabilitySlot[]> {
  const { supabase, establishment, date, professionalId } = params;

  const { data: schedules } = await supabase
    .from("weekly_schedules")
    .select("id, professional_id, weekday, start_time, end_time, active, schedule_breaks(start_time, end_time)")
    .eq("establishment_id", establishment.id)
    .eq("active", true);

  const { data: exceptions } = await supabase
    .from("schedule_exceptions")
    .select("professional_id, date, type, start_time, end_time")
    .eq("establishment_id", establishment.id)
    .eq("date", date);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const dayStart = new Date(`${date}T00:00:00Z`);
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
    date,
    timezone: establishment.timezone,
    serviceDurationMinutes: params.serviceDurationMinutes,
    professionalId,
    schedules: ((schedules ?? []) as RawSchedule[]).map(mapSchedule),
    exceptions: (exceptions ?? []) as ScheduleExceptionInput[],
    busy,
  });
}

/** Lista os profissionais ativos que realizam o serviço informado. */
async function serviceProfessionalIds(
  supabase: SupabaseClient,
  establishmentId: string,
  serviceId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("professional_services")
    .select("professional_id, professionals!inner(id, active, establishment_id)")
    .eq("service_id", serviceId)
    .eq("professionals.active", true)
    .eq("professionals.establishment_id", establishmentId);
  return (data ?? []).map((row) => row.professional_id as string);
}

/**
 * Disponibilidade combinada: sem profissional escolhido, o horário fica livre
 * quando ao menos um profissional que faz o serviço estiver livre.
 */
async function availabilityForSelection(params: {
  supabase: SupabaseClient;
  establishment: { id: string; timezone: string };
  serviceId: string;
  serviceDurationMinutes: number;
  date: string;
  professionalId: string | null;
}): Promise<AvailabilitySlot[]> {
  const { supabase, establishment, serviceId, serviceDurationMinutes, date, professionalId } = params;

  if (professionalId) {
    return computeDayAvailability({
      supabase,
      establishment,
      serviceDurationMinutes,
      date,
      professionalId,
    });
  }

  const candidates = await serviceProfessionalIds(supabase, establishment.id, serviceId);
  if (candidates.length === 0) {
    return computeDayAvailability({
      supabase,
      establishment,
      serviceDurationMinutes,
      date,
      professionalId: null,
    });
  }

  const perProfessional = await Promise.all(
    candidates.map((id) =>
      computeDayAvailability({
        supabase,
        establishment,
        serviceDurationMinutes,
        date,
        professionalId: id,
      }),
    ),
  );

  const merged = new Map<string, AvailabilitySlot>();
  for (const slots of perProfessional) {
    for (const slot of slots) {
      const current = merged.get(slot.startsAt);
      if (!current) merged.set(slot.startsAt, { ...slot });
      else if (slot.available) current.available = true;
    }
  }
  return [...merged.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Disponibilidade pública: devolve apenas livre/ocupado, nunca dados de clientes. */
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

    return availabilityForSelection({
      supabase,
      establishment,
      serviceId: service.id,
      serviceDurationMinutes: service.duration_minutes,
      date: data.date,
      professionalId: data.professionalId ?? null,
    });
  });

export type CreateAppointmentResult =
  | {
      ok: true;
      appointment: {
        id: string;
        startsAt: string;
        endsAt: string;
        serviceName: string;
        professionalName: string;
        price: number;
        durationMinutes: number;
        timezone: string;
      };
    }
  | { ok: false; error: string };

const createAppointmentSchema = z.object({
  slug: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid().nullable().optional(),
  startsAt: z.string().min(10),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(8).max(30),
  customerEmail: z.string().trim().email().max(160).optional().or(z.literal("")),
});

/**
 * Criação real de agendamento — toda a validação acontece no servidor.
 * Nunca confia no horário/duração/preço enviados pela interface.
 */
export const createAppointment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createAppointmentSchema.parse(data))
  .handler(async ({ data }): Promise<CreateAppointmentResult> => {
    const supabase = publicClient();

    const { data: establishment } = await supabase
      .from("establishments")
      .select("id, timezone")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (!establishment) return { ok: false, error: "Estabelecimento indisponível." };

    const { data: service } = await supabase
      .from("services")
      .select("id, name, duration_minutes, price")
      .eq("id", data.serviceId)
      .eq("establishment_id", establishment.id)
      .eq("active", true)
      .maybeSingle();
    if (!service) return { ok: false, error: "Serviço indisponível." };

    // Profissionais ativos que realmente realizam esse serviço.
    const { data: links } = await supabase
      .from("professional_services")
      .select("professional_id")
      .eq("service_id", service.id);
    const allowedIds = (links ?? []).map((l) => l.professional_id);

    const { data: professionals } = await supabase
      .from("professionals")
      .select("id, name")
      .eq("establishment_id", establishment.id)
      .eq("active", true)
      .in("id", allowedIds.length > 0 ? allowedIds : ["00000000-0000-0000-0000-000000000000"])
      .order("name");

    const candidates = professionals ?? [];
    if (candidates.length === 0) {
      return { ok: false, error: "Nenhum profissional realiza esse serviço no momento." };
    }

    if (data.professionalId && !candidates.some((p) => p.id === data.professionalId)) {
      return { ok: false, error: "Esse profissional não realiza o serviço escolhido." };
    }

    const startsAtIso = new Date(data.startsAt).toISOString();
    if (Number.isNaN(new Date(data.startsAt).getTime())) {
      return { ok: false, error: "Horário inválido." };
    }

    const order = data.professionalId
      ? candidates.filter((p) => p.id === data.professionalId)
      : candidates;

    let chosen: { id: string; name: string } | null = null;
    for (const professional of order) {
      const slots = await computeDayAvailability({
        supabase,
        establishment,
        serviceDurationMinutes: service.duration_minutes,
        date: data.date,
        professionalId: professional.id,
      });
      const slot = slots.find((s) => new Date(s.startsAt).toISOString() === startsAtIso);
      if (slot?.available) {
        chosen = professional;
        break;
      }
    }

    if (!chosen) {
      return {
        ok: false,
        error: "Esse horário não está mais disponível. Escolha outro, por favor.",
      };
    }

    const endsAt = new Date(
      new Date(startsAtIso).getTime() + service.duration_minutes * 60_000,
    ).toISOString();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const phone = data.customerPhone.replace(/\s+/g, " ").trim();
    const { data: existingCustomer } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("establishment_id", establishment.id)
      .eq("phone", phone)
      .maybeSingle();

    let customerId = existingCustomer?.id ?? null;
    if (!customerId) {
      const { data: inserted, error: customerError } = await supabaseAdmin
        .from("customers")
        .insert({
          establishment_id: establishment.id,
          name: data.customerName,
          phone,
          email: data.customerEmail ? data.customerEmail : null,
        })
        .select("id")
        .single();
      if (customerError || !inserted) {
        return { ok: false, error: "Não foi possível registrar seus dados. Tente novamente." };
      }
      customerId = inserted.id;
    } else {
      await supabaseAdmin
        .from("customers")
        .update({
          name: data.customerName,
          ...(data.customerEmail ? { email: data.customerEmail } : {}),
        })
        .eq("id", customerId);
    }

    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from("appointments")
      .insert({
        establishment_id: establishment.id,
        customer_id: customerId,
        professional_id: chosen.id,
        service_id: service.id,
        starts_at: startsAtIso,
        ends_at: endsAt,
        status: "pending",
      })
      .select("id")
      .single();

    if (appointmentError || !appointment) {
      // Última barreira: constraint de exclusão / trigger do banco.
      const code = (appointmentError as { code?: string } | null)?.code;
      if (code === "23P01" || code === "23505" || code === "P0001") {
        return {
          ok: false,
          error: "Esse horário acabou de ser reservado por outra pessoa. Escolha outro, por favor.",
        };
      }
      console.error("createAppointment", appointmentError);
      return { ok: false, error: "Não foi possível concluir o agendamento. Tente novamente." };
    }

    return {
      ok: true,
      appointment: {
        id: appointment.id,
        startsAt: startsAtIso,
        endsAt,
        serviceName: service.name,
        professionalName: chosen.name,
        price: Number(service.price),
        durationMinutes: service.duration_minutes,
        timezone: establishment.timezone,
      },
    };
  });
