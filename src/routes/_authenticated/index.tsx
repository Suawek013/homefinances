import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getMonthlyStats, listExpenses, deleteExpense } from "@/lib/expenses.functions";
import { getSettings, updateBudget, listCategoryBudgets } from "@/lib/settings.functions";
import { formatMoney, monthKey } from "@/lib/categories";
import { useAllCategories } from "@/lib/use-categories";
import { useMe, memberName, memberColor } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { CategoryDonut } from "@/components/CategoryDonut";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function Dashboard() {
  const t = useT();
  const month = monthKey(new Date());
  const me = useMe();
  const cats = useAllCategories();
  const stats = useQuery({ queryKey: ["stats", month], queryFn: () => getMonthlyStats({ data: { month } }) });
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => getSettings() });
  const catBudgets = useQuery({ queryKey: ["cat-budgets"], queryFn: () => listCategoryBudgets() });
  const qc = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const expenses = useQuery({
    queryKey: ["expenses", month, selectedUser],
    queryFn: () => listExpenses({ data: { month, userId: selectedUser ?? undefined } }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteExpense({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries(); toast.success(t("common.delete")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const budget = settings.data?.monthly_budget;
  const totalAll = stats.data?.total ?? 0;

  // Per-user category breakdown derived from byCategoryUser
  const userCategoryData: Record<string, number> = {};
  if (selectedUser && stats.data) {
    for (const [cat, perUser] of Object.entries(stats.data.byCategoryUser)) {
      const amt = perUser[selectedUser] ?? 0;
      if (amt > 0) userCategoryData[cat] = amt;
    }
  }
  const userTotal = selectedUser ? (stats.data?.byUser[selectedUser] ?? 0) : 0;

  const donutData = selectedUser ? userCategoryData : (stats.data?.byCategory ?? {});
  const donutTotal = selectedUser ? userTotal : totalAll;
  const remaining = budget != null ? budget - totalAll : null;
  const selectedMember = selectedUser ? me.data?.members.find((m) => m.user_id === selectedUser) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("dash.thisMonth")}</p>
        <p className="mt-1 text-3xl font-semibold">{formatMoney(totalAll)}</p>
        {budget != null && (
          <p className={`mt-1 text-sm ${remaining! < 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {remaining! >= 0 ? t("dash.remaining") : t("dash.over")}: {formatMoney(Math.abs(remaining!))}
          </p>
        )}
        <BudgetEditor current={budget ?? null} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">
            {t("dash.viewing")}:{" "}
            <span style={{ color: selectedMember?.color }}>
              {selectedMember?.display_name ?? t("dash.everyone")}
            </span>
          </h2>
          {selectedUser && (
            <button onClick={() => setSelectedUser(null)} className="text-xs text-primary hover:underline">
              {t("dash.clearFilter")}
            </button>
          )}
        </div>
        {donutTotal > 0 ? (
          <CategoryDonut
            data={donutData}
            resolve={cats.resolve}
            budget={selectedUser ? null : budget}
            centerLabel={t("dash.spent")}
            centerSub={
              !selectedUser && budget != null
                ? `${remaining! >= 0 ? t("dash.left") : t("dash.over")}: ${formatMoney(Math.abs(remaining!))}`
                : undefined
            }
          />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("dash.noExpenses")}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {me.data?.members.map((m) => (
          <button
            key={m.user_id}
            onClick={() => setSelectedUser(selectedUser === m.user_id ? null : m.user_id)}
            className={`rounded-xl border bg-card p-3 text-left transition ${
              selectedUser === m.user_id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
            }`}
          >
            <p className="text-xs text-muted-foreground">{m.display_name}</p>
            <p className="mt-1 text-lg font-semibold" style={{ color: m.color }}>
              {formatMoney(stats.data?.byUser[m.user_id] ?? 0)}
            </p>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">{t("dash.byCategory")}</h2>
        </div>
        <div className="space-y-2">
          {Object.entries(stats.data?.byCategory ?? {}).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
            const def = cats.resolve(cat);
            const catBudget = catBudgets.data?.find((c) => c.category === cat)?.amount ?? null;
            const pct = catBudget ? Math.min(100, (amt / catBudget) * 100) : null;
            return (
              <div key={cat}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <def.icon className="h-4 w-4" style={{ color: def.color }} />
                    {def.label}
                  </span>
                  <span className="tabular-nums">{formatMoney(amt)}{catBudget ? ` / ${formatMoney(catBudget)}` : ""}</span>
                </div>
                {pct != null && (
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
          {(!stats.data || stats.data.count === 0) && (
            <p className="text-sm text-muted-foreground">{t("dash.noExpenses")}</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-medium">{t("dash.recent")}</h2>
        <ul className="divide-y divide-border">
          {(expenses.data ?? []).slice(0, 20).map((e) => {
            const def = cats.resolve(e.category);
            return (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <div className="flex items-center gap-2">
                  <def.icon className="h-4 w-4" style={{ color: def.color }} />
                  <div>
                    <p>{e.description || def.label}</p>
                    <p className="text-xs" style={{ color: memberColor(me.data?.members ?? [], e.user_id) }}>
                      {memberName(me.data?.members ?? [], e.user_id)} · {e.spent_on}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums">{formatMoney(Number(e.amount))}</span>
                  <button onClick={() => delMut.mutate(e.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
          {(!expenses.data || expenses.data.length === 0) && (
            <li className="py-2 text-sm text-muted-foreground">{t("dash.nothing")}</li>
          )}
        </ul>
      </div>

      <Link to="/add" className="fixed bottom-24 right-4 z-20 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-lg">
        {t("dash.addExpense")}
      </Link>
    </div>
  );
}

function BudgetEditor({ current }: { current: number | null }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(current?.toString() ?? "");
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (monthly_budget: number | null) => updateBudget({ data: { monthly_budget } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings"] }); setEditing(false); },
  });
  if (!editing) {
    return (
      <button onClick={() => { setVal(current?.toString() ?? ""); setEditing(true); }} className="mt-2 text-xs text-primary hover:underline">
        {current == null ? t("dash.setBudget") : t("dash.editBudget")}
      </button>
    );
  }
  return (
    <div className="mt-2 flex gap-2">
      <Input type="number" value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g. 5000" className="h-8" />
      <Button size="sm" onClick={() => mut.mutate(val === "" ? null : Number(val))}>{t("common.save")}</Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
    </div>
  );
}