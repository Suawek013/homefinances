import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { addSavings } from "@/lib/finances.functions";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Minus } from "lucide-react";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/finances/add")({
  component: FinancesAdd,
});

function FinancesAdd() {
  const t = useT();
  const navigate = useNavigate();
  const me = useMe();
  const members = me.data?.members ?? [];
  const myUserId = me.data?.currentMember?.user_id ?? "";

  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [forUser, setForUser] = useState<string>(myUserId);
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));

  const add = useMutation({
    mutationFn: () => addSavings({
      data: {
        user_id: forUser || myUserId,
        amount: mode === "deposit" ? Number(amount) : -Number(amount),
        label,
        occurred_on: occurredOn,
      },
    }),
    onSuccess: () => {
      toast.success(t("common.add"));
      navigate({ to: "/finances" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-medium">{t("fin.savings")}</h2>

        <div className="flex gap-2">
          <button
            onClick={() => setMode("deposit")}
            className={`flex-1 rounded-md py-2 text-xs ${mode === "deposit" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            <Plus className="mr-1 inline h-3 w-3" />{t("fin.deposit")}
          </button>
          <button
            onClick={() => setMode("withdraw")}
            className={`flex-1 rounded-md py-2 text-xs ${mode === "withdraw" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"}`}
          >
            <Minus className="mr-1 inline h-3 w-3" />{t("fin.withdraw")}
          </button>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">{t("fin.forPerson")}</Label>
          <select
            value={forUser}
            onChange={(e) => setForUser(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
          >
            {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{t("add.amount") ?? "Amount"}</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("add.date") ?? "Date"}</Label>
            <Input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">{t("fin.labelPlaceholder")}</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("fin.labelPlaceholder")} />
        </div>

        <Button
          onClick={() => add.mutate()}
          disabled={!amount || Number(amount) <= 0 || !forUser || add.isPending}
          className="w-full"
        >
          {t("common.add")}
        </Button>
      </div>
    </div>
  );
}