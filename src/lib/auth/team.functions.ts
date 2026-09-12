import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const teamInput = z.object({
  establishmentId: z.string().uuid(),
  accessToken: z.string().min(1),
});

async function requireAdmin(establishmentId: string, accessToken: string) {
  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (userError || !user) throw new Error("Sua sessão expirou. Entre novamente.");

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("establishment_users")
    .select("role")
    .eq("establishment_id", establishmentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (membership?.role !== "admin") {
    throw new Error("Somente administradores podem gerenciar a equipe.");
  }

  return user;
}

export const inviteProfessional = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    teamInput.extend({
      professionalId: z.string().uuid(),
      email: z.string().email(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.establishmentId, data.accessToken);

    const { data: professional, error: professionalError } = await supabaseAdmin
      .from("professionals")
      .select("id, user_id")
      .eq("id", data.professionalId)
      .eq("establishment_id", data.establishmentId)
      .maybeSingle();

    if (professionalError) throw professionalError;
    if (!professional) throw new Error("Profissional não encontrado neste estabelecimento.");
    if (professional.user_id) throw new Error("Este profissional já está vinculado a uma conta.");

    const email = data.email.trim().toLowerCase();
    let userId: string;

    const existingUser = await supabaseAdmin.auth.admin.getUserByEmail(email);
    if (existingUser.error && existingUser.error.status !== 404) {
      throw existingUser.error;
    }

    if (existingUser.data?.user) {
      userId = existingUser.data.user.id;
      const { data: currentMembership, error: membershipError } = await supabaseAdmin
        .from("establishment_users")
        .select("role")
        .eq("establishment_id", data.establishmentId)
        .eq("user_id", userId)
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (currentMembership?.role === "admin" || currentMembership?.role === "staff") {
        throw new Error("Este e-mail já pertence a um usuário administrativo deste estabelecimento.");
      }
    } else {
      const { data: invitation, error: invitationError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
      if (invitationError || !invitation.user) {
        throw invitationError ?? new Error("Não foi possível enviar o convite.");
      }
      userId = invitation.user.id;
    }

    const { error: membershipError } = await supabaseAdmin
      .from("establishment_users")
      .upsert(
        { establishment_id: data.establishmentId, user_id: userId, role: "professional" },
        { onConflict: "establishment_id,user_id" },
      );
    if (membershipError) throw membershipError;

    const { error: updateError } = await supabaseAdmin
      .from("professionals")
      .update({ user_id: userId })
      .eq("id", data.professionalId)
      .eq("establishment_id", data.establishmentId);
    if (updateError) throw updateError;

    return {
      ok: true as const,
      invited: !existingUser.data?.user,
      message: existingUser.data?.user ? "Conta existente vinculada ao profissional." : "Convite enviado por e-mail.",
    };
  });

export const unlinkProfessional = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => teamInput.extend({ professionalId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await requireAdmin(data.establishmentId, data.accessToken);

    const { data: professional, error: professionalError } = await supabaseAdmin
      .from("professionals")
      .select("id, user_id")
      .eq("id", data.professionalId)
      .eq("establishment_id", data.establishmentId)
      .maybeSingle();

    if (professionalError) throw professionalError;
    if (!professional) throw new Error("Profissional não encontrado neste estabelecimento.");
    if (!professional.user_id) throw new Error("Este profissional não possui uma conta vinculada.");

    const userId = professional.user_id;
    const { error: deleteMembershipError } = await supabaseAdmin
      .from("establishment_users")
      .delete()
      .eq("establishment_id", data.establishmentId)
      .eq("user_id", userId)
      .eq("role", "professional");
    if (deleteMembershipError) throw deleteMembershipError;

    const { error: updateError } = await supabaseAdmin
      .from("professionals")
      .update({ user_id: null })
      .eq("id", data.professionalId)
      .eq("establishment_id", data.establishmentId);
    if (updateError) throw updateError;

    return { ok: true as const };
  });