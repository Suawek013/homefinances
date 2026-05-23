import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CATEGORY = z.enum([
  "food","utilities","rent","fuel","hobbies","gaming",
  "clothing","health","restaurants","subscriptions","other",
]);

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

export type CategoryBudget = { category: string; amount: number };

export const listCategoryBudgets = createServerFn({ method: "POST" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("category_budgets")
    .select("category, amount");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ category: r.category, amount: Number(r.amount) })) as CategoryBudget[];
});

export const setCategoryBudget = createServerFn({ method: "POST" })
  .inputValidator((d: { category: string; amount: number | null }) =>
    z.object({ category: CATEGORY, amount: z.number().nonnegative().nullable() }).parse(d),
  )
  .handler(async ({ data }) => {
    if (data.amount == null) {
      const { error } = await supabaseAdmin
        .from("category_budgets").delete().eq("category", data.category);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await supabaseAdmin
      .from("category_budgets")
      .upsert({ category: data.category, amount: data.amount, updated_at: new Date().toISOString() }, { onConflict: "category" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });