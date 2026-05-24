import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMember } from "./household.server";

const CATEGORY = z.string().min(1).max(60);

export const getSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const m = await requireMember(context.userId);
    const { data } = await supabaseAdmin
      .from("household_settings").select("monthly_budget")
      .eq("household_id", m.household_id).maybeSingle();
    return { monthly_budget: (data?.monthly_budget ?? null) as number | null };
  });

export const updateBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { monthly_budget: number | null }) =>
    z.object({ monthly_budget: z.number().nonnegative().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const m = await requireMember(context.userId);
    const { error } = await supabaseAdmin
      .from("household_settings")
      .upsert(
        { household_id: m.household_id, monthly_budget: data.monthly_budget, updated_at: new Date().toISOString() },
        { onConflict: "household_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type CategoryBudget = { category: string; amount: number };

export const listCategoryBudgets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const m = await requireMember(context.userId);
    const { data, error } = await supabaseAdmin
      .from("category_budgets")
      .select("category, amount")
      .eq("household_id", m.household_id);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({ category: r.category, amount: Number(r.amount) })) as CategoryBudget[];
  });

export const setCategoryBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { category: string; amount: number | null }) =>
    z.object({ category: CATEGORY, amount: z.number().nonnegative().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const m = await requireMember(context.userId);
    if (data.amount == null) {
      const { error } = await supabaseAdmin
        .from("category_budgets").delete()
        .eq("household_id", m.household_id).eq("category", data.category);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await supabaseAdmin
      .from("category_budgets")
      .upsert(
        { household_id: m.household_id, category: data.category, amount: data.amount, updated_at: new Date().toISOString() },
        { onConflict: "household_id,category" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });