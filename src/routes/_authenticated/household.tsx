import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/lib/me";
import { createInvite, listInvites, deleteInvite, leaveHousehold } from "@/lib/household.functions";
import { listCategoryBudgets, setCategoryBudget } from "@/lib/settings.functions";
import { CATEGORIES, formatMoney } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/household")({
  component: HouseholdPage,
});

function HouseholdPage() {
  const me = useMe();
  const qc = useQueryClient();
  const invites = useQuery({ queryKey: ["invites"], queryFn: () => listInvites() });
  const budgets = useQuery({ queryKey: ["cat-budgets"], queryFn: () => listCategoryBudgets() });
  const create = useMutation({
    mutationFn: () => createInvite(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (code: string) => deleteInvite({ data: { code } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites"] }),
  });
  const leave = useMutation({
    mutationFn: () => leaveHousehold(),
    onSuccess: () => qc.invalidateQueries(),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Household</h2>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-medium">{me.data?.household?.name}</p>
        <ul className="mt-2 space-y-1 text-sm">
          {me.data?.members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
              {m.display_name}
              {m.user_id === me.data?.user.id && <span className="text-xs text-muted-foreground">(you)</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Invite codes</h3>
          <Button size="sm" onClick={() => create.mutate()}>New invite</Button>
        </div>
        <ul className="space-y-2">
          {(invites.data ?? []).map((inv) => (
            <li key={inv.code} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
              <div>
                <p className="font-mono">{inv.code}</p>
                <p className="text-xs text-muted-foreground">
                  {inv.used_at ? "Used" : `Expires ${new Date(inv.expires_at).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { navigator.clipboard.writeText(inv.code); toast.success("Code copied"); }} className="text-muted-foreground hover:text-foreground">
                  <Copy className="h-4 w-4" />
                </button>
                <button onClick={() => del.mutate(inv.code)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
          {(!invites.data || invites.data.length === 0) && <li className="text-sm text-muted-foreground">No invites yet.</li>}
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-medium">Category budgets (optional)</h3>
        {CATEGORIES.map((c) => (
          <CategoryBudgetRow key={c.id} category={c.id} label={c.label} current={budgets.data?.find((b) => b.category === c.id)?.amount ?? null} />
        ))}
      </div>

      <Button variant="outline" onClick={() => { if (confirm("Leave household?")) leave.mutate(); }}>
        Leave household
      </Button>
    </div>
  );
}

function CategoryBudgetRow({ category, label, current }: { category: string; label: string; current: number | null }) {
  const [val, setVal] = useState(current?.toString() ?? "");
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (amount: number | null) => setCategoryBudget({ data: { category, amount } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cat-budgets"] }); toast.success("Saved"); },
  });
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-32 truncate">{label}</span>
      <Input type="number" placeholder="—" value={val} onChange={(e) => setVal(e.target.value)} className="h-8 flex-1" />
      <Button size="sm" variant="ghost" onClick={() => mut.mutate(val === "" ? null : Number(val))}>
        {current != null ? formatMoney(current) : "Save"}
      </Button>
    </div>
  );
}