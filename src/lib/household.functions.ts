import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getMemberByUserId, generateInviteCode } from "./household.server";

const COLOR_DEFAULTS = [
  "oklch(0.55 0.11 200)", // teal
  "oklch(0.65 0.18 30)", // coral
  "oklch(0.65 0.18 290)", // violet
  "oklch(0.7 0.15 130)", // green
];

export type Me = {
  user: { id: string; email: string | null; name: string | null; avatar: string | null };
  household: { id: string; name: string; created_at: string } | null;
  members: { user_id: string; display_name: string; color: string }[];
  currentMember: { user_id: string; household_id: string; display_name: string; color: string } | null;
};

export const getMyContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Me> => {
    const { userId, claims } = context;
    const meta = (claims as { email?: string; user_metadata?: { full_name?: string; avatar_url?: string; name?: string; picture?: string } }) ?? {};
    const user = {
      id: userId,
      email: meta.email ?? null,
      name: meta.user_metadata?.full_name ?? meta.user_metadata?.name ?? meta.email ?? null,
      avatar: meta.user_metadata?.avatar_url ?? meta.user_metadata?.picture ?? null,
    };
    const member = await getMemberByUserId(userId);
    if (!member) {
      return { user, household: null, members: [], currentMember: null };
    }
    const [{ data: household }, { data: members }] = await Promise.all([
      supabaseAdmin.from("households").select("id, name, created_at").eq("id", member.household_id).single(),
      supabaseAdmin
        .from("household_members")
        .select("user_id, display_name, color")
        .eq("household_id", member.household_id),
    ]);
    return {
      user,
      household: household ?? null,
      members: (members ?? []) as Me["members"],
      currentMember: member,
    };
  });

export const createHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().min(1).max(80).default("My household"),
      display_name: z.string().min(1).max(40),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const existing = await getMemberByUserId(userId);
    if (existing) throw new Error("Already in a household");

    const { data: hh, error } = await supabaseAdmin
      .from("households")
      .insert({ name: data.name, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: e2 } = await supabaseAdmin.from("household_members").insert({
      user_id: userId,
      household_id: hh.id,
      display_name: data.display_name,
      color: COLOR_DEFAULTS[0],
    });
    if (e2) throw new Error(e2.message);
    return { household_id: hh.id };
  });

export const previewInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => z.object({ code: z.string().min(4).max(16) }).parse(d))
  .handler(async ({ data }) => {
    const { data: inv } = await supabaseAdmin
      .from("household_invites")
      .select("code, household_id, expires_at, used_at")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();
    if (!inv) return { valid: false as const, reason: "not_found" as const };
    if (inv.used_at) return { valid: false as const, reason: "used" as const };
    if (new Date(inv.expires_at).getTime() < Date.now())
      return { valid: false as const, reason: "expired" as const };
    const { data: hh } = await supabaseAdmin
      .from("households").select("name").eq("id", inv.household_id).single();
    return { valid: true as const, household_name: hh?.name ?? "" };
  });

export const joinByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      code: z.string().min(4).max(16),
      display_name: z.string().min(1).max(40),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const existing = await getMemberByUserId(userId);
    if (existing) throw new Error("Already in a household");

    const code = data.code.toUpperCase();
    const { data: inv } = await supabaseAdmin
      .from("household_invites").select("*").eq("code", code).maybeSingle();
    if (!inv) throw new Error("Invite code not found");
    if (inv.used_at) throw new Error("This invite has already been used");
    if (new Date(inv.expires_at).getTime() < Date.now()) throw new Error("This invite has expired");

    // Pick a color different from existing members
    const { data: existingMembers } = await supabaseAdmin
      .from("household_members").select("color").eq("household_id", inv.household_id);
    const usedColors = new Set((existingMembers ?? []).map((m) => m.color));
    const color = COLOR_DEFAULTS.find((c) => !usedColors.has(c)) ?? COLOR_DEFAULTS[1];

    const { error } = await supabaseAdmin.from("household_members").insert({
      user_id: userId,
      household_id: inv.household_id,
      display_name: data.display_name,
      color,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("household_invites")
      .update({ used_at: new Date().toISOString(), used_by: userId })
      .eq("code", code);

    return { household_id: inv.household_id };
  });

export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const member = await getMemberByUserId(userId);
    if (!member) throw new Error("NO_HOUSEHOLD");

    // Try a few times in case of code collision
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateInviteCode();
      const { data, error } = await supabaseAdmin
        .from("household_invites")
        .insert({
          code,
          household_id: member.household_id,
          created_by: userId,
        })
        .select("*")
        .single();
      if (!error) return data;
      if (!String(error.message).toLowerCase().includes("duplicate")) {
        throw new Error(error.message);
      }
    }
    throw new Error("Could not generate a unique invite code");
  });

export const listInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const member = await getMemberByUserId(userId);
    if (!member) return [];
    const { data, error } = await supabaseAdmin
      .from("household_invites")
      .select("*")
      .eq("household_id", member.household_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => z.object({ code: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const member = await getMemberByUserId(userId);
    if (!member) throw new Error("NO_HOUSEHOLD");
    const { error } = await supabaseAdmin
      .from("household_invites")
      .delete()
      .eq("code", data.code)
      .eq("household_id", member.household_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMyMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      display_name: z.string().min(1).max(40).optional(),
      color: z.string().max(60).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const patch: { display_name?: string; color?: string } = {};
    if (data.display_name !== undefined) patch.display_name = data.display_name;
    if (data.color !== undefined) patch.color = data.color;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("household_members").update(patch).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const leaveHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("household_members").delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
