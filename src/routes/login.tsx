import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success(lang === "pl" ? "Rejestracja pomyślna! Możesz się zalogować (sprawdź też email, by ewentualnie potwierdzić)." : "Sign up successful! You can now log in (check your email to verify if needed).");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Authentication failed");
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
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{t("app.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSignUp 
              ? (lang === "pl" ? "Utwórz nowe konto" : "Create a new account")
              : t("auth.signInPrompt")}
          </p>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{lang === "pl" ? "Hasło" : "Password"}</Label>
            <Input 
              id="password" 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          
          <Button disabled={loading} className="w-full" type="submit">
            {loading 
              ? (lang === "pl" ? "Ładowanie..." : "Loading...") 
              : isSignUp 
                ? (lang === "pl" ? "Zarejestruj się" : "Sign up")
                : (lang === "pl" ? "Zaloguj się" : "Sign in")}
          </Button>
        </form>

        <div className="text-center text-sm">
          <button 
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-primary hover:underline"
          >
            {isSignUp 
              ? (lang === "pl" ? "Masz już konto? Zaloguj się" : "Already have an account? Sign in")
              : (lang === "pl" ? "Nie masz konta? Zarejestruj się" : "Don't have an account? Sign up")}
          </button>
        </div>
      </div>
    </div>
  );
}