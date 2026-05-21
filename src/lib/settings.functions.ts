import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getSettings = createServerFn({ method: "POST" }).handler(async () => {
  const { data, error } = await supabaseAdmin.from("settings").select("*").eq("id", 1).single();
  if (error) throw new Error(error.message);
  return data as { id: number; monthly_budget: number | null };
});

export const updateBudget = createServerFn({ method: "POST" })
  .inputValidator((d: { monthly_budget: number | null }) =>
    z.object({ monthly_budget: z.number().nonnegative().nullable() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("settings").update({ monthly_budget: data.monthly_budget }).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });