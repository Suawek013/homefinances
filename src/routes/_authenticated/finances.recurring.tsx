import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listIncomes, upsertIncome, deleteIncome } from "@/lib/finances.functions";
import { useMe } from "@/lib/me";
import { formatMoney, monthKey } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/finances/recurring")({
  component: FinancesRecurring,
});

function FinancesRecurring() {
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

  const incomes = useQuery({ queryKey: ["incomes"], queryFn: () => listIncomes() });
  const members = me.data?.members ?? [];
  const monthIncomes = (incomes.data ?? []).filter((i) => i.year_month === month);
  const total = monthIncomes.reduce((s, i) => s + Number(i.amount), 0);

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

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <Wallet className="h-3.5 w-3.5" /> {t("fin.householdIncome")}
        </p>
        <p className="mt-1 text-2xl font-semibold">{formatMoney(total)}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-medium">{t("fin.salariesFor")} {monthLabel}</h2>
        <ul className="divide-y divide-border">
          {members.map((mem) => {
            const existing = monthIncomes.find((i) => i.user_id === mem.user_id);
            return (
              <IncomeRowEditor
                key={mem.user_id}
                memberName={mem.display_name}
                color={mem.color}
                userId={mem.user_id}
                month={month}
                current={existing ?? null}
                onSaved={() => qc.invalidateQueries({ queryKey: ["incomes"] })}
              />
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function IncomeRowEditor({
  memberName, color, userId, month, current, onSaved,
}: {
  memberName: string; color: string; userId: string; month: string;
  current: { id: string; amount: number; note: string } | null; onSaved: () => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(current?.amount?.toString() ?? "");
  const [note, setNote] = useState(current?.note ?? "");
  const save = useMutation({
    mutationFn: () => upsertIncome({ data: { user_id: userId, year_month: month, amount: Number(amount || 0), note } }),
    onSuccess: () => { onSaved(); setEditing(false); toast.success(t("common.save")); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteIncome({ data: { id } }),
    onSuccess: () => { onSaved(); toast.success(t("common.delete")); },
  });

  if (editing) {
    return (
      <li className="space-y-2 py-2">
        <p className="text-sm font-medium" style={{ color }}>{memberName}</p>
        <div className="flex gap-2">
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="h-9" />
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("fin.notePlaceholder")} className="h-9" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>{t("common.save")}</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between py-2 text-sm">
      <div>
        <p className="font-medium" style={{ color }}>{memberName}</p>
        {current?.note && <p className="text-xs text-muted-foreground">{current.note}</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className="tabular-nums">{current ? formatMoney(Number(current.amount)) : "—"}</span>
        <button
          onClick={() => { setAmount(current?.amount?.toString() ?? ""); setNote(current?.note ?? ""); setEditing(true); }}
          className="text-xs text-primary hover:underline"
        >
          {current ? t("common.edit") : t("common.add")}
        </button>
        {current && (
          <button onClick={() => del.mutate(current.id)} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </li>
  );
}