import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const getEstablishmentBusinessType = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ slug: z.string().trim().min(1).max(160) }).parse(data))
  .handler(async ({ data }): Promise<string | null> => {
    const supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { data: establishment, error } = await supabase
      .from("establishments")
      .select("business_type")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();

    if (error) throw error;
    return establishment?.business_type ?? null;
  });
