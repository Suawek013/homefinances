import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2 } from "lucide-react";
import { createExpense } from "@/lib/expenses.functions";
import { uploadAndParseReceipt } from "@/lib/receipts.functions";
import { CATEGORIES, type Category, formatMoney } from "@/lib/categories";
import { usePerson, PEOPLE, personColor, type PersonId } from "@/lib/person";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/add")({
  component: AddExpense,
  head: () => ({ meta: [{ title: "Add expense — Household Budget" }] }),
});

function AddExpense() {
  const { current } = usePerson();
  const nav = useNavigate();
  const qc = useQueryClient();

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("food");
  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [person, setPerson] = useState<PersonId>(current);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      createExpense({
        data: {
          amount: Number(amount),
          category,
          spent_on: spentOn,
          description,
          person_id: person,
          receipt_id: receiptId,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Expense added");
      nav({ to: "/" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const onFile = async (file: File) => {
    setScanning(true);
    setReceiptPreview(URL.createObjectURL(file));
    try {
      const base64 = await fileToBase64(file);
      const res = await uploadAndParseReceipt({
        data: { base64, mimeType: file.type || "image/jpeg", person_id: person },
      });
      setReceiptId(res.receipt.id);
      if (res.extracted_total != null) {
        setAmount(String(res.extracted_total));
        toast.success(`Detected total: ${formatMoney(res.extracted_total)}`);
      } else {
        toast.message("Receipt saved", { description: "Could not detect total — enter manually." });
      }
      if (res.merchant && !description) setDescription(res.merchant);
      if (res.date) setSpentOn(res.date);
    } catch (e) {
      toast.error("Failed to scan receipt: " + (e as Error).message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Add expense</h2>

      {/* Receipt scan */}
      <Card className="p-4">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Scan receipt (optional)
        </Label>
        <div className="mt-2 flex items-center gap-3">
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground hover:bg-muted">
            {scanning ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Camera className="h-5 w-5" />
            )}
            <span>{scanning ? "Scanning..." : "Snap or upload receipt"}</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </label>
          {receiptPreview && (
            <img src={receiptPreview} alt="receipt" className="h-16 w-16 rounded-lg object-cover" />
          )}
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <div>
          <Label>Amount (PLN)</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="mt-1 text-2xl font-semibold"
          />
        </div>

        <div>
          <Label>Category</Label>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {CATEGORIES.map((c) => {
              const active = category === c.id;
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className="flex flex-col items-center gap-1 rounded-xl border p-2 text-[10px] transition-all"
                  style={{
                    borderColor: active ? c.color : "var(--border)",
                    background: active ? `${c.color}18` : "transparent",
                  }}
                >
                  <Icon className="h-5 w-5" style={{ color: c.color }} />
                  <span className="text-center leading-tight">{c.label.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={spentOn}
              onChange={(e) => setSpentOn(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Who paid</Label>
            <div className="mt-1 flex rounded-md bg-muted p-1">
              {PEOPLE.map((p) => {
                const active = person === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPerson(p.id)}
                    className="flex-1 rounded px-2 py-1.5 text-xs font-medium"
                    style={
                      active
                        ? { background: personColor(p.id), color: "white" }
                        : { color: "var(--muted-foreground)" }
                    }
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <Label>Description (optional)</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Lidl weekly shop"
            rows={2}
            className="mt-1"
          />
        </div>

        <Button
          className="w-full"
          size="lg"
          disabled={!amount || Number(amount) <= 0 || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving..." : "Save expense"}
        </Button>
      </Card>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const idx = res.indexOf(",");
      resolve(idx >= 0 ? res.slice(idx + 1) : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}