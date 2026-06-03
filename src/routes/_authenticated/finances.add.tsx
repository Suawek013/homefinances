import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  addInvestmentSnapshot,
  listInvestmentSnapshots,
  bulkImportInvestments,
} from "@/lib/finances.functions";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
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

  const [importing, setImporting] = useState(false);

  // Investment snapshot section
  const snapshotsQ = useQuery({
    queryKey: ["investment_snapshots"],
    queryFn: () => listInvestmentSnapshots(),
  });
  const existingLabels = Array.from(
    new Set((snapshotsQ.data ?? []).map((s) => s.label).filter(Boolean)),
  );
  const [invUser, setInvUser] = useState<string>(myUserId);
  const [invLabel, setInvLabel] = useState("");
  const [invValue, setInvValue] = useState("");
  const [invDate, setInvDate] = useState(() => new Date().toISOString().slice(0, 10));

  const saveSnapshot = useMutation({
    mutationFn: () => addInvestmentSnapshot({
      data: {
        user_id: invUser || myUserId,
        label: invLabel.trim(),
        value: Number(invValue),
        recorded_on: invDate,
      },
    }),
    onSuccess: () => {
      toast.success(t("common.add"));
      qc.invalidateQueries({ queryKey: ["investment_snapshots"] });
      setInvValue("");
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
        value: (() => {
          const v = header.indexOf("value");
          return v >= 0 ? v : header.indexOf("amount");
        })(),
        date: header.indexOf("date"),
        label: header.indexOf("label"),
      };
      if (idx.value < 0 || idx.date < 0) throw new Error(t("csv.helpInvestments"));
      const payload: { value: number; recorded_on: string; label: string; user_id?: string }[] = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.length === 1 && r[0].trim() === "") continue;
        const rawAmt = (r[idx.value] ?? "").replace(/\s/g, "").replace(",", ".");
        const val = Number(rawAmt);
        const dateRaw = (r[idx.date] ?? "").trim();
        const recorded_on = normalizeDate(dateRaw);
        const lbl = idx.label >= 0 ? (r[idx.label] ?? "").trim() : "";
        if (!Number.isFinite(val) || !recorded_on) {
          toast.error(t("csv.bad").replace("{n}", String(i + 1)).replace("{err}", `${rawAmt} / ${dateRaw}`));
          continue;
        }
        payload.push({ value: val, recorded_on, label: lbl, user_id: invUser || myUserId });
      }
      if (payload.length === 0) throw new Error(t("csv.empty"));
      const res = await bulkImportInvestments({ data: { rows: payload } });
      toast.success(t("csv.importedInvestments").replace("{n}", String(res.count)));
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
    const csv = `Value,Date,Label\n12500,${today},ETF portfolio\n3200,${today},Savings account\n800,${today},Crypto\n`;
    triggerDownload(csv, "investments-sample.csv");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div>
          <h2 className="text-sm font-medium">{t("fin.investments")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t("fin.investmentHint")}</p>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">{t("fin.forPerson")}</Label>
          <select
            value={invUser}
            onChange={(e) => setInvUser(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
          >
            {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">{t("fin.investmentLabel")}</Label>
          <Input
            value={invLabel}
            onChange={(e) => setInvLabel(e.target.value)}
            list="inv-labels"
            placeholder="ETF, savings account…"
          />
          <datalist id="inv-labels">
            {existingLabels.map((l) => <option key={l} value={l} />)}
          </datalist>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{t("fin.investmentValue")}</Label>
            <Input
              type="number"
              step="0.01"
              value={invValue}
              onChange={(e) => setInvValue(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("add.date")}</Label>
            <Input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} />
          </div>
        </div>

        <Button
          onClick={() => saveSnapshot.mutate()}
          disabled={!invValue || !invLabel.trim() || !invUser || saveSnapshot.isPending}
          className="w-full"
        >
          {t("fin.updateValue")}
        </Button>
      </div>

      <label className="block">
        <div className="cursor-pointer rounded-xl border border-dashed border-border bg-card p-4 text-center text-sm hover:bg-muted/50">
          <div className="font-medium">{importing ? t("csv.importing") : `📄 ${t("csv.titleInvestments")}`}</div>
          <div className="text-xs text-muted-foreground mt-1">{t("csv.helpInvestments")}</div>
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