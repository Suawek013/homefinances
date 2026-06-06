import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createExpense, bulkImportExpenses } from "@/lib/expenses.functions";
import { uploadAndParseReceipt } from "@/lib/receipts.functions";
import { getMyContext } from "@/lib/household.functions";
import { useAllCategories } from "@/lib/use-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/add")({
  component: AddPage,
});

function AddPage() {
  const t = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const cats = useAllCategories();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("food");
  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      createExpense({
        data: {
          amount: Number(amount),
          category,
          spent_on: spentOn,
          description,
          receipt_id: receiptId,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success(t("add.title"));
      navigate({ to: "/" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(file: File) {
    setScanning(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const base64 = btoa(bin);
      const res = await uploadAndParseReceipt({
        data: { base64, mimeType: file.type || "image/jpeg" },
      });
      setReceiptId(res.receipt.id);
      if (res.extracted_total) setAmount(String(res.extracted_total));
      if (res.merchant) setDescription(res.merchant);
      if (res.date) setSpentOn(res.date);
      toast.success("OK");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function onCsv(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) throw new Error(t("csv.empty"));
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const idx = {
        amount: header.indexOf("amount"),
        category: header.indexOf("category"),
        date: header.indexOf("date"),
        note: header.indexOf("note"),
      };
      if (idx.amount < 0 || idx.category < 0 || idx.date < 0) {
        throw new Error(t("csv.help"));
      }
      const labelToId = new Map<string, string>();
      for (const c of cats.list) labelToId.set(c.label.toLowerCase(), c.id);
      for (const c of cats.list) labelToId.set(c.id.toLowerCase(), c.id);

      const payload: { amount: number; category: string; spent_on: string; description: string }[] = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.length === 1 && r[0].trim() === "") continue;
        const rawAmt = (r[idx.amount] ?? "").replace(/\s/g, "").replace(",", ".");
        const amount = Number(rawAmt);
        const catRaw = (r[idx.category] ?? "").trim();
        const mapped = labelToId.get(catRaw.toLowerCase());
        const cat = mapped ? mapped : (catRaw ? catRaw : "other");
        const dateRaw = (r[idx.date] ?? "").trim();
        const spent_on = normalizeDate(dateRaw);
        const note = idx.note >= 0 ? (r[idx.note] ?? "").trim() : "";
        if (!Number.isFinite(amount) || amount < 0 || !spent_on) {
          toast.error(t("csv.bad").replace("{n}", String(i + 1)).replace("{err}", `${rawAmt} / ${dateRaw}`));
          continue;
        }
        payload.push({ amount, category: cat, spent_on, description: note });
      }
      if (payload.length === 0) throw new Error(t("csv.empty"));
      const res = await bulkImportExpenses({ data: { rows: payload } });
      toast.success(t("csv.imported").replace("{n}", String(res.count)));
      qc.invalidateQueries();
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t("add.title")}</h2>

      <label className="block">
        <div className="cursor-pointer rounded-xl border border-dashed border-border bg-card p-4 text-center text-sm text-muted-foreground hover:bg-muted/50">
          {scanning ? t("add.scanning") : t("add.scan")}
        </div>
        <input type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>

      <label className="block">
        <div className="cursor-pointer rounded-xl border border-dashed border-border bg-card p-4 text-center text-sm hover:bg-muted/50">
          <div className="font-medium">{importing ? t("csv.importing") : `📄 ${t("csv.title")}`}</div>
          <div className="text-xs text-muted-foreground mt-1">{t("csv.help")}</div>
        </div>
        <input type="file" accept=".csv,text/csv" className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onCsv(f);
            e.target.value = "";
          }} />
      </label>
      <button
        onClick={() => {
          const today = new Date().toISOString().slice(0, 10);
          const csv = `Amount,Category,Date,Note\n12.50,food,${today},Bakery\n45.00,fuel,${today},Gas station\n9.99,subscriptions,${today},Streaming\n`;
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "expenses-sample.csv";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }}
        className="w-full text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        ⬇ {t("csv.sample")}
      </button>

      <div className="space-y-1">
        <Label>{t("add.amount")}</Label>
        <Input type="number" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>

      <div className="space-y-1">
        <Label>{t("add.category")}</Label>
        <div className="grid grid-cols-4 gap-2">
          {cats.list.map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-xs ${active ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                <c.icon className="h-5 w-5" style={{ color: c.color }} />
                <span className="line-clamp-1">{c.label.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <Label>{t("add.date")}</Label>
        <Input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
      </div>

      <div className="space-y-1">
        <Label>{t("add.note")}</Label>
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="flex gap-2">
        <Button onClick={() => create.mutate()} disabled={!amount || create.isPending} className="flex-1">
          {create.isPending ? t("common.saving") : t("common.save")}
        </Button>
        <Button variant="ghost" onClick={() => navigate({ to: "/" })}>{t("common.cancel")}</Button>
      </div>
    </div>
  );
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === "," || ch === ";" || ch === "\t") { cur.push(field); field = ""; }
      else if (ch === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (ch === "\r") { /* skip */ }
      else field += ch;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows;
}

function normalizeDate(s: string): string {
  if (!s) return "";
  // ISO YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return "";
}