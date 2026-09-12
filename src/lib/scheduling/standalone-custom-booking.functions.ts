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
  timezone: string;
  allow_custom_duration: boolean;
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

type Context = {
  establishment: Establishment;
  professionals: Professional[];
  schedules: WeeklyScheduleInput[];
  exceptions: ScheduleExceptionInput[];
};

const durationSchema = z
  .number()
  .int()
  .min(15)
  .max(240)
  .refine((value) => value % 15 === 0, "A duração precisa ser múltipla de 15 minutos.");

const availabilitySchema = z.object({
  slug: z.string().trim().min(1).max(160),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: durationSchema,
  professionalId: z.string().uuid().nullable().optional(),
});

async function loadContext(supabase: SupabaseClient, slug: string): Promise<Context | null> {
  const { data: establishment, error: establishmentError } = await supabase
    .from("establishments")
    .select("id, name, timezone, allow_custom_duration")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (establishmentError) throw establishmentError;
  if (!establishment) return null;

  const [professionalsRes, schedulesRes, exceptionsRes] = await Promise.all([
    supabase
      .from("professionals")
      .select("id, name")
      .eq("establishment_id", establishment.id)
      .eq("active", true)
      .order("name"),
    supabase
      .from("weekly_schedules")
      .select("id, professional_id, weekday, start_time, end_time, active, schedule_breaks(start_time, end_time)")
      .eq("establishment_id", establishment.id),
    supabase
      .from("schedule_exceptions")
      .select("professional_id, date, type, start_time, end_time")
      .eq("establishment_id", establishment.id),
  ]);

  if (professionalsRes.error) throw professionalsRes.error;
  if (schedulesRes.error) throw schedulesRes.error;
  if (exceptionsRes.error) throw exceptionsRes.error;

  return {
    establishment: establishment as Establishment,
    professionals: (professionalsRes.data ?? []) as Professional[],
    schedules: ((schedulesRes.data ?? []) as RawSchedule[]).map((schedule) => ({
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
    })),
    exceptions: (exceptionsRes.data ?? []) as ScheduleExceptionInput[],
  };
}

async function busyForProfessional(
  admin: SupabaseClient<any>,
  establishmentId: string,
  date: string,
  professionalId: string,
) {
  const dayStart = new Date(`${date}T00:00:00Z`);
  const from = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(dayStart.getTime() + 48 * 60 * 60 * 1000).toISOString();

  const [appointments, blocks] = await Promise.all([
    admin
      .from("appointments")
      .select("starts_at, ends_at")
      .eq("establishment_id", establishmentId)
      .eq("professional_id", professionalId)
      .in("status", ["pending", "confirmed", "completed"])
      .gte("starts_at", from)
      .lte("starts_at", to),
    admin
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

export const getStandaloneCustomAvailability = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => availabilitySchema.parse(data))
  .handler(async ({ data }): Promise<AvailabilitySlot[]> => {
    const supabase = publicClient();
    const context = await loadContext(supabase, data.slug);
    if (!context || !context.establishment.allow_custom_duration) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const candidates = data.professionalId
      ? context.professionals.filter((professional) => professional.id === data.professionalId)
      : context.professionals;

    const perProfessional = await Promise.all(
      candidates.map(async (professional) => {
        const busy = await busyForProfessional(
          supabaseAdmin as SupabaseClient<any>,
          context.establishment.id,
          data.date,
          professional.id,
        );

        return computeAvailability({
          date: data.date,
          timezone: context.establishment.timezone,
          serviceDurationMinutes: data.durationMinutes,
          professionalId: professional.id,
          schedules: context.schedules,
          exceptions: context.exceptions,
          busy,
        });
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
  });

const createSchema = availabilitySchema.extend({
  startsAt: z.string().min(10),
  title: z.string().trim().min(2).max(120),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(8).max(30),
  customerEmail: z.string().trim().email().max(160).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type CreateStandaloneCustomResult =
  | {
      ok: true;
      appointment: {
        id: string;
        startsAt: string;
        endsAt: string;
        title: string;
        professionalName: string;
        durationMinutes: number;
        timezone: string;
      };
    }
  | { ok: false; error: string };

export const createStandaloneCustomAppointment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data }): Promise<CreateStandaloneCustomResult> => {
    const supabase = publicClient();
    const context = await loadContext(supabase, data.slug);
    if (!context || !context.establishment.allow_custom_duration) {
      return { ok: false, error: "O agendamento personalizado não está disponível neste estabelecimento." };
    }

    const startsAt = new Date(data.startsAt);
    if (Number.isNaN(startsAt.getTime())) return { ok: false, error: "Horário inválido." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as SupabaseClient<any>;
    const candidates = data.professionalId
      ? context.professionals.filter((professional) => professional.id === data.professionalId)
      : context.professionals;

    let chosen: Professional | undefined;
    for (const professional of candidates) {
      const busy = await busyForProfessional(admin, context.establishment.id, data.date, professional.id);
      const slots = computeAvailability({
        date: data.date,
        timezone: context.establishment.timezone,
        serviceDurationMinutes: data.durationMinutes,
        professionalId: professional.id,
        schedules: context.schedules,
        exceptions: context.exceptions,
        busy,
      });
      if (slots.some((slot) => slot.available && slot.startsAt === startsAt.toISOString())) {
        chosen = professional;
        break;
      }
    }

    if (!chosen) {
      return { ok: false, error: "Esse intervalo não está mais disponível. Escolha outro horário." };
    }

    const phone = data.customerPhone.replace(/\s+/g, " ").trim();
    const { data: existingCustomer, error: customerLookupError } = await admin
      .from("customers")
      .select("id")
      .eq("establishment_id", context.establishment.id)
      .eq("phone", phone)
      .maybeSingle();
    if (customerLookupError) return { ok: false, error: "Não foi possível validar os dados do cliente." };

    let customerId = existingCustomer?.id ?? null;
    if (!customerId) {
      const { data: createdCustomer, error } = await admin
        .from("customers")
        .insert({
          establishment_id: context.establishment.id,
          name: data.customerName,
          phone,
          email: data.customerEmail || null,
        })
        .select("id")
        .single();
      if (error || !createdCustomer) return { ok: false, error: "Não foi possível registrar seus dados." };
      customerId = createdCustomer.id;
    } else {
      await admin
        .from("customers")
        .update({
          name: data.customerName,
          ...(data.customerEmail ? { email: data.customerEmail } : {}),
        })
        .eq("id", customerId);
    }

    const { data: assignments, error: assignmentError } = await admin
      .from("customer_plan_assignments")
      .select("starts_at, expires_at, customer_plans!inner(name, active, duration_limit_minutes, establishment_id)")
      .eq("customer_id", customerId)
      .eq("customer_plans.establishment_id", context.establishment.id)
      .order("starts_at", { ascending: false })
      .limit(20);
    if (assignmentError) return { ok: false, error: "Não foi possível validar o plano do cliente." };

    const activeAssignment = (assignments ?? []).find((assignment) => {
      const starts = new Date(assignment.starts_at).getTime();
      const expires = assignment.expires_at ? new Date(assignment.expires_at).getTime() : Infinity;
      return starts <= Date.now() && expires >= Date.now();
    });

    if (activeAssignment) {
      const plan = activeAssignment.customer_plans as unknown as {
        name: string;
        active: boolean;
        duration_limit_minutes: number | null;
      };
      if (plan.active && plan.duration_limit_minutes !== null && data.durationMinutes > plan.duration_limit_minutes) {
        return {
          ok: false,
          error: `O plano ${plan.name} permite atendimentos de até ${plan.duration_limit_minutes} minutos.`,
        };
      }
    }

    const endsAt = new Date(startsAt.getTime() + data.durationMinutes * 60_000).toISOString();
    const { data: appointment, error: appointmentError } = await admin
      .from("appointments")
      .insert({
        establishment_id: context.establishment.id,
        customer_id: customerId,
        professional_id: chosen.id,
        service_id: null,
        custom_title: data.title,
        custom_price: null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt,
        duration_minutes_override: data.durationMinutes,
        status: "pending",
        notes: data.notes || null,
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
        startsAt: startsAt.toISOString(),
        endsAt,
        title: data.title,
        professionalName: chosen.name,
        durationMinutes: data.durationMinutes,
        timezone: context.establishment.timezone,
      },
    };
  });
