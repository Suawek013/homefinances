import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listCategoryBudgets, setCategoryBudget } from "@/lib/settings.functions";
import { listCustomCategories, createCustomCategory, deleteCustomCategory } from "@/lib/categories.functions";
import { formatMoney } from "@/lib/categories";
import { useAllCategories, CUSTOM_COLORS, CUSTOM_ICONS } from "@/lib/use-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/categories")({
  component: CategoriesPage,
});

function CategoriesPage() {
  const t = useT();
  const qc = useQueryClient();
  const cats = useAllCategories();
  const budgets = useQuery({ queryKey: ["cat-budgets"], queryFn: () => listCategoryBudgets() });
  const customCats = useQuery({ queryKey: ["custom-cats"], queryFn: () => listCustomCategories() });
  const addCat = useMutation({
    mutationFn: (v: { label: string; color: string; icon: string }) => createCustomCategory({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-cats"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const delCat = useMutation({
    mutationFn: (id: string) => deleteCustomCategory({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-cats"] }),
  });

  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(CUSTOM_COLORS[0]);
  const [newIcon, setNewIcon] = useState("Package");
  const iconNames = Object.keys(CUSTOM_ICONS);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t("cats.title")}</h2>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-medium">{t("cats.custom")}</h3>
        <ul className="space-y-1">
          {(customCats.data ?? []).map((c) => {
            const Icon = CUSTOM_ICONS[c.icon] ?? CUSTOM_ICONS.Package;
            return (
              <li key={c.id} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: c.color }} />
                  {c.label}
                </span>
                <button onClick={() => delCat.mutate(c.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
          {(!customCats.data || customCats.data.length === 0) && (
            <li className="text-xs text-muted-foreground">{t("hh.customNone")}</li>
          )}
        </ul>
        <div className="space-y-2 border-t border-border pt-3">
          <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder={t("hh.customLabel")} className="h-9" />
          <div className="flex flex-wrap gap-1">
            {CUSTOM_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`h-6 w-6 rounded-full border-2 ${newColor === c ? "border-foreground" : "border-transparent"}`}
                style={{ background: c }}
                aria-label="color"
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {iconNames.map((name) => {
              const Icon = CUSTOM_ICONS[name];
              return (
                <button
                  key={name}
                  onClick={() => setNewIcon(name)}
                  className={`flex h-8 w-8 items-center justify-center rounded-md border ${newIcon === name ? "border-primary bg-primary/10" : "border-border"}`}
                  aria-label={name}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
          <Button
            size="sm"
            className="w-full"
            disabled={!newLabel.trim() || addCat.isPending}
            onClick={() => addCat.mutate({ label: newLabel.trim(), color: newColor, icon: newIcon }, {
              onSuccess: () => { setNewLabel(""); toast.success(t("common.add")); },
            })}
          >
            <Plus className="mr-1 h-4 w-4" /> {t("hh.customAdd")}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-medium">{t("cats.budgets")}</h3>
        {cats.list.map((c) => (
          <CategoryBudgetRow key={c.id} category={c.id} label={c.label} current={budgets.data?.find((b) => b.category === c.id)?.amount ?? null} />
        ))}
      </div>
    </div>
  );
}

function CategoryBudgetRow({ category, label, current }: { category: string; label: string; current: number | null }) {
  const t = useT();
  const [val, setVal] = useState(current?.toString() ?? "");
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (amount: number | null) => setCategoryBudget({ data: { category, amount } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cat-budgets"] }); toast.success(t("common.save")); },
  });
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-32 truncate">{label}</span>
      <Input type="number" placeholder="—" value={val} onChange={(e) => setVal(e.target.value)} className="h-8 flex-1" />
      <Button size="sm" variant="ghost" onClick={() => mut.mutate(val === "" ? null : Number(val))}>
        {current != null ? formatMoney(current) : t("common.save")}
      </Button>
    </div>
  );
}