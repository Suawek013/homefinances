import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { listRecurring, upsertRecurring, deleteRecurring, getRecurringStatus } from "@/lib/recurring.functions";
import { CATEGORIES, CATEGORY_MAP, formatMoney, monthKey, type Category } from "@/lib/categories";
import { PEOPLE, personColor, personName, type PersonId, usePerson } from "@/lib/person";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/recurring")({
  component: RecurringPage,
  head: () => ({ meta: [{ title: "Recurring bills — Household Budget" }] }),
});

function RecurringPage() {
  const qc = useQueryClient();
  const month = monthKey(new Date());
  const status = useQuery({
    queryKey: ["recurring-status", month],
    queryFn: () => getRecurringStatus({ data: { month } }),
  });
  const list = useQuery({
    queryKey: ["recurring"],
    queryFn: () => listRecurring(),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteRecurring({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Removed");
    },
  });

  const today = new Date().getDate();
  const rows = status.data ?? list.data?.map((r) => ({ ...r, paid: false, expense_id: null })) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Recurring bills</h2>
          <p className="text-xs text-muted-foreground">Auto-added each month</p>
        </div>
        <RecurringDialog onSaved={() => qc.invalidateQueries()}>
          <Button size="sm"><Plus className="mr-1 h-4 w-4" />Add</Button>
        </RecurringDialog>
      </div>

      {rows.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No recurring bills yet.
        </Card>
      )}

      <div className="space-y-2">
        {rows.map((r) => {
          const cat = CATEGORY_MAP[r.category as Category];
          const Icon = cat?.icon;
          const upcoming = !r.paid && r.day_of_month - today >= 0 && r.day_of_month - today <= 5;
          const overdue = !r.paid && r.day_of_month < today;
          return (
            <Card key={r.id} className="flex items-center gap-3 p-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: `${cat?.color}22` }}
              >
                {Icon && <Icon className="h-5 w-5" style={{ color: cat?.color }} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{r.name}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                    style={{ background: personColor(r.person_id) }}
                  >
                    {personName(r.person_id)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Day {r.day_of_month}</span>
                  {r.paid && (
                    <span className="flex items-center gap-1 text-primary">
                      <CheckCircle2 className="h-3 w-3" /> paid
                    </span>
                  )}
                  {upcoming && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Clock className="h-3 w-3" /> upcoming
                    </span>
                  )}
                  {overdue && (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertCircle className="h-3 w-3" /> overdue
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{formatMoney(Number(r.amount))}</div>
                <button
                  onClick={() => del.mutate(r.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function RecurringDialog({
  children,
  onSaved,
}: {
  children: React.ReactNode;
  onSaved: () => void;
}) {
  const { current } = usePerson();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("1");
  const [category, setCategory] = useState<Category>("utilities");
  const [person, setPerson] = useState<PersonId>(current);

  const save = useMutation({
    mutationFn: () =>
      upsertRecurring({
        data: {
          name,
          amount: Number(amount),
          day_of_month: Number(day),
          category,
          person_id: person,
          active: true,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      setOpen(false);
      setName(""); setAmount(""); setDay("1");
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New recurring bill</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rent" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div><Label>Day of month</Label><Input type="number" min="1" max="31" value={day} onChange={(e) => setDay(e.target.value)} /></div>
          </div>
          <div>
            <Label>Category</Label>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {CATEGORIES.map((c) => (
                <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                  className="flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px]"
                  style={{
                    borderColor: category === c.id ? c.color : "var(--border)",
                    background: category === c.id ? `${c.color}18` : "transparent",
                  }}>
                  <c.icon className="h-4 w-4" style={{ color: c.color }} />
                  <span>{c.label.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Paid by</Label>
            <div className="mt-1 flex rounded-md bg-muted p-1">
              {PEOPLE.map((p) => (
                <button key={p.id} type="button" onClick={() => setPerson(p.id)}
                  className="flex-1 rounded px-2 py-1.5 text-xs font-medium"
                  style={person === p.id
                    ? { background: personColor(p.id), color: "white" }
                    : { color: "var(--muted-foreground)" }}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <Button className="w-full" disabled={!name || !amount || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}