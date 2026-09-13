import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  computeAvailability,
  type AvailabilitySlot,
  type ScheduleExceptionInput,
  type WeeklyScheduleInput,
} from "@/lib/scheduling/availability";
import { dayRangeUtc } from "@/lib/scheduling/format";
import { signManagementToken, verifyManagementToken } from "@/lib/security/management-token.server";

const managementTokenInput = z.object({
  appointmentId: z.string().uuid(),
  token: z.string().min(20),
});
const managementLinkInput = z.object({
  slug: z.string().trim().min(1).max(160),
  appointmentId: z.string().uuid(),
  customerPhone: z.string().trim().min(8).max(30),
});
const lookupInput = z.object({
  slug: z.string().trim().min(1).max(160),
  customerPhone: z.string().trim().min(8).max(30),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const rescheduleAvailabilityInput = z.object({
  appointmentId: z.string().uuid(),
  token: z.string().min(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const rescheduleInput = z.object({
  appointmentId: z.string().uuid(),
  token: z.string().min(20),
  startsAt: z.string().min(10),
});

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

async function loadAppointmentForManagement(appointmentId: string) {
  const { data: appointment, error } = await supabaseAdmin
    .from("appointments")
    .select("id, establishment_id, customer_id, professional_id, service_id, custom_title, custom_price, duration_minutes_override, starts_at, ends_at, status")
    .eq("id", appointmentId)
    .maybeSingle();
  if (error) throw error;
  if (!appointment) throw new Error("Agendamento não encontrado.");

  const [{ data: customer, error: customerError }, { data: professional, error: professionalError }, { data: service, error: serviceError }, { data: establishment, error: establishmentError }] = await Promise.all([
    supabaseAdmin.from("customers").select("name, phone").eq("id", appointment.customer_id).maybeSingle(),
    supabaseAdmin.from("professionals").select("name").eq("id", appointment.professional_id).maybeSingle(),
    appointment.service_id
      ? supabaseAdmin.from("services").select("name, duration_minutes, price").eq("id", appointment.service_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabaseAdmin.from("establishments").select("id, name, slug, timezone").eq("id", appointment.establishment_id).maybeSingle(),
  ]);
  if (customerError) throw customerError;
  if (professionalError) throw professionalError;
  if (serviceError) throw serviceError;
  if (establishmentError) throw establishmentError;
  if (!customer?.phone || !establishment) throw new Error("Não foi possível validar o agendamento.");
  return { appointment, customer, professional, service, establishment };
}

function canCustomerChangeAppointment(appointment: { status: string; starts_at: string }) {
  return ["pending", "confirmed"].includes(appointment.status) && new Date(appointment.starts_at).getTime() > Date.now();
}

function durationForAppointment(
  appointment: { duration_minutes_override: number | null; starts_at: string; ends_at: string },
  service: { duration_minutes: number } | null,
) {
  return appointment.duration_minutes_override
    ?? service?.duration_minutes
    ?? Math.max(15, Math.round((new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60000));
}

type RawSchedule = {
  id: string;
  professional_id: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  active: boolean;
  schedule_breaks?: { start_time: string; end_time: string }[];
};

function mapSchedule(schedule: RawSchedule): WeeklyScheduleInput {
  return {
    id: schedule.id,
    professional_id: schedule.professional_id,
    weekday: schedule.weekday,
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    active: schedule.active,
    breaks: (schedule.schedule_breaks ?? []).map((item) => ({ start: item.start_time, end: item.end_time })),
  };
}

async function getRescheduleAvailability(appointmentId: string, date: string, now = new Date()) {
  const loaded = await loadAppointmentForManagement(appointmentId);
  const { appointment, establishment, service } = loaded;
  if (!canCustomerChangeAppointment(appointment)) return { slots: [], loaded };

  const { data: schedules, error: schedulesError } = await supabaseAdmin
    .from("weekly_schedules")
    .select("id, professional_id, weekday, start_time, end_time, active, schedule_breaks(start_time, end_time)")
    .eq("establishment_id", establishment.id);
  if (schedulesError) throw schedulesError;

  const { data: exceptions, error: exceptionsError } = await supabaseAdmin
    .from("schedule_exceptions")
    .select("professional_id, date, type, start_time, end_time")
    .eq("establishment_id", establishment.id)
    .eq("date", date);
  if (exceptionsError) throw exceptionsError;

  const range = dayRangeUtc(date, establishment.timezone);
  const { data: appointments, error: appointmentsError } = await supabaseAdmin
    .from("appointments")
    .select("id, starts_at, ends_at, professional_id")
    .eq("establishment_id", establishment.id)
    .in("status", ["pending", "confirmed", "completed"])
    .neq("id", appointment.id)
    .gte("starts_at", range.start)
    .lt("starts_at", range.end);
  if (appointmentsError) throw appointmentsError;

  const { data: blocks, error: blocksError } = await supabaseAdmin
    .from("blocked_slots")
    .select("starts_at, ends_at, professional_id")
    .eq("establishment_id", establishment.id)
    .gte("starts_at", range.start)
    .lt("starts_at", range.end);
  if (blocksError) throw blocksError;

  const busy = [
    ...(appointments ?? []).filter((item) => item.professional_id === appointment.professional_id),
    ...(blocks ?? []).filter((item) => item.professional_id === null || item.professional_id === appointment.professional_id),
  ].map((item) => ({ startsAt: new Date(item.starts_at), endsAt: new Date(item.ends_at) }));

  const slots = computeAvailability({
    date,
    timezone: establishment.timezone,
    serviceDurationMinutes: durationForAppointment(appointment, service),
    professionalId: appointment.professional_id,
    schedules: (schedules ?? []).map(mapSchedule),
    exceptions: (exceptions ?? []) as ScheduleExceptionInput[],
    busy,
    now,
  });
  return { slots, loaded };
}

export const findCustomerAppointments = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => lookupInput.parse(data))
  .handler(async ({ data }) => {
    const { data: establishment, error: establishmentError } = await supabaseAdmin
      .from("establishments")
      .select("id, name, slug, timezone")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (establishmentError) throw establishmentError;
    if (!establishment) throw new Error("Estabelecimento não encontrado.");

    const range = dayRangeUtc(data.date, establishment.timezone);
    const phone = normalizePhone(data.customerPhone);
    const { data: customers, error: customersError } = await supabaseAdmin
      .from("customers")
      .select("id, name, phone")
      .eq("establishment_id", establishment.id)
      .not("phone", "is", null);
    if (customersError) throw customersError;

    const matchingCustomerIds = (customers ?? [])
      .filter((customer) => normalizePhone(customer.phone ?? "") === phone)
      .map((customer) => customer.id);
    if (matchingCustomerIds.length === 0) return [];

    const { data: appointments, error: appointmentsError } = await supabaseAdmin
      .from("appointments")
      .select("id, customer_id, professional_id, service_id, custom_title, custom_price, duration_minutes_override, starts_at, ends_at, status")
      .eq("establishment_id", establishment.id)
      .in("customer_id", matchingCustomerIds)
      .gte("starts_at", range.start)
      .lt("starts_at", range.end)
      .in("status", ["pending", "confirmed"])
      .order("starts_at");
    if (appointmentsError) throw appointmentsError;

    return Promise.all((appointments ?? []).map(async (appointment) => {
      const loaded = await loadAppointmentForManagement(appointment.id);
      const expiresAtMs = new Date(loaded.appointment.ends_at).getTime() + 30 * 24 * 60 * 60 * 1000;
      const token = `${expiresAtMs}.${signManagementToken(appointment.id, loaded.customer.phone!, expiresAtMs)}`;
      return {
        id: appointment.id,
        customerName: loaded.customer.name,
        professionalName: loaded.professional?.name ?? "Profissional",
        serviceName: loaded.service?.name ?? null,
        title: loaded.appointment.custom_title ?? loaded.service?.name ?? "Atendimento",
        startsAt: loaded.appointment.starts_at,
        endsAt: loaded.appointment.ends_at,
        managementPath: `/agenda/${encodeURIComponent(data.slug)}?manage=${encodeURIComponent(appointment.id)}&token=${encodeURIComponent(token)}`,
      };
    }));
  });

export const getAppointmentManagementUrl = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => managementLinkInput.parse(data))
  .handler(async ({ data }) => {
    const loaded = await loadAppointmentForManagement(data.appointmentId);
    const customerPhone = loaded.customer.phone;
    if (!customerPhone) throw new Error("Não foi possível validar o telefone do cliente.");
    if (loaded.establishment.slug !== data.slug) throw new Error("Agendamento inválido para este estabelecimento.");
    if (normalizePhone(customerPhone) !== normalizePhone(data.customerPhone)) throw new Error("Telefone não confere com o agendamento.");
    const expiresAtMs = new Date(loaded.appointment.ends_at).getTime() + 30 * 24 * 60 * 60 * 1000;
    const token = `${expiresAtMs}.${signManagementToken(data.appointmentId, customerPhone, expiresAtMs)}`;
    return {
      path: `/agenda/${encodeURIComponent(data.slug)}?manage=${encodeURIComponent(data.appointmentId)}&token=${encodeURIComponent(token)}`,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  });

export const getManagedAppointment = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => managementTokenInput.parse(data))
  .handler(async ({ data }) => {
    const loaded = await loadAppointmentForManagement(data.appointmentId);
    const customerPhone = loaded.customer.phone;
    if (!customerPhone) throw new Error("Não foi possível validar o telefone do cliente.");
    const valid = verifyManagementToken(data.appointmentId, customerPhone, data.token);
    if (!valid) throw new Error("Link de gerenciamento inválido ou expirado.");
    const durationMinutes = durationForAppointment(loaded.appointment, loaded.service);
    return {
      id: loaded.appointment.id,
      establishmentName: loaded.establishment.name,
      timezone: loaded.establishment.timezone,
      customerName: loaded.customer.name,
      serviceName: loaded.service?.name ?? null,
      customTitle: loaded.appointment.custom_title,
      professionalName: loaded.professional?.name ?? "Profissional",
      customPrice: loaded.appointment.custom_price,
      servicePrice: loaded.service?.price ?? null,
      durationMinutes,
      startsAt: loaded.appointment.starts_at,
      endsAt: loaded.appointment.ends_at,
      status: loaded.appointment.status,
      canCancel: canCustomerChangeAppointment(loaded.appointment),
      canReschedule: canCustomerChangeAppointment(loaded.appointment),
      expiresAt: new Date(new Date(loaded.appointment.ends_at).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  });

export const getManagedRescheduleAvailability = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => rescheduleAvailabilityInput.parse(data))
  .handler(async ({ data }) => {
    const loaded = await loadAppointmentForManagement(data.appointmentId);
    const customerPhone = loaded.customer.phone;
    if (!customerPhone) throw new Error("Não foi possível validar o telefone do cliente.");
    const valid = verifyManagementToken(data.appointmentId, customerPhone, data.token);
    if (!valid) throw new Error("Link de gerenciamento inválido ou expirado.");
    const result = await getRescheduleAvailability(data.appointmentId, data.date);
    return result.slots;
  });

export const rescheduleManagedAppointment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => rescheduleInput.parse(data))
  .handler(async ({ data }) => {
    const loaded = await loadAppointmentForManagement(data.appointmentId);
    const customerPhone = loaded.customer.phone;
    if (!customerPhone) throw new Error("Não foi possível validar o telefone do cliente.");
    const valid = verifyManagementToken(data.appointmentId, customerPhone, data.token);
    if (!valid) throw new Error("Link de gerenciamento inválido ou expirado.");
    if (!canCustomerChangeAppointment(loaded.appointment)) throw new Error("Este agendamento não pode mais ser reagendado.");

    const startsAt = new Date(data.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new Error("Novo horário inválido.");
    if (startsAt.getTime() <= Date.now()) throw new Error("Escolha um horário futuro.");

    const localDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: loaded.establishment.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(startsAt);

    const { slots } = await getRescheduleAvailability(data.appointmentId, localDate);
    const slot = slots.find((candidate) => candidate.startsAt === startsAt.toISOString() && candidate.available);
    if (!slot) throw new Error("Esse novo horário não está disponível. Escolha outro.");

    const { error } = await supabaseAdmin
      .from("appointments")
      .update({ starts_at: slot.startsAt, ends_at: slot.endsAt, updated_at: new Date().toISOString() })
      .eq("id", loaded.appointment.id)
      .in("status", ["pending", "confirmed"]);
    if (error) throw error;
    return { ok: true as const, startsAt: slot.startsAt, endsAt: slot.endsAt };
  });

export const cancelManagedAppointment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => managementTokenInput.parse(data))
  .handler(async ({ data }) => {
    const loaded = await loadAppointmentForManagement(data.appointmentId);
    const customerPhone = loaded.customer.phone;
    if (!customerPhone) throw new Error("Não foi possível validar o telefone do cliente.");
    const valid = verifyManagementToken(data.appointmentId, customerPhone, data.token);
    if (!valid) throw new Error("Link de gerenciamento inválido ou expirado.");
    if (!["pending", "confirmed"].includes(loaded.appointment.status)) throw new Error("Este agendamento não pode mais ser cancelado.");
    if (new Date(loaded.appointment.starts_at).getTime() <= Date.now()) throw new Error("Não é possível cancelar um atendimento que já começou.");
    const { error } = await supabaseAdmin
      .from("appointments")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", data.appointmentId)
      .in("status", ["pending", "confirmed"]);
    if (error) throw error;
    return { ok: true as const };
  });
