import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CATEGORY = z.enum([
  "food","utilities","rent","fuel","hobbies","gaming",
  "clothing","health","restaurants","subscriptions","other",
]);
const PERSON = z.enum(["slawek", "natalia"]);

export type RecurringRow = {
  id: string;
  name: string;
  amount: number;
  day_of_month: number;
  category: string;
  person_id: "slawek" | "natalia";
  active: boolean;
  created_at: string;
};

export const listRecurring = createServerFn({ method: "POST" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("recurring_expenses")
    .select("*")
    .order("day_of_month", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as RecurringRow[];
});

export const upsertRecurring = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1),
      amount: z.number().nonnegative(),
      day_of_month: z.number().int().min(1).max(31),
      category: CATEGORY,
      person_id: PERSON,
      active: z.boolean().default(true),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("recurring_expenses")
        .update({
          name: data.name, amount: data.amount, day_of_month: data.day_of_month,
          category: data.category, person_id: data.person_id, active: data.active,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("recurring_expenses").insert({
        name: data.name, amount: data.amount, day_of_month: data.day_of_month,
        category: data.category, person_id: data.person_id, active: data.active,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteRecurring = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("recurring_expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Returns recurring bills with their status for the given month
export const getRecurringStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { month: string }) => z.object({ month: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { data: rec, error } = await supabaseAdmin
      .from("recurring_expenses").select("*").eq("active", true)
      .order("day_of_month", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: inst, error: e2 } = await supabaseAdmin
      .from("recurring_instances").select("recurring_id, expense_id, year_month")
      .eq("year_month", data.month);
    if (e2) throw new Error(e2.message);

    const paidMap = new Map((inst ?? []).map((i) => [i.recurring_id, i.expense_id]));
    return (rec ?? []).map((r) => ({
      ...r,
      paid: paidMap.has(r.id),
      expense_id: paidMap.get(r.id) ?? null,
    })) as (RecurringRow & { paid: boolean; expense_id: string | null })[];
  });

// Materialize: create expense rows for a given month for active recurring bills
// not yet logged for that month. Idempotent.
export const materializeRecurringForMonth = createServerFn({ method: "POST" })
  .inputValidator((d: { month: string }) => z.object({ month: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const [y, m] = data.month.split("-").map(Number);

    const { data: rec, error } = await supabaseAdmin
      .from("recurring_expenses").select("*").eq("active", true);
    if (error) throw new Error(error.message);

    const { data: inst, error: e2 } = await supabaseAdmin
      .from("recurring_instances").select("recurring_id").eq("year_month", data.month);
    if (e2) throw new Error(e2.message);
    const done = new Set((inst ?? []).map((i) => i.recurring_id));

    const lastDay = new Date(y, m, 0).getDate();
    let created = 0;
    for (const r of rec ?? []) {
      if (done.has(r.id)) continue;
      const day = Math.min(r.day_of_month, lastDay);
      const spent_on = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const { data: exp, error: e3 } = await supabaseAdmin.from("expenses").insert({
        amount: r.amount, category: r.category, spent_on,
        description: r.name, person_id: r.person_id, recurring_id: r.id,
      }).select("id").single();
      if (e3) throw new Error(e3.message);
      const { error: e4 } = await supabaseAdmin.from("recurring_instances").insert({
        recurring_id: r.id, year_month: data.month, expense_id: exp!.id,
      });
      if (e4) throw new Error(e4.message);
      created++;
    }
    return { created };
  });