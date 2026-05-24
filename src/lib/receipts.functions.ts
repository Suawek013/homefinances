import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMember } from "./household.server";
import { createLovableAiGatewayProvider } from "./ai-gateway";

export type ReceiptRow = {
  id: string;
  storage_path: string;
  extracted_total: number | null;
  raw_ocr_text: string | null;
  user_id: string;
  household_id: string;
  created_at: string;
  public_url: string;
};

async function signedUrl(path: string): Promise<string> {
  const { data } = await supabaseAdmin.storage
    .from("receipts")
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? "";
}

export const listReceipts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const m = await requireMember(context.userId);
    const { data, error } = await supabaseAdmin
      .from("receipts").select("*")
      .eq("household_id", m.household_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = await Promise.all(
      (data ?? []).map(async (r) => ({ ...r, public_url: await signedUrl(r.storage_path) })),
    );
    return rows as ReceiptRow[];
  });

// Upload receipt: takes base64 image, stores it, runs OCR via Lovable AI, returns extracted total.
export const uploadAndParseReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      base64: z.string().min(20),
      mimeType: z.string().default("image/jpeg"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const m = await requireMember(context.userId);
    const ext = data.mimeType.includes("png") ? "png" : "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const { error: upErr } = await supabaseAdmin.storage
      .from("receipts")
      .upload(path, bytes, { contentType: data.mimeType, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    let extracted_total: number | null = null;
    let merchant: string | null = null;
    let date: string | null = null;
    let raw = "";
    try {
      const gateway = createLovableAiGatewayProvider(key);
      const model = gateway("google/gemini-2.5-flash");
      const { output, text } = await generateText({
        model,
        output: Output.object({
          schema: z.object({
            total: z.number().nullable(),
            currency: z.string().nullable().optional(),
            merchant: z.string().nullable().optional(),
            date: z.string().nullable().optional(),
          }),
        }),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract the receipt grand TOTAL (final amount paid), merchant name, and date (YYYY-MM-DD) from this receipt image. Return numbers only for total. If unsure, set to null.",
              },
              { type: "image", image: `data:${data.mimeType};base64,${data.base64}` },
            ],
          },
        ],
      });
      extracted_total = output?.total ?? null;
      merchant = output?.merchant ?? null;
      date = output?.date ?? null;
      raw = text ?? "";
    } catch (err) {
      console.error("OCR failed:", err);
      raw = String(err);
    }

    const { data: row, error } = await supabaseAdmin.from("receipts").insert({
      storage_path: path,
      extracted_total,
      raw_ocr_text: raw.slice(0, 4000),
      user_id: context.userId,
      household_id: m.household_id,
    }).select("*").single();
    if (error) throw new Error(error.message);

    return {
      receipt: { ...row, public_url: publicUrl(row.storage_path) } as ReceiptRow,
      extracted_total,
      merchant,
      date,
    };
  });

export const deleteReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const m = await requireMember(context.userId);
    const { data: r } = await supabaseAdmin
      .from("receipts").select("storage_path")
      .eq("id", data.id).eq("household_id", m.household_id).single();
    if (r?.storage_path) {
      await supabaseAdmin.storage.from("receipts").remove([r.storage_path]);
    }
    const { error } = await supabaseAdmin
      .from("receipts").delete().eq("id", data.id).eq("household_id", m.household_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });