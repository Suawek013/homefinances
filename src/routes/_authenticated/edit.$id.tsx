import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getExpense, updateExpense } from "@/lib/expenses.functions";
import { useAllCategories } from "@/lib/use-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/edit/$id")({
  component: EditPage,
});

function EditPage() {
  const t = useT();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const cats = useAllCategories();
  const exp = useQuery({ queryKey: ["expense", id], queryFn: () => getExpense({ data: { id } }) });

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("food");
  const [spentOn, setSpentOn] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (exp.data) {
      setAmount(String(exp.data.amount));
      setCategory(exp.data.category);
      setSpentOn(exp.data.spent_on);
      setDescription(exp.data.description ?? "");
    }
  }, [exp.data]);

  const save = useMutation({
    mutationFn: () =>
      updateExpense({
        data: {
          id,
          amount: Number(amount),
          category,
          spent_on: spentOn,
          description,
          receipt_id: exp.data?.receipt_id ?? null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success(t("common.save"));
      navigate({ to: "/" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (exp.isLoading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t("common.edit")}</h2>

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
        <Button onClick={() => save.mutate()} disabled={!amount || save.isPending} className="flex-1">
          {save.isPending ? t("common.saving") : t("common.save")}
        </Button>
        <Button variant="ghost" onClick={() => navigate({ to: "/" })}>{t("common.cancel")}</Button>
      </div>
    </div>
  );
}