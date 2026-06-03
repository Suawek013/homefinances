import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listIncomes, deleteIncome,
  listInvestmentSnapshots, deleteInvestmentSnapshot,
  type InvestmentSnapshotRow,
} from "@/lib/finances.functions";
import { useMe } from "@/lib/me";
import { formatMoney, monthKey } from "@/lib/categories";
import { Trash2, ChevronLeft, ChevronRight, Wallet, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/finances/")({
  component: FinancesHome,
});

function FinancesHome() {
  const t = useT();
  const me = useMe();
  const qc = useQueryClient();
  const [monthDate, setMonthDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const month = monthKey(monthDate);
  const monthLabel = monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const shiftMonth = (n: number) =>
    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + n, 1));

  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const incomes = useQuery({ queryKey: ["incomes"], queryFn: () => listIncomes() });
  const snapshots = useQuery({
    queryKey: ["investment_snapshots"],
    queryFn: () => listInvestmentSnapshots(),
  });

  const members = me.data?.members ?? [];
  const monthIncomes = (incomes.data ?? []).filter((i) => i.year_month === month);
  const householdMonthTotal = monthIncomes.reduce((s, i) => s + Number(i.amount), 0);

  const filteredIncomes = (incomes.data ?? []).filter((i) => !selectedUser || i.user_id === selectedUser);

  const delInc = useMutation({
    mutationFn: (id: string) => deleteIncome({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["incomes"] }); toast.success(t("common.delete")); },
  });
  const delSnap = useMutation({
    mutationFn: (id: string) => deleteInvestmentSnapshot({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investment_snapshots"] });
      toast.success(t("common.delete"));
    },
  });

  // Latest snapshot per (user_id, label); rows already ordered ascending by date.
  const latestSnapshots: InvestmentSnapshotRow[] = (() => {
    const map = new Map<string, InvestmentSnapshotRow>();
    for (const s of snapshots.data ?? []) {
      map.set(`${s.user_id}::${s.label}`, s);
    }
    return Array.from(map.values()).filter((s) => !selectedUser || s.user_id === selectedUser);
  })();
  const investmentTotal = latestSnapshots.reduce((acc, s) => acc + Number(s.value), 0);

  // Build value-over-time series. For each unique date in (filtered) snapshots,
  // compute total = sum of latest known value per (user,label) up to that date.
  const chartData = (() => {
    const filtered = (snapshots.data ?? []).filter((s) => !selectedUser || s.user_id === selectedUser);
    if (filtered.length === 0) return [] as { date: string; total: number }[];
    const dates = Array.from(new Set(filtered.map((s) => s.recorded_on))).sort();
    const latestByKey = new Map<string, number>();
    let idx = 0;
    const out: { date: string; total: number }[] = [];
    for (const d of dates) {
      while (idx < filtered.length && filtered[idx].recorded_on <= d) {
        latestByKey.set(`${filtered[idx].user_id}::${filtered[idx].label}`, Number(filtered[idx].value));
        idx++;
      }
      let total = 0;
      for (const v of latestByKey.values()) total += v;
      out.push({ date: d, total });
    }
    return out;
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-3 py-2">
        <button onClick={() => shiftMonth(-1)} className="rounded-md p-1.5 hover:bg-muted" aria-label={t("dash.prevMonth")}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-medium capitalize">{monthLabel}</p>
        <button onClick={() => shiftMonth(1)} className="rounded-md p-1.5 hover:bg-muted" aria-label={t("dash.nextMonth")}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" /> {t("fin.householdIncome")}
          </p>
          <p className="mt-1 text-2xl font-semibold">{formatMoney(householdMonthTotal)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> {t("fin.investments")}
          </p>
          <p className={`mt-1 text-2xl font-semibold ${investmentTotal < 0 ? "text-destructive" : ""}`}>
            {formatMoney(investmentTotal)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedUser(null)}
          className={`rounded-full border px-3 py-1 text-xs ${selectedUser === null ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
        >
          {t("fin.combined")}
        </button>
        {members.map((m) => (
          <button
            key={m.user_id}
            onClick={() => setSelectedUser(m.user_id)}
            className={`rounded-full border px-3 py-1 text-xs ${selectedUser === m.user_id ? "border-primary bg-primary/10" : "border-border"}`}
            style={selectedUser === m.user_id ? { color: m.color } : undefined}
          >
            {m.display_name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {members
          .filter((m) => !selectedUser || m.user_id === selectedUser)
          .map((m) => (
            <div key={m.user_id} className="rounded-2xl border border-border bg-card p-3">
              <p className="text-xs" style={{ color: m.color }}>{m.display_name}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatMoney(
                  latestSnapshots
                    .filter((s) => s.user_id === m.user_id)
                    .reduce((acc, s) => acc + Number(s.value), 0),
                )}
              </p>
            </div>
          ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-medium">{t("fin.investmentHistory")}</h2>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("fin.noInvestments")}</p>
        ) : (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickMargin={4} />
                <YAxis tick={{ fontSize: 10 }} width={50} tickFormatter={(v) => formatMoney(Number(v))} />
                <Tooltip
                  formatter={(v: number) => formatMoney(Number(v))}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-medium">{t("fin.latestValues")}</h2>
        {latestSnapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("fin.noInvestments")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {latestSnapshots
              .slice()
              .sort((a, b) => Number(b.value) - Number(a.value))
              .map((s) => {
                const mem = members.find((m) => m.user_id === s.user_id);
                const history = (snapshots.data ?? []).filter(
                  (x) => x.user_id === s.user_id && x.label === s.label,
                );
                const prev = history.length > 1 ? Number(history[history.length - 2].value) : null;
                const delta = prev !== null ? Number(s.value) - prev : null;
                return (
                  <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium">{s.label || "—"}</p>
                      <p className="text-xs" style={{ color: mem?.color }}>
                        {mem?.display_name ?? "—"} · {s.recorded_on}
                        {delta !== null && (
                          <span className={`ml-2 ${delta >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {delta >= 0 ? "▲" : "▼"} {formatMoney(Math.abs(delta))}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums">{formatMoney(Number(s.value))}</span>
                      <button
                        onClick={() => delSnap.mutate(s.id)}
                        className="text-muted-foreground hover:text-destructive"
                        title={t("common.delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-medium">{t("fin.incomeHistory")}</h2>
        {filteredIncomes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("fin.noIncome")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {filteredIncomes.slice(0, 24).map((i) => {
              const mem = members.find((m) => m.user_id === i.user_id);
              return (
                <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium">{i.year_month}</p>
                    <p className="text-xs" style={{ color: mem?.color }}>{mem?.display_name ?? "—"}{i.note ? ` · ${i.note}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">{formatMoney(Number(i.amount))}</span>
                    <button onClick={() => delInc.mutate(i.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}