import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listRecurring, upsertRecurring, deleteRecurring,
  getRecurringStatus, materializeRecurringForMonth,
} from "@/lib/recurring.functions";
import { CATEGORIES, type Category, formatMoney, monthKey } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/recurring")({
  component: RecurringPage,
});

function RecurringPage() {
  const month = monthKey(new Date());
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["recurring"], queryFn: () => listRecurring() });
  const status = useQuery({ queryKey: ["recurring-status", month], queryFn: () => getRecurringStatus({ data: { month } }) });

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState(1);
  const [category, setCategory] = useState<Category>("subscriptions");

  const add = useMutation({
    mutationFn: () => upsertRecurring({ data: { name, amount: Number(amount), day_of_month: day, category, active: true } }),
    onSuccess: () => { qc.invalidateQueries(); setName(""); setAmount(""); toast.success("Added"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteRecurring({ data: { id } }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const materialize = useMutation({
    mutationFn: () => materializeRecurringForMonth({ data: { month } }),
    onSuccess: (r) => { qc.invalidateQueries(); toast.success(`Logged ${r.created} bill(s)`); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recurring bills</h2>
        <Button size="sm" variant="outline" onClick={() => materialize.mutate()}>Log this month</Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-medium">Add new</h3>
        <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Netflix" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1"><Label>Amount</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="space-y-1"><Label>Day of month</Label><Input type="number" min={1} max={31} value={day} onChange={(e) => setDay(Number(e.target.value))} /></div>
        </div>
        <div className="space-y-1">
          <Label>Category</Label>
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <Button onClick={() => add.mutate()} disabled={!name || !amount || add.isPending} className="w-full">
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>

      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {(list.data ?? []).map((r) => {
          const st = status.data?.find((s) => s.id === r.id);
          return (
            <li key={r.id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">Day {r.day_of_month} · {r.category} · {formatMoney(Number(r.amount))}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${st?.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {st?.paid ? "Paid" : "Pending"}
                </span>
                <button onClick={() => del.mutate(r.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
        {(!list.data || list.data.length === 0) && <li className="p-3 text-sm text-muted-foreground">No recurring bills.</li>}
      </ul>
    </div>
  );
}