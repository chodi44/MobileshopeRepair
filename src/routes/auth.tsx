import { createFileRoute, Link, redirect, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Wrench, Eye, EyeOff, ShieldAlert } from "lucide-react";

// ─── Only these 3 emails are allowed to log in ───────────────────────────────
const ALLOWED_EMAILS = [
  "mobilepointms@kkd.com",
  "mobilepointms@kkd2.com",
  "mobilepointms@kkd3.com",
];

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: search.redirect ?? "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Sign in — MP Repair" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Minimum 8 characters").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [loading, setLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [blocked, setBlocked] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = credentialsSchema.safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    // ── Whitelist check ──────────────────────────────────────────────────────
    if (!ALLOWED_EMAILS.includes(parsed.data.email.toLowerCase())) {
      setBlocked(true);
      toast.error("Access denied. This email is not authorized.");
      return;
    }
    setBlocked(false);

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "Email or password is wrong."
          : error.message,
      );
      return;
    }
    toast.success("Signed in");
    navigate({ to: search.redirect ?? "/dashboard" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <Wrench className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-semibold tracking-tight">MP Repair</span>
        </div>
        <div className="bg-card border rounded-xl p-6 shadow-[var(--shadow-card)]">
          <h1 className="text-xl font-semibold text-center mb-1">Shop staff sign in</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Repair shop management console
          </p>

          {blocked && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 mb-4 text-sm text-destructive">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              This email is not authorized to access this system.
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={loginEmail}
                onChange={(e) => { setLoginEmail(e.target.value); setBlocked(false); }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link
              to="/change-password"
              className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
            >
              Change staff password
            </Link>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          Are you a customer?{" "}
          <a href="/track" className="text-primary hover:underline">
            Track your repair
          </a>
        </p>
      </div>
    </div>
  );
}
