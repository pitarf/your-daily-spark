import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dayRangeUtc } from "@/lib/scheduling/format";

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

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function getSecret() {
  const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for appointment management tokens.");
  return secret;
}

async function signToken(appointmentId: string, customerPhone: string, expiresAtMs: number) {
  const { createHmac } = await import("node:crypto");
  const payload = `${appointmentId}:${expiresAtMs}:${normalizePhone(customerPhone)}`;
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

async function verifyToken(appointmentId: string, customerPhone: string, token: string) {
  const [expiryRaw, signature] = token.split(".");
  const expiresAtMs = Number(expiryRaw);
  if (!Number.isSafeInteger(expiresAtMs) || !signature || expiresAtMs <= Date.now()) return false;
  return signature === await signToken(appointmentId, customerPhone, expiresAtMs);
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
    supabaseAdmin.from("establishments").select("name, slug, timezone").eq("id", appointment.establishment_id).maybeSingle(),
  ]);

  if (customerError) throw customerError;
  if (professionalError) throw professionalError;
  if (serviceError) throw serviceError;
  if (establishmentError) throw establishmentError;
  if (!customer?.phone || !establishment) throw new Error("Não foi possível validar o agendamento.");

  return { appointment, customer, professional, service, establishment };
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
      const token = `${expiresAtMs}.${await signToken(appointment.id, loaded.customer.phone!, expiresAtMs)}`;
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
    if (loaded.establishment.slug !== data.slug) throw new Error("Agendamento inválido para este estabelecimento.");
    if (normalizePhone(loaded.customer.phone) !== normalizePhone(data.customerPhone)) throw new Error("Telefone não confere com o agendamento.");

    const expiresAtMs = new Date(loaded.appointment.ends_at).getTime() + 30 * 24 * 60 * 60 * 1000;
    const token = `${expiresAtMs}.${await signToken(data.appointmentId, loaded.customer.phone, expiresAtMs)}`;

    return {
      path: `/agenda/${encodeURIComponent(data.slug)}?manage=${encodeURIComponent(data.appointmentId)}&token=${encodeURIComponent(token)}`,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  });

export const getManagedAppointment = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => managementTokenInput.parse(data))
  .handler(async ({ data }) => {
    const loaded = await loadAppointmentForManagement(data.appointmentId);
    const valid = await verifyToken(data.appointmentId, loaded.customer.phone!, data.token);
    if (!valid) throw new Error("Link de gerenciamento inválido ou expirado.");

    const durationMinutes = loaded.appointment.duration_minutes_override
      ?? loaded.service?.duration_minutes
      ?? Math.max(15, Math.round((new Date(loaded.appointment.ends_at).getTime() - new Date(loaded.appointment.starts_at).getTime()) / 60000));

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
      canCancel: ["pending", "confirmed"].includes(loaded.appointment.status)
        && new Date(loaded.appointment.starts_at).getTime() > Date.now(),
      expiresAt: new Date(new Date(loaded.appointment.ends_at).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  });

export const cancelManagedAppointment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => managementTokenInput.parse(data))
  .handler(async ({ data }) => {
    const loaded = await loadAppointmentForManagement(data.appointmentId);
    const valid = await verifyToken(data.appointmentId, loaded.customer.phone!, data.token);
    if (!valid) throw new Error("Link de gerenciamento inválido ou expirado.");

    if (!["pending", "confirmed"].includes(loaded.appointment.status)) {
      throw new Error("Este agendamento não pode mais ser cancelado.");
    }
    if (new Date(loaded.appointment.starts_at).getTime() <= Date.now()) {
      throw new Error("Não é possível cancelar um atendimento que já começou.");
    }

    const { error } = await supabaseAdmin
      .from("appointments")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", data.appointmentId)
      .in("status", ["pending", "confirmed"]);

    if (error) throw error;
    return { ok: true as const };
  });
