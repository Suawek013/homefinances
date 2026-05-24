import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useT, useI18n } from "@/lib/i18n";
import { Languages } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const t = useT();
  const { lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function signIn() {
    setLoading(true);
    try {
      const res = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (res?.error) toast.error(res.error.message ?? "Sign-in failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <button
        onClick={() => setLang(lang === "en" ? "pl" : "en")}
        className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
      >
        <Languages className="h-4 w-4" />
        <span className="uppercase">{lang}</span>
      </button>
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("app.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("auth.signInPrompt")}</p>
        </div>
        <Button onClick={signIn} disabled={loading} className="w-full" size="lg">
          {loading ? t("auth.opening") : t("auth.continueGoogle")}
        </Button>
      </div>
    </div>
  );
}