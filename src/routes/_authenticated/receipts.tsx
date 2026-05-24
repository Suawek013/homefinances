import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listReceipts, deleteReceipt } from "@/lib/receipts.functions";
import { formatMoney } from "@/lib/categories";
import { useMe, memberName } from "@/lib/me";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/receipts")({
  component: ReceiptsPage,
});

function ReceiptsPage() {
  const list = useQuery({ queryKey: ["receipts"], queryFn: () => listReceipts() });
  const me = useMe();
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: (id: string) => deleteReceipt({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["receipts"] }); toast.success("Deleted"); },
  });
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Receipts</h2>
      <div className="grid grid-cols-2 gap-3">
        {(list.data ?? []).map((r) => (
          <div key={r.id} className="overflow-hidden rounded-xl border border-border bg-card">
            <img src={r.public_url} alt="receipt" className="aspect-square w-full object-cover" />
            <div className="p-2 text-xs">
              <p className="font-medium">{r.extracted_total != null ? formatMoney(Number(r.extracted_total)) : "—"}</p>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{memberName(me.data?.members ?? [], r.user_id)}</span>
                <button onClick={() => del.mutate(r.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {(!list.data || list.data.length === 0) && <p className="text-sm text-muted-foreground">No receipts yet.</p>}
    </div>
  );
}