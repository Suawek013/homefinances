import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listIncomes, listSavings, deleteSavings, deleteIncome } from "@/lib/finances.functions";
import { useMe } from "@/lib/me";
import { formatMoney, monthKey } from "@/lib/categories";
import { Trash2, ChevronLeft, ChevronRight, Wallet, PiggyBank } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

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
  const savings = useQuery({ queryKey: ["savings"], queryFn: () => listSavings() });

  const members = me.data?.members ?? [];
  const monthIncomes = (incomes.data ?? []).filter((i) => i.year_month === month);
  const householdMonthTotal = monthIncomes.reduce((s, i) => s + Number(i.amount), 0);
  const householdSavings = (savings.data ?? []).reduce((s, i) => s + Number(i.amount), 0);

  const filteredSavings = (savings.data ?? []).filter((s) => !selectedUser || s.user_id === selectedUser);
  const filteredIncomes = (incomes.data ?? []).filter((i) => !selectedUser || i.user_id === selectedUser);

  const userBalance = (uid: string) =>
    (savings.data ?? []).filter((s) => s.user_id === uid).reduce((acc, s) => acc + Number(s.amount), 0);

  const delSav = useMutation({
    mutationFn: (id: string) => deleteSavings({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["savings"] }); toast.success(t("common.delete")); },
  });
  const delInc = useMutation({
    mutationFn: (id: string) => deleteIncome({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["incomes"] }); toast.success(t("common.delete")); },
  });

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
            <PiggyBank className="h-3.5 w-3.5" /> {t("fin.householdSavings")}
          </p>
          <p className={`mt-1 text-2xl font-semibold ${householdSavings < 0 ? "text-destructive" : ""}`}>
            {formatMoney(householdSavings)}
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
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatMoney(userBalance(m.user_id))}</p>
            </div>
          ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-medium">{t("fin.recent")}</h2>
        {filteredSavings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("fin.noSavings")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {filteredSavings.slice(0, 20).map((s) => {
              const mem = members.find((m) => m.user_id === s.user_id);
              const positive = Number(s.amount) >= 0;
              return (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium">{s.label || (positive ? t("fin.deposit") : t("fin.withdraw"))}</p>
                    <p className="text-xs" style={{ color: mem?.color }}>{mem?.display_name ?? "—"} · {s.occurred_on}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`tabular-nums ${positive ? "text-emerald-600" : "text-destructive"}`}>
                      {positive ? "+" : ""}{formatMoney(Number(s.amount))}
                    </span>
                    <button onClick={() => delSav.mutate(s.id)} className="text-muted-foreground hover:text-destructive">
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