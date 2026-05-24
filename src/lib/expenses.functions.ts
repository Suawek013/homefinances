import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMember } from "./household.server";

const CATEGORY = z.string().min(1).max(60);

export type ExpenseRow = {
  id: string;
  amount: number;
  category: string;
  spent_on: string;
  description: string;
  user_id: string;
  household_id: string;
  receipt_id: string | null;
  recurring_id: string | null;
  created_at: string;
};

export const listExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { month?: string; userId?: string }) =>
    z.object({ month: z.string().optional(), userId: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ExpenseRow[]> => {
    const m = await requireMember(context.userId);
    let q = supabaseAdmin
      .from("expenses")
      .select("*")
      .eq("household_id", m.household_id)
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (data.month) {
      const [y, m] = data.month.split("-").map(Number);
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const endDate = new Date(y, m, 1);
      const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-01`;
      q = q.gte("spent_on", start).lt("spent_on", end);
    }
    if (data.userId) q = q.eq("user_id", data.userId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ExpenseRow[];
  });

export const createExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      amount: z.number().nonnegative(),
      category: CATEGORY,
      spent_on: z.string(),
      description: z.string().default(""),
      receipt_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const m = await requireMember(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("expenses")
      .insert({
        amount: data.amount,
        category: data.category,
        spent_on: data.spent_on,
        description: data.description,
        user_id: context.userId,
        household_id: m.household_id,
        receipt_id: data.receipt_id ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as ExpenseRow;
  });

export const getExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const m = await requireMember(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("expenses")
      .select("*")
      .eq("id", data.id)
      .eq("household_id", m.household_id)
      .single();
    if (error) throw new Error(error.message);
    return row as ExpenseRow;
  });

export const updateExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      amount: z.number().nonnegative(),
      category: CATEGORY,
      spent_on: z.string(),
      description: z.string().default(""),
      receipt_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const m = await requireMember(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("expenses")
      .update({
        amount: data.amount,
        category: data.category,
        spent_on: data.spent_on,
        description: data.description,
        receipt_id: data.receipt_id ?? null,
      })
      .eq("id", data.id)
      .eq("household_id", m.household_id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as ExpenseRow;
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const m = await requireMember(context.userId);
    const { error } = await supabaseAdmin
      .from("expenses").delete().eq("id", data.id).eq("household_id", m.household_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMonthlyStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { month: string }) => z.object({ month: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const member = await requireMember(context.userId);
    const [y, m] = data.month.split("-").map(Number);
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const endDate = new Date(y, m, 1);
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-01`;
    const { data: rows, error } = await supabaseAdmin
      .from("expenses")
      .select("amount, category, user_id")
      .eq("household_id", member.household_id)
      .gte("spent_on", start)
      .lt("spent_on", end);
    if (error) throw new Error(error.message);

    let total = 0;
    const byCategory: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    const byCategoryUser: Record<string, Record<string, number>> = {};
    for (const r of rows ?? []) {
      const amt = Number(r.amount);
      total += amt;
      byUser[r.user_id] = (byUser[r.user_id] ?? 0) + amt;
      byCategory[r.category] = (byCategory[r.category] ?? 0) + amt;
      const cp = byCategoryUser[r.category] ?? {};
      cp[r.user_id] = (cp[r.user_id] ?? 0) + amt;
      byCategoryUser[r.category] = cp;
    }
    return { total, byUser, byCategory, byCategoryUser, count: rows?.length ?? 0 };
  });