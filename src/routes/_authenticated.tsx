import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { createHousehold, joinByCode, previewInvite } from "@/lib/household.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LayoutDashboard, PlusCircle, Repeat, Receipt, Users, LogOut, Languages, Wallet, Menu, Check } from "lucide-react";
import { useI18n, useT } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        navigate({ to: "/login" });
      } else {
        setHasSession(true);
      }
      setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/login" });
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (checking || !hasSession) {
    return <LoadingScreen />;
  }
  return <HouseholdGate />;
}

function LoadingScreen() {
  const t = useT();
  return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">{t("common.loading")}</div>;
}

function HouseholdGate() {
  const { data, isLoading } = useMe();
  if (isLoading) {
    return <LoadingScreen />;
  }
  if (!data?.household) return <Onboarding />;
  return <Shell />;
}

function Shell() {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const view: "finances" | "expenses" = pathname.startsWith("/finances") ? "finances" : "expenses";
  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-base font-semibold tracking-tight">
              {view === "finances" ? t("fin.title") : t("app.title")}
            </h1>
            <Whoami />
          </div>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <SignOutButton />
            <ViewSwitcher view={view} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-4">
        <Outlet />
      </main>
      <BottomNav view={view} />
    </div>
  );
}

function ViewSwitcher({ view }: { view: "finances" | "expenses" }) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          aria-label="Switch view"
        >
          <Menu className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs">{t("view.switch")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/" })}>
          <LayoutDashboard className="h-4 w-4" />
          <span className="flex-1">{t("view.expenses")}</span>
          {view === "expenses" && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/finances" })}>
          <Wallet className="h-4 w-4" />
          <span className="flex-1">{t("view.finances")}</span>
          {view === "finances" && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <button
      onClick={() => setLang(lang === "en" ? "pl" : "en")}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
      aria-label="Change language"
    >
      <Languages className="h-4 w-4" />
      <span className="uppercase">{lang}</span>
    </button>
  );
}

function Whoami() {
  const { data } = useMe();
  if (!data) return null;
  return (
    <p className="text-xs text-muted-foreground">
      {data.household?.name} · {data.currentMember?.display_name}
    </p>
  );
}

function SignOutButton() {
  const t = useT();
  return (
    <button
      onClick={() => supabase.auth.signOut()}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
      aria-label={t("auth.signOut")}
    >
      <LogOut className="h-4 w-4" />
    </button>
  );
}

function BottomNav({ view }: { view: "finances" | "expenses" }) {
  const t = useT();
  const expensesItems: { to: "/" | "/add" | "/recurring" | "/receipts" | "/household"; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
    { to: "/", label: t("nav.home"), icon: LayoutDashboard, exact: true },
    { to: "/add", label: t("nav.add"), icon: PlusCircle },
    { to: "/recurring", label: t("nav.recurring"), icon: Repeat },
    { to: "/receipts", label: t("nav.receipts"), icon: Receipt },
    { to: "/household", label: t("nav.household"), icon: Users },
  ];
  const financesItems: { to: "/finances" | "/finances/add" | "/finances/recurring" | "/household"; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
    { to: "/finances", label: t("nav.home"), icon: Wallet, exact: true },
    { to: "/finances/add", label: t("nav.add"), icon: PlusCircle },
    { to: "/finances/recurring", label: t("nav.recurring"), icon: Repeat },
    { to: "/household", label: t("nav.household"), icon: Users },
  ];
  const items = view === "finances" ? financesItems : expensesItems;
  const cols = items.length === 4 ? "grid-cols-4" : items.length === 5 ? "grid-cols-5" : "grid-cols-6";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur">
      <div className={`mx-auto grid w-full max-w-xl ${cols}`}>
        {items.map((it) => (
          <Link
            key={it.to}
            to={it.to}
            className="flex flex-col items-center gap-1 py-2 text-xs text-muted-foreground"
            activeOptions={{ exact: it.exact ?? false }}
            activeProps={{ className: "flex flex-col items-center gap-1 py-2 text-xs text-primary" }}
          >
            <it.icon className="h-5 w-5" />
            <span>{it.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

function Onboarding() {
  const t = useT();
  const { data, refetch } = useMe();
  const defaultName = data?.user.name ?? "";
  const [mode, setMode] = useState<"create" | "join">("create");
  const [householdName, setHouseholdName] = useState("Our household");
  const [displayName, setDisplayName] = useState(defaultName);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (defaultName && !displayName) setDisplayName(defaultName); }, [defaultName, displayName]);

  const preview = useQuery({
    queryKey: ["invite-preview", code],
    queryFn: () => previewInvite({ data: { code: code.trim().toUpperCase() } }),
    enabled: mode === "join" && code.trim().length >= 4,
  });

  async function submit() {
    if (!displayName.trim()) return toast.error("Enter your name");
    setSubmitting(true);
    try {
      if (mode === "create") {
        await createHousehold({ data: { name: householdName.trim() || "My household", display_name: displayName.trim() } });
      } else {
        await joinByCode({ data: { code: code.trim().toUpperCase(), display_name: displayName.trim() } });
      }
      await refetch();
      toast.success("You're in!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <h1 className="text-xl font-semibold">{t("onboard.welcome")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("onboard.subtitle")}</p>
        </div>
        <div className="flex rounded-full bg-muted p-1 text-sm">
          <button onClick={() => setMode("create")} className={`flex-1 rounded-full py-1.5 ${mode === "create" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{t("onboard.createNew")}</button>
          <button onClick={() => setMode("join")} className={`flex-1 rounded-full py-1.5 ${mode === "join" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{t("onboard.joinCode")}</button>
        </div>
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="space-y-1">
            <Label htmlFor="dn">{t("onboard.yourName")}</Label>
            <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Slawek" />
          </div>
          {mode === "create" ? (
            <div className="space-y-1">
              <Label htmlFor="hn">{t("onboard.householdName")}</Label>
              <Input id="hn" value={householdName} onChange={(e) => setHouseholdName(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="cd">{t("onboard.inviteCode")}</Label>
              <Input id="cd" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD1234" />
              {preview.data && preview.data.valid && (
                <p className="text-xs text-emerald-600">Joining {preview.data.household_name}</p>
              )}
              {preview.data && !preview.data.valid && (
                <p className="text-xs text-destructive">Code {preview.data.reason}</p>
              )}
            </div>
          )}
          <Button onClick={submit} disabled={submitting} className="w-full">
            {submitting ? t("onboard.working") : mode === "create" ? t("onboard.create") : t("onboard.join")}
          </Button>
        </div>
      </div>
    </div>
  );
}