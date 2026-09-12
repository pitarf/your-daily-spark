import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function publicClient() {
  return createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const getPublicSchedulingSettings = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: establishment, error } = await supabase
      .from("establishments")
      .select("allow_custom_duration")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();

    if (error) throw error;

    return {
      allowCustomDuration: Boolean(establishment?.allow_custom_duration),
    };
  });
