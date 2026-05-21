import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CATEGORY = z.enum([
  "food","utilities","rent","fuel","hobbies","gaming",
  "clothing","health","restaurants","subscriptions","other",
]);
const PERSON = z.enum(["slawek", "natalia"]);

export type ExpenseRow = {
  id: string;
  amount: number;
  category: string;
  spent_on: string;
  description: string;
  person_id: "slawek" | "natalia";
  receipt_id: string | null;
  recurring_id: string | null;
  created_at: string;
};

export const listExpenses = createServerFn({ method: "POST" })
  .inputValidator((d: { month?: string; personId?: "slawek" | "natalia" }) =>
    z.object({ month: z.string().optional(), personId: PERSON.optional() }).parse(d),
  )
  .handler(async ({ data }): Promise<ExpenseRow[]> => {
    let q = supabaseAdmin
      .from("expenses")
      .select("*")
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (data.month) {
      const [y, m] = data.month.split("-").map(Number);
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const endDate = new Date(y, m, 1);
      const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-01`;
      q = q.gte("spent_on", start).lt("spent_on", end);
    }
    if (data.personId) q = q.eq("person_id", data.personId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ExpenseRow[];
  });

export const createExpense = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      amount: z.number().nonnegative(),
      category: CATEGORY,
      spent_on: z.string(),
      description: z.string().default(""),
      person_id: PERSON,
      receipt_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("expenses")
      .insert({
        amount: data.amount,
        category: data.category,
        spent_on: data.spent_on,
        description: data.description,
        person_id: data.person_id,
        receipt_id: data.receipt_id ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as ExpenseRow;
  });

export const getExpense = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("expenses")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row as ExpenseRow;
  });

export const updateExpense = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      amount: z.number().nonnegative(),
      category: CATEGORY,
      spent_on: z.string(),
      description: z.string().default(""),
      person_id: PERSON,
      receipt_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("expenses")
      .update({
        amount: data.amount,
        category: data.category,
        spent_on: data.spent_on,
        description: data.description,
        person_id: data.person_id,
        receipt_id: data.receipt_id ?? null,
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as ExpenseRow;
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMonthlyStats = createServerFn({ method: "POST" })
  .inputValidator((d: { month: string }) => z.object({ month: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const [y, m] = data.month.split("-").map(Number);
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const endDate = new Date(y, m, 1);
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-01`;
    const { data: rows, error } = await supabaseAdmin
      .from("expenses")
      .select("amount, category, person_id")
      .gte("spent_on", start)
      .lt("spent_on", end);
    if (error) throw new Error(error.message);

    let total = 0;
    let slawek = 0;
    let natalia = 0;
    const byCategory: Record<string, number> = {};
    const byCategoryPerson: Record<string, { slawek: number; natalia: number }> = {};
    for (const r of rows ?? []) {
      const amt = Number(r.amount);
      total += amt;
      if (r.person_id === "slawek") slawek += amt;
      else natalia += amt;
      byCategory[r.category] = (byCategory[r.category] ?? 0) + amt;
      const cp = byCategoryPerson[r.category] ?? { slawek: 0, natalia: 0 };
      if (r.person_id === "slawek") cp.slawek += amt;
      else cp.natalia += amt;
      byCategoryPerson[r.category] = cp;
    }
    return { total, slawek, natalia, byCategory, byCategoryPerson, count: rows?.length ?? 0 };
  });