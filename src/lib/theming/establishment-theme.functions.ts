import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const publicClientOptions = {
  auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
};

function getPublicClient() {
  return createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    publicClientOptions,
  );
}

const slugSchema = z.object({ slug: z.string().trim().min(1).max(160) });

export const getEstablishmentBusinessType = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => slugSchema.parse(data))
  .handler(async ({ data }): Promise<string | null> => {
    const supabase = getPublicClient();
    const { data: establishment, error } = await supabase
      .from("establishments")
      .select("business_type")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();

    if (error) throw error;
    return establishment?.business_type ?? null;
  });

export type EstablishmentThemeConfig = {
  businessType: string | null;
  themePreset: string | null;
  logoUrl: string | null;
  whatsapp: string | null;
  phone: string | null;
};

export const getEstablishmentThemeConfig = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => slugSchema.parse(data))
  .handler(async ({ data }): Promise<EstablishmentThemeConfig> => {
    const supabase = getPublicClient();
    const { data: establishment, error } = await supabase
      .from("establishments")
      .select("business_type, theme_preset, logo_url, whatsapp, phone")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();

    if (error) throw error;
    return {
      businessType: establishment?.business_type ?? null,
      themePreset: establishment?.theme_preset ?? "auto",
      logoUrl: establishment?.logo_url ?? null,
      whatsapp: establishment?.whatsapp ?? null,
      phone: establishment?.phone ?? null,
    };
  });
