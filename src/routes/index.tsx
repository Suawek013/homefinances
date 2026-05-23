import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { listExpenses, getMonthlyStats, deleteExpense } from "@/lib/expenses.functions";
import { getSettings, updateBudget, listCategoryBudgets, setCategoryBudget } from "@/lib/settings.functions";
import { materializeRecurringForMonth } from "@/lib/recurring.functions";
import { CATEGORIES, CATEGORY_MAP, formatMoney, monthKey, type Category } from "@/lib/categories";
import { personColor, personName } from "@/lib/person";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const [month, setMonth] = useState(monthKey(new Date()));
  const [filter, setFilter] = useState<"all" | "slawek" | "natalia">("all");
  const qc = useQueryClient();

  const materialize = useServerFn(materializeRecurringForMonth);
  useEffect(() => {
    materialize({ data: { month } })
      .then((r) => {
        if (r.created > 0) {
          qc.invalidateQueries();
          toast.success(`${r.created} recurring bill(s) added for this month`);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const stats = useQuery({
    queryKey: ["stats", month],
    queryFn: () => useServerFnCall(getMonthlyStats, { month }),
  });
  const expenses = useQuery({
    queryKey: ["expenses", month, filter],
    queryFn: () =>
      useServerFnCall(listExpenses, {
        month,
        personId: filter === "all" ? undefined : filter,
      }),
  });
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => useServerFnCall(getSettings, undefined),
  });
  const catBudgets = useQuery({
    queryKey: ["categoryBudgets"],
    queryFn: () => useServerFnCall(listCategoryBudgets, undefined),
  });

  const del = useServerFn(deleteExpense);
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Deleted");
    },
  });

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  }, [month]);

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(monthKey(d));
  };

  const pieData = stats.data
    ? Object.entries(stats.data.byCategory).map(([cat, val]) => ({
        name: CATEGORY_MAP[cat as keyof typeof CATEGORY_MAP]?.label ?? cat,
        value: val,
        color: CATEGORY_MAP[cat as keyof typeof CATEGORY_MAP]?.color ?? "oklch(0.6 0.05 200)",
      }))
    : [];

  const barData = stats.data
    ? Object.entries(stats.data.byCategoryPerson).map(([cat, v]) => ({
        name: CATEGORY_MAP[cat as keyof typeof CATEGORY_MAP]?.label?.split(" ")[0] ?? cat,
        Slawek: v.slawek,
        Natalia: v.natalia,
      }))
    : [];

  const budget = settings.data?.monthly_budget ?? null;
  const remaining = budget != null && stats.data ? budget - stats.data.total : null;

  return (
    <div className="space-y-4">
      {/* Month picker */}
      <div className="flex items-center justify-between">
        <button onClick={() => shiftMonth(-1)} className="rounded-full p-2 hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <div className="text-lg font-semibold">{monthLabel}</div>
          <div className="text-xs text-muted-foreground">
            {stats.data?.count ?? 0} expenses
          </div>
        </div>
        <button onClick={() => shiftMonth(1)} className="rounded-full p-2 hover:bg-muted">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Total + budget */}
      <Card className="p-5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Spent this month
        </div>
        <div className="mt-1 text-3xl font-bold tracking-tight">
          {formatMoney(stats.data?.total ?? 0)}
        </div>
        {budget != null ? (
          <BudgetEditor budget={budget} spent={stats.data?.total ?? 0} />
        ) : (
          <BudgetSetter />
        )}
      </Card>

      {/* Category budgets */}
      <CategoryBudgetsCard
        budgets={catBudgets.data ?? []}
        byCategory={stats.data?.byCategory ?? {}}
      />

      {/* Per-person */}
      <div className="grid grid-cols-2 gap-3">
        {(["slawek", "natalia"] as const).map((pid) => (
          <Card key={pid} className="p-4">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: personColor(pid) }}
              />
              <span className="text-sm font-medium">{personName(pid)}</span>
            </div>
            <div className="mt-2 text-xl font-bold">
              {formatMoney(pid === "slawek" ? stats.data?.slawek ?? 0 : stats.data?.natalia ?? 0)}
            </div>
          </Card>
        ))}
      </div>

      {/* Charts */}
      {pieData.length > 0 && (
        <Card className="p-4">
          <div className="mb-2 text-sm font-medium">By category</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {pieData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="font-medium">{formatMoney(d.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {barData.length > 0 && (
        <Card className="p-4">
          <div className="mb-2 text-sm font-medium">Split by person</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis dataKey="name" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip formatter={(v: number) => formatMoney(v)} />
                <Bar dataKey="Slawek" stackId="a" fill="var(--person-slawek)" />
                <Bar dataKey="Natalia" stackId="a" fill="var(--person-natalia)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Filter + feed */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Expenses</h2>
        <div className="flex rounded-full bg-muted p-1 text-xs">
          {(["all", "slawek", "natalia"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 transition-colors ${
                filter === f ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
            >
              {f === "all" ? "All" : personName(f)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {expenses.data?.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No expenses yet. Tap + to add one.
          </Card>
        )}
        {expenses.data?.map((e) => {
          const cat = CATEGORY_MAP[e.category as keyof typeof CATEGORY_MAP];
          const Icon = cat?.icon;
          return (
            <Card key={e.id} className="flex items-center gap-3 p-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: `${cat?.color}22` }}
              >
                {Icon && <Icon className="h-5 w-5" style={{ color: cat.color }} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {e.description || cat?.label}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                    style={{ background: personColor(e.person_id) }}
                  >
                    {personName(e.person_id)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(e.spent_on).toLocaleDateString("en-GB")} · {cat?.label}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{formatMoney(Number(e.amount))}</div>
                <div className="flex items-center justify-end gap-1.5">
                  <Link
                    to="/add"
                    search={{ id: e.id }}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={() => delMut.mutate(e.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Link
        to="/add"
        className="fixed bottom-24 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        <Plus className="h-7 w-7" />
      </Link>
    </div>
  );
}

function BudgetSetter() {
  const qc = useQueryClient();
  const [val, setVal] = useState("");
  const upd = useServerFn(updateBudget);
  const mut = useMutation({
    mutationFn: () => upd({ data: { monthly_budget: val ? Number(val) : null } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Budget set");
      setVal("");
    },
  });
  return (
    <div className="mt-3 flex gap-2">
      <Input
        type="number"
        inputMode="decimal"
        placeholder="Set monthly budget (optional)"
        value={val}
        onChange={(e) => setVal(e.target.value)}
      />
      <Button onClick={() => mut.mutate()} disabled={!val}>Set</Button>
    </div>
  );
}

function BudgetEditor({ budget, spent }: { budget: number; spent: number }) {
  const qc = useQueryClient();
  const upd = useServerFn(updateBudget);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(budget));
  useEffect(() => setVal(String(budget)), [budget]);

  const remaining = budget - spent;
  const mut = useMutation({
    mutationFn: (next: number | null) => upd({ data: { monthly_budget: next } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Budget updated");
      setEditing(false);
    },
  });

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {editing ? (
          <div className="flex flex-1 items-center gap-2">
            <Input
              type="number"
              inputMode="decimal"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              className="h-8"
              autoFocus
            />
            <Button size="sm" onClick={() => mut.mutate(val ? Number(val) : null)} disabled={mut.isPending}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setVal(String(budget)); }}>
              <X className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => mut.mutate(null)} disabled={mut.isPending}>
              Clear
            </Button>
          </div>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="flex items-center gap-1 hover:text-foreground">
              <span>Budget {formatMoney(budget)}</span>
              <Pencil className="h-3 w-3" />
            </button>
            <span className={remaining < 0 ? "text-destructive" : "text-primary"}>
              {remaining >= 0 ? `${formatMoney(remaining)} left` : `${formatMoney(-remaining)} over`}
            </span>
          </>
        )}
      </div>
      {!editing && (
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full transition-all"
            style={{
              width: `${Math.min(100, (spent / budget) * 100)}%`,
              background: remaining < 0 ? "var(--destructive)" : "var(--primary)",
            }}
          />
        </div>
      )}
    </div>
  );
}

function CategoryBudgetsCard({
  budgets,
  byCategory,
}: {
  budgets: { category: string; amount: number }[];
  byCategory: Record<string, number>;
}) {
  const qc = useQueryClient();
  const setCat = useServerFn(setCategoryBudget);
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const budgetMap = useMemo(
    () => Object.fromEntries(budgets.map((b) => [b.category, b.amount])) as Record<string, number>,
    [budgets],
  );

  useEffect(() => {
    if (open) {
      const d: Record<string, string> = {};
      for (const c of CATEGORIES) d[c.id] = budgetMap[c.id] != null ? String(budgetMap[c.id]) : "";
      setDrafts(d);
    }
  }, [open, budgetMap]);

  const save = useMutation({
    mutationFn: async (input: { category: Category; amount: number | null }) =>
      setCat({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categoryBudgets"] }),
  });

  const hasAny = budgets.length > 0;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Category budgets</div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          {open ? "Done" : hasAny ? "Edit" : "Set up"}
        </button>
      </div>

      {!open && !hasAny && (
        <p className="mt-2 text-xs text-muted-foreground">
          Optional. Set monthly limits per category to see how much you can still spend.
        </p>
      )}

      {!open && hasAny && (
        <div className="mt-3 space-y-2">
          {CATEGORIES.filter((c) => budgetMap[c.id] != null).map((c) => {
            const limit = budgetMap[c.id];
            const spent = byCategory[c.id] ?? 0;
            const left = limit - spent;
            const pct = Math.min(100, (spent / limit) * 100);
            const Icon = c.icon;
            return (
              <div key={c.id}>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" style={{ color: c.color }} />
                    <span className="font-medium">{c.label}</span>
                  </div>
                  <span className={left < 0 ? "text-destructive" : "text-muted-foreground"}>
                    {formatMoney(spent)} / {formatMoney(limit)} ·{" "}
                    <span className={left < 0 ? "text-destructive font-medium" : "text-primary font-medium"}>
                      {left >= 0 ? `${formatMoney(left)} left` : `${formatMoney(-left)} over`}
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: left < 0 ? "var(--destructive)" : c.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-2">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const draft = drafts[c.id] ?? "";
            const current = budgetMap[c.id];
            const numericDraft = draft === "" ? null : Number(draft);
            const dirty =
              (current ?? null) !== numericDraft &&
              !(Number.isNaN(numericDraft as number));
            return (
              <div key={c.id} className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0" style={{ color: c.color }} />
                <span className="flex-1 truncate text-xs">{c.label}</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="—"
                  value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                  className="h-8 w-24 text-xs"
                />
                <Button
                  size="sm"
                  variant={dirty ? "default" : "ghost"}
                  disabled={!dirty || save.isPending}
                  onClick={() =>
                    save.mutate({
                      category: c.id,
                      amount: draft === "" ? null : Number(draft),
                    })
                  }
                  className="h-8 px-2"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground">
            Leave blank and save to remove a category's budget.
          </p>
        </div>
      )}
    </Card>
  );
}

// Helper: call server fn via useServerFn-like pattern but at queryFn level.
// useServerFn is a hook, so we use a tiny wrapper that calls the underlying fn directly.
function useServerFnCall<I, O>(
  fn: (args: { data: I }) => Promise<O>,
  input: I,
): Promise<O> {
  return fn({ data: input });
}
