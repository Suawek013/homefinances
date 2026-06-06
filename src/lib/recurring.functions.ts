import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMember } from "./household.server";

const CATEGORY = z.string().min(1).max(60);

export type RecurringRow = {
  id: string;
  name: string;
  amount: number;
  day_of_month: number;
  category: string;
  user_id: string;
  household_id: string;
  active: boolean;
  created_at: string;
};

export const listRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const m = await requireMember(context.userId);
    const { data, error } = await supabaseAdmin
      .from("recurring_expenses")
      .select("*")
      .eq("household_id", m.household_id)
      .order("day_of_month", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as RecurringRow[];
  });

export const upsertRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1),
      amount: z.number().nonnegative(),
      day_of_month: z.number().int().min(1).max(31),
      category: CATEGORY,
      active: z.boolean().default(true),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const m = await requireMember(context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("recurring_expenses")
        .update({
          name: data.name, amount: data.amount, day_of_month: data.day_of_month,
          category: data.category, active: data.active,
        })
        .eq("id", data.id)
        .eq("household_id", m.household_id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("recurring_expenses").insert({
        name: data.name, amount: data.amount, day_of_month: data.day_of_month,
        category: data.category, active: data.active,
        user_id: context.userId, household_id: m.household_id,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const m = await requireMember(context.userId);
    const { error } = await supabaseAdmin
      .from("recurring_expenses").delete()
      .eq("id", data.id).eq("household_id", m.household_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getRecurringStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { month: string }) => z.object({ month: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const m = await requireMember(context.userId);
    const { data: rec, error } = await supabaseAdmin
      .from("recurring_expenses").select("*")
      .eq("household_id", m.household_id).eq("active", true)
      .order("day_of_month", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: inst, error: e2 } = await supabaseAdmin
      .from("recurring_instances").select("recurring_id, expense_id, year_month")
      .eq("household_id", m.household_id)
      .eq("year_month", data.month);
    if (e2) throw new Error(e2.message);

    const paidMap = new Map((inst ?? []).map((i) => [i.recurring_id, i.expense_id]));
    return (rec ?? []).map((r) => ({
      ...r,
      paid: paidMap.has(r.id),
      expense_id: paidMap.get(r.id) ?? null,
    })) as (RecurringRow & { paid: boolean; expense_id: string | null })[];
  });

export const materializeRecurringForMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { month: string }) => z.object({ month: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const member = await requireMember(context.userId);
    const [y, mm] = data.month.split("-").map(Number);

    const { data: rec, error } = await supabaseAdmin
      .from("recurring_expenses").select("*")
      .eq("household_id", member.household_id).eq("active", true);
    if (error) throw new Error(error.message);

    const { data: inst, error: e2 } = await supabaseAdmin
      .from("recurring_instances").select("recurring_id")
      .eq("household_id", member.household_id)
      .eq("year_month", data.month);
    if (e2) throw new Error(e2.message);
    const done = new Set((inst ?? []).map((i) => i.recurring_id));

    const lastDay = new Date(y, mm, 0).getDate();
    let created = 0;
    for (const r of rec ?? []) {
      if (done.has(r.id)) continue;
      const day = Math.min(r.day_of_month, lastDay);
      const spent_on = `${y}-${String(mm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const { data: exp, error: e3 } = await supabaseAdmin.from("expenses").insert({
        amount: r.amount, category: r.category, spent_on,
        description: r.name, user_id: r.user_id, household_id: member.household_id,
        recurring_id: r.id,
      }).select("id").single();
      if (e3) throw new Error(e3.message);
      const { error: e4 } = await supabaseAdmin.from("recurring_instances").insert({
        recurring_id: r.id, year_month: data.month, expense_id: exp!.id,
        household_id: member.household_id,
      });
      if (e4) throw new Error(e4.message);
      created++;
    }
    return { created };
  });

export const payRecurringForMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), month: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const member = await requireMember(context.userId);
    const [y, mm] = data.month.split("-").map(Number);

    const { data: r, error } = await supabaseAdmin
      .from("recurring_expenses").select("*")
      .eq("id", data.id).eq("household_id", member.household_id).single();
    if (error) throw new Error(error.message);

    const { data: existing } = await supabaseAdmin
      .from("recurring_instances").select("expense_id")
      .eq("household_id", member.household_id)
      .eq("year_month", data.month)
      .eq("recurring_id", data.id)
      .maybeSingle();
    if (existing) return { ok: true, expense_id: existing.expense_id };

    const lastDay = new Date(y, mm, 0).getDate();
    const day = Math.min(r.day_of_month, lastDay);
    const spent_on = `${y}-${String(mm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const { data: exp, error: e3 } = await supabaseAdmin.from("expenses").insert({
      amount: r.amount, category: r.category, spent_on,
      description: r.name, user_id: r.user_id, household_id: member.household_id,
      recurring_id: r.id,
    }).select("id").single();
    if (e3) throw new Error(e3.message);
    const { error: e4 } = await supabaseAdmin.from("recurring_instances").insert({
      recurring_id: r.id, year_month: data.month, expense_id: exp!.id,
      household_id: member.household_id,
    });
    if (e4) throw new Error(e4.message);
    return { ok: true, expense_id: exp!.id };
  });