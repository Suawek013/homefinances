import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { listExpenses, getMonthlyStats, deleteExpense } from "@/lib/expenses.functions";
import { getSettings, updateBudget } from "@/lib/settings.functions";
import { materializeRecurringForMonth } from "@/lib/recurring.functions";
import { CATEGORY_MAP, formatMoney, monthKey } from "@/lib/categories";
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
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Budget {formatMoney(budget)}</span>
              <span className={remaining! < 0 ? "text-destructive" : "text-primary"}>
                {remaining! >= 0 ? `${formatMoney(remaining!)} left` : `${formatMoney(-remaining!)} over`}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.min(100, ((stats.data?.total ?? 0) / budget) * 100)}%`,
                  background:
                    remaining! < 0 ? "var(--destructive)" : "var(--primary)",
                }}
              />
            </div>
          </div>
        ) : (
          <BudgetSetter />
        )}
      </Card>

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
                <button
                  onClick={() => delMut.mutate(e.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
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

// Helper: call server fn via useServerFn-like pattern but at queryFn level.
// useServerFn is a hook, so we use a tiny wrapper that calls the underlying fn directly.
function useServerFnCall<I, O>(
  fn: (args: { data: I }) => Promise<O>,
  input: I,
): Promise<O> {
  return fn({ data: input });
}
