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

type Establishment = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  allow_custom_duration: boolean;
};

type Service = {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
};

type Professional = { id: string; name: string };

type RawSchedule = {
  id: string;
  professional_id: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  active: boolean;
  schedule_breaks: { start_time: string; end_time: string }[];
};

async function loadContext(supabase: SupabaseClient, slug: string, serviceId: string) {
  const { data: establishment, error: establishmentError } = await supabase
    .from("establishments")
    .select("id, name, slug, timezone, allow_custom_duration")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (establishmentError) throw establishmentError;
  if (!establishment) return null;

  const [{ data: service, error: serviceError }, { data: professionals, error: professionalsError }, { data: links, error: linksError }, { data: schedules, error: schedulesError }, { data: exceptions, error: exceptionsError }] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, price, duration_minutes")
      .eq("id", serviceId)
      .eq("establishment_id", establishment.id)
      .eq("active", true)
      .maybeSingle(),
    supabase
      .from("professionals")
      .select("id, name")
      .eq("establishment_id", establishment.id)
      .eq("active", true)
      .order("name"),
    supabase
      .from("professional_services")
      .select("professional_id")
      .eq("service_id", serviceId),
    supabase
      .from("weekly_schedules")
      .select("id, professional_id, weekday, start_time, end_time, active, schedule_breaks(start_time, end_time)")
      .eq("establishment_id", establishment.id),
    supabase
      .from("schedule_exceptions")
      .select("professional_id, date, type, start_time, end_time")
      .eq("establishment_id", establishment.id),
  ]);

  if (serviceError) throw serviceError;
  if (professionalsError) throw professionalsError;
  if (linksError) throw linksError;
  if (schedulesError) throw schedulesError;
  if (exceptionsError) throw exceptionsError;
  if (!service) return null;

  const allowedProfessionalIds = new Set((links ?? []).map((item) => item.professional_id as string));
  const filteredProfessionals = (professionals ?? []).filter((item) => allowedProfessionalIds.has(item.id));

  return {
    establishment: establishment as Establishment,
    service: service as Service,
    professionals: filteredProfessionals as Professional[],
    schedules: ((schedules ?? []) as RawSchedule[]).map((schedule): WeeklyScheduleInput => ({
      id: schedule.id,
      professional_id: schedule.professional_id,
      weekday: schedule.weekday,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      active: schedule.active,
      breaks: (schedule.schedule_breaks ?? []).map((item) => ({ start: item.start_time, end: item.end_time })),
    })),
    exceptions: (exceptions ?? []) as ScheduleExceptionInput[],
  };
}

async function availabilityForDuration({
  supabase,
  establishment,
  professionals,
  schedules,
  exceptions,
  date,
  durationMinutes,
  professionalId,
}: {
  supabase: SupabaseClient;
  establishment: Establishment;
  professionals: Professional[];
  schedules: WeeklyScheduleInput[];
  exceptions: ScheduleExceptionInput[];
  date: string;
  durationMinutes: number;
  professionalId: string | null;
}): Promise<AvailabilitySlot[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const dayStart = new Date(`${date}T00:00:00Z`);
  const from = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(dayStart.getTime() + 48 * 60 * 60 * 1000).toISOString();

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
      (block) => block.professional_id === null || !professionalId || block.professional_id === professionalId,
    ),
  ].map((item) => ({ startsAt: new Date(item.starts_at), endsAt: new Date(item.ends_at) }));

  const relevantProfessionalIds = professionalId
    ? [professionalId]
    : professionals.map((professional) => professional.id);

  if (relevantProfessionalIds.length === 0) {
    return computeAvailability({
      date,
      timezone: establishment.timezone,
      serviceDurationMinutes: durationMinutes,
      professionalId: null,
      schedules,
      exceptions,
      busy,
    });
  }

  const perProfessional = relevantProfessionalIds.map((id) =>
    computeAvailability({
      date,
      timezone: establishment.timezone,
      serviceDurationMinutes: durationMinutes,
      professionalId: id,
      schedules,
      exceptions,
      busy,
    }),
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

const customAvailabilitySchema = z.object({
  slug: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId: z.string().uuid(),
  durationMinutes: z.number().int().min(15).max(240).refine((value) => value % 15 === 0, "A duração precisa ser múltipla de 15 minutos."),
  professionalId: z.string().uuid().nullable().optional(),
});

export const getCustomDurationAvailability = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => customAvailabilitySchema.parse(data))
  .handler(async ({ data }): Promise<AvailabilitySlot[]> => {
    const supabase = publicClient();
    const context = await loadContext(supabase, data.slug, data.serviceId);
    if (!context || !context.establishment.allow_custom_duration) return [];

    return availabilityForDuration({
      supabase,
      establishment: context.establishment,
      professionals: context.professionals,
      schedules: context.schedules,
      exceptions: context.exceptions,
      date: data.date,
      durationMinutes: data.durationMinutes,
      professionalId: data.professionalId ?? null,
    });
  });

const createCustomSchema = customAvailabilitySchema.extend({
  startsAt: z.string().min(10),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(8).max(30),
  customerEmail: z.string().trim().email().max(160).optional().or(z.literal("")),
});

export type CreateCustomDurationResult =
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

export const createCustomDurationAppointment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createCustomSchema.parse(data))
  .handler(async ({ data }): Promise<CreateCustomDurationResult> => {
    const supabase = publicClient();
    const context = await loadContext(supabase, data.slug, data.serviceId);
    if (!context || !context.establishment.allow_custom_duration) {
      return { ok: false, error: "A duração personalizada não está disponível neste estabelecimento." };
    }

    const startsAt = new Date(data.startsAt);
    if (Number.isNaN(startsAt.getTime())) return { ok: false, error: "Horário inválido." };
    const startsAtIso = startsAt.toISOString();

    const slots = await availabilityForDuration({
      supabase,
      establishment: context.establishment,
      professionals: context.professionals,
      schedules: context.schedules,
      exceptions: context.exceptions,
      date: data.date,
      durationMinutes: data.durationMinutes,
      professionalId: data.professionalId ?? null,
    });
    const selectedSlot = slots.find((slot) => slot.available && slot.startsAt === startsAtIso);
    if (!selectedSlot) return { ok: false, error: "Esse intervalo não está mais disponível. Escolha outro horário." };

    const orderedProfessionals = data.professionalId
      ? context.professionals.filter((item) => item.id === data.professionalId)
      : context.professionals;
    const chosen = orderedProfessionals.find((professional) => {
      return true;
    });

    if (!chosen) return { ok: false, error: "Nenhum profissional disponível para esse serviço." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = data.customerPhone.replace(/\s+/g, " ").trim();
    const { data: existingCustomer, error: existingCustomerError } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("establishment_id", context.establishment.id)
      .eq("phone", phone)
      .maybeSingle();
    if (existingCustomerError) return { ok: false, error: "Não foi possível validar os dados do cliente." };

    let customerId = existingCustomer?.id ?? null;
    if (!customerId) {
      const { data: inserted, error: customerError } = await supabaseAdmin
        .from("customers")
        .insert({
          establishment_id: context.establishment.id,
          name: data.customerName,
          phone,
          email: data.customerEmail || null,
        })
        .select("id")
        .single();
      if (customerError || !inserted) return { ok: false, error: "Não foi possível registrar seus dados." };
      customerId = inserted.id;
    } else {
      await supabaseAdmin.from("customers").update({
        name: data.customerName,
        ...(data.customerEmail ? { email: data.customerEmail } : {}),
      }).eq("id", customerId);
    }

    const { data: assignments, error: assignmentError } = await supabaseAdmin
      .from("customer_plan_assignments")
      .select("plan_id, starts_at, expires_at, customer_plans!inner(id, name, active, duration_limit_minutes, establishment_id, customer_plan_services(service_id))")
      .eq("customer_id", customerId)
      .eq("customer_plans.establishment_id", context.establishment.id)
      .order("starts_at", { ascending: false })
      .limit(20);
    if (assignmentError) return { ok: false, error: "Não foi possível validar o plano do cliente." };

    const activeAssignment = (assignments ?? []).find((item) => {
      const starts = new Date(item.starts_at).getTime();
      const expires = item.expires_at ? new Date(item.expires_at).getTime() : Infinity;
      return starts <= Date.now() && expires >= Date.now();
    });
    if (activeAssignment) {
      const plan = activeAssignment.customer_plans as unknown as {
        name: string;
        active: boolean;
        duration_limit_minutes: number | null;
        customer_plan_services: { service_id: string }[];
      };
      if (plan.active) {
        const allowedServices = plan.customer_plan_services ?? [];
        if (allowedServices.length > 0 && !allowedServices.some((item) => item.service_id === context.service.id)) {
          return { ok: false, error: `O plano ${plan.name} não permite este serviço.` };
        }
        if (plan.duration_limit_minutes !== null && data.durationMinutes > plan.duration_limit_minutes) {
          return { ok: false, error: `O plano ${plan.name} permite atendimentos de até ${plan.duration_limit_minutes} minutos.` };
        }
      }
    }

    const endsAt = new Date(startsAt.getTime() + data.durationMinutes * 60_000).toISOString();
    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from("appointments")
      .insert({
        establishment_id: context.establishment.id,
        customer_id: customerId,
        professional_id: chosen.id,
        service_id: context.service.id,
        starts_at: startsAtIso,
        ends_at: endsAt,
        duration_minutes_override: data.durationMinutes,
        status: "pending",
      })
      .select("id")
      .single();

    if (appointmentError || !appointment) {
      const code = (appointmentError as { code?: string } | null)?.code;
      if (code === "23P01" || code === "23505" || code === "P0001") {
        return { ok: false, error: "Esse horário acabou de ser reservado. Escolha outro, por favor." };
      }
      return { ok: false, error: "Não foi possível concluir o agendamento." };
    }

    return {
      ok: true,
      appointment: {
        id: appointment.id,
        startsAt: startsAtIso,
        endsAt,
        serviceName: context.service.name,
        professionalName: chosen.name,
        price: Number(context.service.price),
        durationMinutes: data.durationMinutes,
        timezone: context.establishment.timezone,
      },
    };
  });
