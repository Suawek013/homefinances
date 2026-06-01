import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addSavings, bulkImportSavings } from "@/lib/finances.functions";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Minus } from "lucide-react";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/finances/add")({
  component: FinancesAdd,
});

function FinancesAdd() {
  const t = useT();
  const navigate = useNavigate();
  const me = useMe();
  const qc = useQueryClient();
  const members = me.data?.members ?? [];
  const myUserId = me.data?.currentMember?.user_id ?? "";

  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [forUser, setForUser] = useState<string>(myUserId);
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [importing, setImporting] = useState(false);

  const add = useMutation({
    mutationFn: () => addSavings({
      data: {
        user_id: forUser || myUserId,
        amount: mode === "deposit" ? Number(amount) : -Number(amount),
        label,
        occurred_on: occurredOn,
      },
    }),
    onSuccess: () => {
      toast.success(t("common.add"));
      navigate({ to: "/finances" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onCsv(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) throw new Error(t("csv.empty"));
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const idx = {
        amount: header.indexOf("amount"),
        date: header.indexOf("date"),
        label: header.indexOf("label"),
      };
      if (idx.amount < 0 || idx.date < 0) throw new Error(t("csv.helpSavings"));
      const payload: { amount: number; occurred_on: string; label: string; user_id?: string }[] = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.length === 1 && r[0].trim() === "") continue;
        const rawAmt = (r[idx.amount] ?? "").replace(/\s/g, "").replace(",", ".");
        const amt = Number(rawAmt);
        const dateRaw = (r[idx.date] ?? "").trim();
        const occurred_on = normalizeDate(dateRaw);
        const lbl = idx.label >= 0 ? (r[idx.label] ?? "").trim() : "";
        if (!Number.isFinite(amt) || amt === 0 || !occurred_on) {
          toast.error(t("csv.bad").replace("{n}", String(i + 1)).replace("{err}", `${rawAmt} / ${dateRaw}`));
          continue;
        }
        payload.push({ amount: amt, occurred_on, label: lbl, user_id: forUser || myUserId });
      }
      if (payload.length === 0) throw new Error(t("csv.empty"));
      const res = await bulkImportSavings({ data: { rows: payload } });
      toast.success(t("csv.importedSavings").replace("{n}", String(res.count)));
      qc.invalidateQueries();
      navigate({ to: "/finances" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function downloadSample() {
    const today = new Date().toISOString().slice(0, 10);
    const csv = `Amount,Date,Label\n500,${today},Monthly savings\n-100,${today},ATM withdrawal\n1200,${today},Investment\n`;
    triggerDownload(csv, "savings-sample.csv");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-medium">{t("fin.savings")}</h2>

        <div className="flex gap-2">
          <button
            onClick={() => setMode("deposit")}
            className={`flex-1 rounded-md py-2 text-xs ${mode === "deposit" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            <Plus className="mr-1 inline h-3 w-3" />{t("fin.deposit")}
          </button>
          <button
            onClick={() => setMode("withdraw")}
            className={`flex-1 rounded-md py-2 text-xs ${mode === "withdraw" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"}`}
          >
            <Minus className="mr-1 inline h-3 w-3" />{t("fin.withdraw")}
          </button>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">{t("fin.forPerson")}</Label>
          <select
            value={forUser}
            onChange={(e) => setForUser(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
          >
            {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{t("add.amount")}</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("add.date")}</Label>
            <Input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">{t("fin.labelPlaceholder")}</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("fin.labelPlaceholder")} />
        </div>

        <Button
          onClick={() => add.mutate()}
          disabled={!amount || Number(amount) <= 0 || !forUser || add.isPending}
          className="w-full"
        >
          {t("common.add")}
        </Button>
      </div>

      <label className="block">
        <div className="cursor-pointer rounded-xl border border-dashed border-border bg-card p-4 text-center text-sm hover:bg-muted/50">
          <div className="font-medium">{importing ? t("csv.importing") : `📄 ${t("csv.titleSavings")}`}</div>
          <div className="text-xs text-muted-foreground mt-1">{t("csv.helpSavings")}</div>
        </div>
        <input type="file" accept=".csv,text/csv" className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onCsv(f);
            e.target.value = "";
          }} />
      </label>
      <button
        onClick={downloadSample}
        className="w-full text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        ⬇ {t("csv.sample")}
      </button>
    </div>
  );
}

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return "";
}