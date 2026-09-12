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

  const [serviceRes, professionalsRes, linksRes, schedulesRes, exceptionsRes] = await Promise.all([
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

  if (serviceRes.error) throw serviceRes.error;
  if (professionalsRes.error) throw professionalsRes.error;
  if (linksRes.error) throw linksRes.error;
  if (schedulesRes.error) throw schedulesRes.error;
  if (exceptionsRes.error) throw exceptionsRes.error;
  if (!serviceRes.data) return null;

  const allowedProfessionalIds = new Set(
    (linksRes.data ?? []).map((item) => item.professional_id as string),
  );

  return {
    establishment: establishment as Establishment,
    service: serviceRes.data as Service,
    professionals: (professionalsRes.data ?? []).filter((item) => allowedProfessionalIds.has(item.id)) as Professional[],
    schedules: ((schedulesRes.data ?? []) as RawSchedule[]).map(
      (schedule): WeeklyScheduleInput => ({
        id: schedule.id,
        professional_id: schedule.professional_id,
        weekday: schedule.weekday,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        active: schedule.active,
        breaks: (schedule.schedule_breaks ?? []).map((item) => ({
          start: item.start_time,
          end: item.end_time,
        })),
      }),
    ),
    exceptions: (exceptionsRes.data ?? []) as ScheduleExceptionInput[],
  };
}

async function busyForProfessional(
  supabaseAdmin: SupabaseClient,
  establishmentId: string,
  date: string,
  professionalId: string,
) {
  const dayStart = new Date(`${date}T00:00:00Z`);
  const from = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(dayStart.getTime() + 48 * 60 * 60 * 1000).toISOString();

  const [appointments, blocks] = await Promise.all([
    supabaseAdmin
      .from("appointments")
      .select("starts_at, ends_at")
      .eq("establishment_id", establishmentId)
      .eq("professional_id", professionalId)
      .in("status", ["pending", "confirmed", "completed"])
      .gte("starts_at", from)
      .lte("starts_at", to),
    supabaseAdmin
      .from("blocked_slots")
      .select("starts_at, ends_at")
      .eq("establishment_id", establishmentId)
      .or(`professional_id.is.null,professional_id.eq.${professionalId}`)
      .gte("starts_at", from)
      .lte("starts_at", to),
  ]);

  if (appointments.error) throw appointments.error;
  if (blocks.error) throw blocks.error;

  return [
    ...(appointments.data ?? []),
    ...(blocks.data ?? []),
  ].map((item) => ({
    startsAt: new Date(item.starts_at),
    endsAt: new Date(item.ends_at),
  }));
}

async function availabilityForDuration({
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
  const relevantProfessionals = professionalId
    ? professionals.filter((professional) => professional.id === professionalId)
    : professionals;

  if (relevantProfessionals.length === 0) return [];

  const perProfessional = await Promise.all(
    relevantProfessionals.map(async (professional) => {
      const busy = await busyForProfessional(
        supabaseAdmin,
        establishment.id,
        date,
        professional.id,
      );

      return {
        professionalId: professional.id,
        slots: computeAvailability({
          date,
          timezone: establishment.timezone,
          serviceDurationMinutes: durationMinutes,
          professionalId: professional.id,
          schedules,
          exceptions,
          busy,
        }),
      };
    }),
  );

  const merged = new Map<string, AvailabilitySlot>();
  for (const result of perProfessional) {
    for (const slot of result.slots) {
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
  durationMinutes: z
    .number()
    .int()
    .min(15)
    .max(240)
    .refine((value) => value % 15 === 0, "A duração precisa ser múltipla de 15 minutos."),
  professionalId: z.string().uuid().nullable().optional(),
});

export const getCustomDurationAvailability = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => customAvailabilitySchema.parse(data))
  .handler(async ({ data }): Promise<AvailabilitySlot[]> => {
    const supabase = publicClient();
    const context = await loadContext(supabase, data.slug, data.serviceId);
    if (!context || !context.establishment.allow_custom_duration) return [];

    return availabilityForDuration({
      establishment: context.establishment,
      professionals: context.professionals,
      schedules: context.schedules,
      exceptions: context.exceptions,
      date: data.date,
      durationMinutes: data.durationMinutes,
      professionalId: data.professionalId ?? null,
      supabase,
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
      return {
        ok: false,
        error: "A duração personalizada não está disponível neste estabelecimento.",
      };
    }

    const startsAt = new Date(data.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      return { ok: false, error: "Horário inválido." };
    }
    const startsAtIso = startsAt.toISOString();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const candidateProfessionals = data.professionalId
      ? context.professionals.filter((professional) => professional.id === data.professionalId)
      : context.professionals;

    let chosen: Professional | undefined;
    for (const professional of candidateProfessionals) {
      const busy = await busyForProfessional(
        supabaseAdmin,
        context.establishment.id,
        data.date,
        professional.id,
      );
      const slots = computeAvailability({
        date: data.date,
        timezone: context.establishment.timezone,
        serviceDurationMinutes: data.durationMinutes,
        professionalId: professional.id,
        schedules: context.schedules,
        exceptions: context.exceptions,
        busy,
      });
      if (slots.some((slot) => slot.available && slot.startsAt === startsAtIso)) {
        chosen = professional;
        break;
      }
    }

    if (!chosen) {
      return {
        ok: false,
        error: "Esse intervalo não está mais disponível. Escolha outro horário.",
      };
    }

    const phone = data.customerPhone.replace(/\s+/g, " ").trim();
    const { data: existingCustomer, error: existingCustomerError } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("establishment_id", context.establishment.id)
      .eq("phone", phone)
      .maybeSingle();
    if (existingCustomerError) {
      return { ok: false, error: "Não foi possível validar os dados do cliente." };
    }

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
      if (customerError || !inserted) {
        return { ok: false, error: "Não foi possível registrar seus dados." };
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

    const { data: assignments, error: assignmentError } = await supabaseAdmin
      .from("customer_plan_assignments")
      .select(
        "plan_id, starts_at, expires_at, customer_plans!inner(id, name, active, duration_limit_minutes, establishment_id, customer_plan_services(service_id))",
      )
      .eq("customer_id", customerId)
      .eq("customer_plans.establishment_id", context.establishment.id)
      .order("starts_at", { ascending: false })
      .limit(20);
    if (assignmentError) {
      return { ok: false, error: "Não foi possível validar o plano do cliente." };
    }

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
        if (
          allowedServices.length > 0 &&
          !allowedServices.some((item) => item.service_id === context.service.id)
        ) {
          return { ok: false, error: `O plano ${plan.name} não permite este serviço.` };
        }
        if (
          plan.duration_limit_minutes !== null &&
          data.durationMinutes > plan.duration_limit_minutes
        ) {
          return {
            ok: false,
            error: `O plano ${plan.name} permite atendimentos de até ${plan.duration_limit_minutes} minutos.`,
          };
        }
      }
    }

    const endsAt = new Date(
      startsAt.getTime() + data.durationMinutes * 60_000,
    ).toISOString();

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
        return {
          ok: false,
          error: "Esse horário acabou de ser reservado. Escolha outro, por favor.",
        };
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
