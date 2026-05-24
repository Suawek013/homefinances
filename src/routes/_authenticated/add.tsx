import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createExpense } from "@/lib/expenses.functions";
import { uploadAndParseReceipt } from "@/lib/receipts.functions";
import { useAllCategories } from "@/lib/use-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/add")({
  component: AddPage,
});

function AddPage() {
  const t = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const cats = useAllCategories();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("food");
  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      createExpense({
        data: {
          amount: Number(amount),
          category,
          spent_on: spentOn,
          description,
          receipt_id: receiptId,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success(t("add.title"));
      navigate({ to: "/" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(file: File) {
    setScanning(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const base64 = btoa(bin);
      const res = await uploadAndParseReceipt({
        data: { base64, mimeType: file.type || "image/jpeg" },
      });
      setReceiptId(res.receipt.id);
      if (res.extracted_total) setAmount(String(res.extracted_total));
      if (res.merchant) setDescription(res.merchant);
      if (res.date) setSpentOn(res.date);
      toast.success("OK");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t("add.title")}</h2>

      <label className="block">
        <div className="cursor-pointer rounded-xl border border-dashed border-border bg-card p-4 text-center text-sm text-muted-foreground hover:bg-muted/50">
          {scanning ? t("add.scanning") : t("add.scan")}
        </div>
        <input type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>

      <div className="space-y-1">
        <Label>{t("add.amount")}</Label>
        <Input type="number" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>

      <div className="space-y-1">
        <Label>{t("add.category")}</Label>
        <div className="grid grid-cols-4 gap-2">
          {cats.list.map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-xs ${active ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                <c.icon className="h-5 w-5" style={{ color: c.color }} />
                <span className="line-clamp-1">{c.label.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <Label>{t("add.date")}</Label>
        <Input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
      </div>

      <div className="space-y-1">
        <Label>{t("add.note")}</Label>
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="flex gap-2">
        <Button onClick={() => create.mutate()} disabled={!amount || create.isPending} className="flex-1">
          {create.isPending ? t("common.saving") : t("common.save")}
        </Button>
        <Button variant="ghost" onClick={() => navigate({ to: "/" })}>{t("common.cancel")}</Button>
      </div>
    </div>
  );
}