import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/lib/me";
import { createInvite, listInvites, deleteInvite, leaveHousehold } from "@/lib/household.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/household")({
  component: HouseholdPage,
});

function HouseholdPage() {
  const t = useT();
  const me = useMe();
  const qc = useQueryClient();
  const invites = useQuery({ queryKey: ["invites"], queryFn: () => listInvites() });
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
      <h2 className="text-lg font-semibold">{t("hh.title")}</h2>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-medium">{me.data?.household?.name}</p>
        <ul className="mt-2 space-y-1 text-sm">
          {me.data?.members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
              {m.display_name}
              {m.user_id === me.data?.user.id && <span className="text-xs text-muted-foreground">{t("hh.you")}</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{t("hh.inviteCodes")}</h3>
          <Button size="sm" onClick={() => create.mutate()}>{t("hh.newInvite")}</Button>
        </div>
        <ul className="space-y-2">
          {(invites.data ?? []).map((inv) => (
            <li key={inv.code} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
              <div>
                <p className="font-mono">{inv.code}</p>
                <p className="text-xs text-muted-foreground">
                  {inv.used_at ? t("hh.used") : `${t("hh.expires")} ${new Date(inv.expires_at).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { navigator.clipboard.writeText(inv.code); toast.success(t("hh.codeCopied")); }} className="text-muted-foreground hover:text-foreground">
                  <Copy className="h-4 w-4" />
                </button>
                <button onClick={() => del.mutate(inv.code)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
          {(!invites.data || invites.data.length === 0) && <li className="text-sm text-muted-foreground">{t("hh.noInvites")}</li>}
        </ul>
      </div>

      <Button variant="outline" onClick={() => { if (confirm(t("hh.leaveConfirm"))) leave.mutate(); }}>
        {t("hh.leave")}
      </Button>
    </div>
  );
}