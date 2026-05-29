import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listIncomes, upsertIncome, deleteIncome,
  listSavings, addSavings, deleteSavings,
} from "@/lib/finances.functions";
import { useMe } from "@/lib/me";
import { formatMoney, monthKey } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2, ChevronLeft, ChevronRight, Wallet, PiggyBank, Plus, Minus } from "lucide-react";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/finances")({
  component: FinancesPage,
});

function FinancesPage() {
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

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-medium">{t("fin.salariesFor")} {monthLabel}</h2>
        <ul className="divide-y divide-border">
          {members
            .filter((m) => !selectedUser || m.user_id === selectedUser)
            .map((mem) => {
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

      <SavingsSection
        members={members}
        selectedUser={selectedUser}
        savings={filteredSavings}
        onChanged={() => qc.invalidateQueries({ queryKey: ["savings"] })}
        t={t}
      />

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
                  <span className="tabular-nums">{formatMoney(Number(i.amount))}</span>
                </li>
              );
            })}
          </ul>
        )}
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

function SavingsSection({
  members, selectedUser, savings, onChanged, t,
}: {
  members: { user_id: string; display_name: string; color: string }[];
  selectedUser: string | null;
  savings: { id: string; user_id: string; amount: number; label: string; occurred_on: string }[];
  onChanged: () => void;
  t: (k: string) => string;
}) {
  const me = useMe();
  const myUserId = me.data?.currentMember?.user_id;
  const [forUser, setForUser] = useState<string>(selectedUser ?? myUserId ?? "");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");

  const effectiveUser = selectedUser ?? forUser ?? myUserId ?? members[0]?.user_id ?? "";

  const add = useMutation({
    mutationFn: () => addSavings({
      data: {
        user_id: effectiveUser,
        amount: mode === "deposit" ? Number(amount) : -Number(amount),
        label,
        occurred_on: occurredOn,
      },
    }),
    onSuccess: () => { onChanged(); setAmount(""); setLabel(""); toast.success(t("common.add")); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteSavings({ data: { id } }),
    onSuccess: () => { onChanged(); toast.success(t("common.delete")); },
  });

  const userBalance = (uid: string) =>
    (savings.filter((s) => s.user_id === uid)).reduce((acc, s) => acc + Number(s.amount), 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{t("fin.savings")}</h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {members
          .filter((m) => !selectedUser || m.user_id === selectedUser)
          .map((m) => (
            <div key={m.user_id} className="rounded-xl border border-border p-3">
              <p className="text-xs" style={{ color: m.color }}>{m.display_name}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatMoney(userBalance(m.user_id))}</p>
            </div>
          ))}
      </div>

      <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
        <div className="flex gap-2">
          <button
            onClick={() => setMode("deposit")}
            className={`flex-1 rounded-md py-1.5 text-xs ${mode === "deposit" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            <Plus className="mr-1 inline h-3 w-3" />{t("fin.deposit")}
          </button>
          <button
            onClick={() => setMode("withdraw")}
            className={`flex-1 rounded-md py-1.5 text-xs ${mode === "withdraw" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"}`}
          >
            <Minus className="mr-1 inline h-3 w-3" />{t("fin.withdraw")}
          </button>
        </div>
        {!selectedUser && (
          <div className="space-y-1">
            <Label className="text-xs">{t("fin.forPerson")}</Label>
            <select
              value={forUser}
              onChange={(e) => setForUser(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="h-9" />
          <Input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} className="h-9" />
        </div>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("fin.labelPlaceholder")} className="h-9" />
        <Button
          onClick={() => add.mutate()}
          disabled={!amount || Number(amount) <= 0 || !effectiveUser || add.isPending}
          className="w-full"
        >
          {t("common.add")}
        </Button>
      </div>

      <div>
        <h3 className="mb-1 text-xs font-medium text-muted-foreground">{t("fin.recent")}</h3>
        {savings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("fin.noSavings")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {savings.slice(0, 30).map((s) => {
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
                    <button onClick={() => del.mutate(s.id)} className="text-muted-foreground hover:text-destructive">
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