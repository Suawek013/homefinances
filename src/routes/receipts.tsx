import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { listReceipts, deleteReceipt } from "@/lib/receipts.functions";
import { formatMoney } from "@/lib/categories";
import { personColor, personName } from "@/lib/person";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/receipts")({
  component: ReceiptsPage,
  head: () => ({ meta: [{ title: "Receipts — Household Budget" }] }),
});

function ReceiptsPage() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["receipts"],
    queryFn: () => listReceipts(),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteReceipt({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Deleted"); },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Receipts</h2>
        <p className="text-xs text-muted-foreground">Tap a receipt to view full-size</p>
      </div>
      {list.data?.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No receipts yet. Scan one from the Add screen.
        </Card>
      )}
      <div className="grid grid-cols-2 gap-3">
        {list.data?.map((r) => (
          <Card key={r.id} className="overflow-hidden p-0">
            <a href={r.public_url} target="_blank" rel="noreferrer">
              <img src={r.public_url} alt="receipt" className="aspect-square w-full object-cover" />
            </a>
            <div className="space-y-1 p-2">
              <div className="flex items-center justify-between">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                  style={{ background: personColor(r.person_id) }}
                >
                  {personName(r.person_id)}
                </span>
                <button
                  onClick={() => del.mutate(r.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="text-sm font-semibold">
                {r.extracted_total != null ? formatMoney(Number(r.extracted_total)) : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString("en-GB")}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}