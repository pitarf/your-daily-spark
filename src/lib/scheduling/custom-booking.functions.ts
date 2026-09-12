import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  computeAvailability,
  type BusyInterval,
  type ScheduleExceptionInput,
  type WeeklyScheduleInput,
  zonedWallTimeToUtc,
} from "@/lib/scheduling/availability";

const inputSchema = z.object({
  slug: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid().nullable(),
  startsAt: z.string().regex(/^\d{2}:\d{2}$/),
  endsAt: z.string().regex(/^\d{2}:\d{2}$/),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(8).max(30),
  customerEmail: z.string().trim().email().max(160).optional(),
});

type CustomBookingResult =
  | {
      ok: true;
      appointment: {
        id: string;
        startsAt: string;
        endsAt: string;
        durationMinutes: number;
        serviceName: string;
        professionalName: string;
        price: number;
        pending: true;
      };
    }
  | { ok: false; error: string };

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

async function findEligibleProfessionals(
  establishmentId: string,
  serviceId: string,
  requestedProfessionalId: string | null,
) {
  let query = supabaseAdmin
    .from("professionals")
    .select("id, name, active")
    .eq("establishment_id", establishmentId)
    .eq("active", true);

  if (requestedProfessionalId) query = query.eq("id", requestedProfessionalId);

  const { data: professionals, error } = await query.order("name");
  if (error) throw error;
  if (!professionals?.length) return [];

  const { data: links, error: linksError } = await supabaseAdmin
    .from("professional_services")
    .select("professional_id")
    .eq("service_id", serviceId)
    .in("professional_id", professionals.map((item) => item.id));
  if (linksError) throw linksError;

  const allowed = new Set((links ?? []).map((item) => item.professional_id));
  return professionals.filter((item) => allowed.has(item.id));
}

async function loadAvailabilityInputs(establishmentId: string, professionalId: string, date: string) {
  const [weekdaySchedules, exceptions, appointments, blocks] = await Promise.all([
    supabaseAdmin
      .from("weekly_schedules")
      .select("id, professional_id, weekday, start_time, end_time, active, schedule_breaks(start_time, end_time)")
      .eq("establishment_id", establishmentId)
      .or(`professional_id.is.null,professional_id.eq.${professionalId}`),
    supabaseAdmin
      .from("schedule_exceptions")
      .select("professional_id, date, type, start_time, end_time")
      .eq("establishment_id", establishmentId)
      .eq("date", date)
      .or(`professional_id.is.null,professional_id.eq.${professionalId}`),
    supabaseAdmin
      .from("appointments")
      .select("starts_at, ends_at, status")
      .eq("establishment_id", establishmentId)
      .eq("professional_id", professionalId)
      .neq("status", "cancelled")
      .gte("starts_at", `${date}T00:00:00Z`)
      .lt("starts_at", `${date}T23:59:59.999Z`),
    supabaseAdmin
      .from("blocked_slots")
      .select("starts_at, ends_at")
      .eq("establishment_id", establishmentId)
      .or(`professional_id.is.null,professional_id.eq.${professionalId}`)
      .lt("starts_at", `${date}T23:59:59.999Z`)
      .gt("ends_at", `${date}T00:00:00Z`),
  ]);

  if (weekdaySchedules.error) throw weekdaySchedules.error;
  if (exceptions.error) throw exceptions.error;
  if (appointments.error) throw appointments.error;
  if (blocks.error) throw blocks.error;

  const schedules = (weekdaySchedules.data ?? []).map((item: any): WeeklyScheduleInput => ({
    id: item.id,
    professional_id: item.professional_id,
    weekday: item.weekday,
    start_time: item.start_time,
    end_time: item.end_time,
    active: item.active,
    breaks: (item.schedule_breaks ?? []).map((breakItem: any) => ({
      start: breakItem.start_time,
      end: breakItem.end_time,
    })),
  }));

  const exceptionInputs = (exceptions.data ?? []) as ScheduleExceptionInput[];

  const busy: BusyInterval[] = [
    ...(appointments.data ?? []).map((item) => ({
      startsAt: new Date(item.starts_at),
      endsAt: new Date(item.ends_at),
    })),
    ...(blocks.data ?? []).map((item) => ({
      startsAt: new Date(item.starts_at),
      endsAt: new Date(item.ends_at),
    })),
  ];

  return { schedules, exceptionInputs, busy };
}

export const createCustomAppointment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<CustomBookingResult> => {
    try {
      const { data: establishment, error: establishmentError } = await supabaseAdmin
        .from("establishments")
        .select("id, name, timezone, active")
        .eq("slug", data.slug)
        .eq("active", true)
        .maybeSingle();
      if (establishmentError) throw establishmentError;
      if (!establishment) return { ok: false, error: "Estabelecimento não encontrado." };

      const { data: service, error: serviceError } = await supabaseAdmin
        .from("services")
        .select("id, name, price, active")
        .eq("id", data.serviceId)
        .eq("establishment_id", establishment.id)
        .eq("active", true)
        .maybeSingle();
      if (serviceError) throw serviceError;
      if (!service) return { ok: false, error: "Serviço não encontrado." };

      const startMinutes = minutesFromTime(data.startsAt);
      const endMinutes = minutesFromTime(data.endsAt);
      const durationMinutes = endMinutes - startMinutes;
      if (startMinutes < 0 || endMinutes > 24 * 60 || durationMinutes < 15) {
        return { ok: false, error: "Informe um período válido de pelo menos 15 minutos." };
      }

      const startsAt = zonedWallTimeToUtc(data.date, startMinutes, establishment.timezone);
      const endsAt = zonedWallTimeToUtc(data.date, endMinutes, establishment.timezone);
      if (endsAt <= startsAt) return { ok: false, error: "O fim deve ser depois do início." };
      if (startsAt.getTime() <= Date.now()) return { ok: false, error: "Escolha um período futuro." };

      const { data: existingCustomer, error: customerError } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("establishment_id", establishment.id)
        .eq("phone", data.customerPhone)
        .maybeSingle();
      if (customerError) throw customerError;

      let customerId = existingCustomer?.id;
      if (!customerId) {
        const { data: customer, error: createCustomerError } = await supabaseAdmin
          .from("customers")
          .insert({
            establishment_id: establishment.id,
            name: data.customerName,
            phone: data.customerPhone,
            email: data.customerEmail || null,
          })
          .select("id")
          .single();
        if (createCustomerError || !customer) throw createCustomerError ?? new Error("Não foi possível criar o cliente.");
        customerId = customer.id;
      } else {
        await supabaseAdmin
          .from("customers")
          .update({ name: data.customerName, email: data.customerEmail || null })
          .eq("id", customerId)
          .eq("establishment_id", establishment.id);
      }

      const { data: assignments, error: assignmentsError } = await supabaseAdmin
        .from("customer_plan_assignments")
        .select("plan_id, starts_at, expires_at, customer_plans(duration_limit_minutes)")
        .eq("customer_id", customerId);
      if (assignmentsError) throw assignmentsError;

      const activeAssignment = (assignments ?? []).find((item: any) => {
        const starts = item.starts_at ? new Date(item.starts_at).getTime() : -Infinity;
        const expires = item.expires_at ? new Date(item.expires_at).getTime() : Infinity;
        const now = Date.now();
        return starts <= now && now <= expires;
      });

      if (activeAssignment?.customer_plans?.duration_limit_minutes && durationMinutes > activeAssignment.customer_plans.duration_limit_minutes) {
        return {
          ok: false,
          error: `Seu plano permite no máximo ${activeAssignment.customer_plans.duration_limit_minutes} minutos por agendamento.`,
        };
      }

      if (activeAssignment?.plan_id) {
        const { data: allowedService, error: planServiceError } = await supabaseAdmin
          .from("customer_plan_services")
          .select("plan_id")
          .eq("plan_id", activeAssignment.plan_id)
          .eq("service_id", service.id)
          .maybeSingle();
        if (planServiceError) throw planServiceError;
        if (!allowedService) return { ok: false, error: "Este serviço não está disponível no seu plano." };
      }

      const professionals = await findEligibleProfessionals(establishment.id, service.id, data.professionalId);
      if (professionals.length === 0) return { ok: false, error: "Nenhum profissional disponível para este serviço." };

      let selectedProfessional: (typeof professionals)[number] | null = null;
      for (const professional of professionals) {
        const { schedules, exceptionInputs, busy } = await loadAvailabilityInputs(
          establishment.id,
          professional.id,
          data.date,
        );

        const slots = computeAvailability({
          date: data.date,
          timezone: establishment.timezone,
          serviceDurationMinutes: durationMinutes,
          slotStepMinutes: 1,
          professionalId: professional.id,
          schedules,
          exceptions: exceptionInputs,
          busy,
        });

        const target = slots.find((slot) => slot.startsAt === startsAt.toISOString() && slot.endsAt === endsAt.toISOString() && slot.available);
        if (target) {
          selectedProfessional = professional;
          break;
        }
      }

      if (!selectedProfessional) {
        return { ok: false, error: "Esse período não está disponível. Escolha outro horário." };
      }

      const { data: appointment, error: appointmentError } = await supabaseAdmin
        .from("appointments")
        .insert({
          establishment_id: establishment.id,
          customer_id: customerId,
          professional_id: selectedProfessional.id,
          service_id: service.id,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          status: "pending",
        })
        .select("id, starts_at, ends_at")
        .single();

      if (appointmentError || !appointment) {
        if (String(appointmentError?.code) === "23P01") {
          return { ok: false, error: "Esse período acabou de ser ocupado. Escolha outro horário." };
        }
        throw appointmentError ?? new Error("Não foi possível criar a solicitação.");
      }

      return {
        ok: true,
        appointment: {
          id: appointment.id,
          startsAt: appointment.starts_at,
          endsAt: appointment.ends_at,
          durationMinutes,
          serviceName: service.name,
          professionalName: selectedProfessional.name,
          price: Number(service.price),
          pending: true,
        },
      };
    } catch (error) {
      console.error("createCustomAppointment", error);
      return { ok: false, error: "Não foi possível registrar sua solicitação agora." };
    }
  });