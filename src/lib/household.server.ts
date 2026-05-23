import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type MemberRow = {
  user_id: string;
  household_id: string;
  display_name: string;
  color: string;
};

export async function getMemberByUserId(userId: string): Promise<MemberRow | null> {
  const { data, error } = await supabaseAdmin
    .from("household_members")
    .select("user_id, household_id, display_name, color")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MemberRow | null) ?? null;
}

export async function requireMember(userId: string): Promise<MemberRow> {
  const m = await getMemberByUserId(userId);
  if (!m) throw new Error("NO_HOUSEHOLD");
  return m;
}

export function generateInviteCode(): string {
  // Short, friendly, URL-safe (avoid ambiguous chars)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}
