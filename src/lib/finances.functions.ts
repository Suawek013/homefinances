import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMember } from "./household.server";

export type IncomeRow = {
  id: string;
  household_id: string;
  user_id: string;
  year_month: string;
  amount: number;
  note: string;
};

export type SavingsRow = {
  id: string;
  household_id: string;
  user_id: string;
  amount: number;
  label: string;
  occurred_on: string;
  created_at: string;
};

export const listIncomes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const m = await requireMember(context.userId);
    const { data, error } = await supabaseAdmin
      .from("monthly_incomes")
      .select("*")
      .eq("household_id", m.household_id)
      .order("year_month", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as IncomeRow[];
  });

export const upsertIncome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      year_month: z.string().regex(/^\d{4}-\d{2}$/),
      amount: z.number().nonnegative(),
      note: z.string().max(200).default(""),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const m = await requireMember(context.userId);
    const { error } = await supabaseAdmin
      .from("monthly_incomes")
      .upsert(
        {
          household_id: m.household_id,
          user_id: data.user_id,
          year_month: data.year_month,
          amount: data.amount,
          note: data.note,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "household_id,user_id,year_month" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteIncome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const m = await requireMember(context.userId);
    const { error } = await supabaseAdmin
      .from("monthly_incomes")
      .delete()
      .eq("id", data.id)
      .eq("household_id", m.household_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSavings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const m = await requireMember(context.userId);
    const { data, error } = await supabaseAdmin
      .from("savings_entries")
      .select("*")
      .eq("household_id", m.household_id)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as SavingsRow[];
  });

export const addSavings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      amount: z.number().refine((n) => n !== 0, "Amount cannot be zero"),
      label: z.string().max(200).default(""),
      occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const m = await requireMember(context.userId);
    const { error } = await supabaseAdmin.from("savings_entries").insert({
      household_id: m.household_id,
      user_id: data.user_id,
      amount: data.amount,
      label: data.label,
      occurred_on: data.occurred_on,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSavings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const m = await requireMember(context.userId);
    const { error } = await supabaseAdmin
      .from("savings_entries")
      .delete()
      .eq("id", data.id)
      .eq("household_id", m.household_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkImportSavings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      rows: z.array(
        z.object({
          amount: z.number().refine((n) => n !== 0, "Amount cannot be zero"),
          label: z.string().max(200).default(""),
          occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          user_id: z.string().uuid().optional(),
        }),
      ).min(1).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const m = await requireMember(context.userId);
    const payload = data.rows.map((r) => ({
      household_id: m.household_id,
      user_id: r.user_id ?? context.userId,
      amount: r.amount,
      label: r.label,
      occurred_on: r.occurred_on,
    }));
    const { data: inserted, error } = await supabaseAdmin
      .from("savings_entries").insert(payload).select("id");
    if (error) throw new Error(error.message);
    return { count: inserted?.length ?? 0 };
  });

export type InvestmentSnapshotRow = {
  id: string;
  household_id: string;
  user_id: string;
  label: string;
  value: number;
  recorded_on: string;
  created_at: string;
};

export const listInvestmentSnapshots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const m = await requireMember(context.userId);
    const { data, error } = await supabaseAdmin
      .from("investment_snapshots")
      .select("*")
      .eq("household_id", m.household_id)
      .order("recorded_on", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as InvestmentSnapshotRow[];
  });

export const addInvestmentSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      label: z.string().max(200).default(""),
      value: z.number(),
      recorded_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const m = await requireMember(context.userId);
    const { error } = await supabaseAdmin.from("investment_snapshots").insert({
      household_id: m.household_id,
      user_id: data.user_id,
      label: data.label,
      value: data.value,
      recorded_on: data.recorded_on,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteInvestmentSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const m = await requireMember(context.userId);
    const { error } = await supabaseAdmin
      .from("investment_snapshots")
      .delete()
      .eq("id", data.id)
      .eq("household_id", m.household_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });