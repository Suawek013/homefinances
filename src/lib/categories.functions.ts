import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMember } from "./household.server";

export type CustomCategoryRow = {
  id: string;
  household_id: string;
  label: string;
  color: string;
  icon: string;
  created_at: string;
};

export const listCustomCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const m = await requireMember(context.userId);
    const { data, error } = await supabaseAdmin
      .from("custom_categories")
      .select("*")
      .eq("household_id", m.household_id)
      .order("label", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as CustomCategoryRow[];
  });

export const createCustomCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      label: z.string().min(1).max(40),
      color: z.string().min(1).max(80).default("oklch(0.6 0.03 200)"),
      icon: z.string().min(1).max(40).default("Package"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const m = await requireMember(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("custom_categories")
      .insert({
        household_id: m.household_id,
        label: data.label.trim(),
        color: data.color,
        icon: data.icon,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as CustomCategoryRow;
  });

export const deleteCustomCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const m = await requireMember(context.userId);
    const { error } = await supabaseAdmin
      .from("custom_categories")
      .delete()
      .eq("id", data.id)
      .eq("household_id", m.household_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });