import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Wrench, Mail, Eye, EyeOff, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/change-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Change Password — MP Repair" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChangePasswordPage,
});

const OWNER_EMAIL = "mobilepointkakinada@gmail.com";
const OWNER_EMAIL_MASKED = "mobilepointkak***@gmail.com";

function ChangePasswordPage() {
  const [step, setStep] = useState<"request" | "verify">("request");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [changing, setChanging] = useState(false);

  // Send OTP using Gmail via server API
  async function sendOtp() {
    setSendingOtp(true);
    try {
      const res = await fetch("/api/send-otp", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send OTP");
      toast.success(`OTP sent to ${OWNER_EMAIL_MASKED} — check inbox & spam`);
      setStep("verify");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  }

  async function changePasswords(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim()) return toast.error("Enter the OTP from your email");
    if (newPassword.length < 8) return toast.error("Password must be at least 8 characters");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match");

    setChanging(true);
    try {
      const res = await fetch("/api/change-all-passwords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp, newPassword }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Failed to change password");
      }

      if (data.allUpdated) {
        toast.success("✅ Password changed for all 3 staff accounts!");
      } else {
        const failed = (data.results ?? []).filter((r: { success: boolean }) => !r.success);
        toast.warning(
          `Password changed for some accounts. ${failed.length} not updated — make sure all 3 emails are created in Supabase.`,
        );
      }

      setStep("request");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error changing password");
    } finally {
      setChanging(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <Wrench className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-semibold tracking-tight">MP Repair</span>
        </div>

        <div className="bg-card border rounded-xl p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 justify-center mb-1">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Change Staff Password</h1>
          </div>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Changes password for <strong>all 3</strong> staff accounts at once.
          </p>

          {step === "request" ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-1">
                <div className="font-medium">OTP will be sent to owner email:</div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  {OWNER_EMAIL_MASKED}
                </div>
                <div className="text-xs text-muted-foreground pt-1">
                  Sent via Supabase — check inbox and spam folder
                </div>
              </div>
              <Button className="w-full" onClick={sendOtp} disabled={sendingOtp}>
                {sendingOtp ? "Sending OTP…" : "Send OTP to Owner Email"}
              </Button>
            </div>
          ) : (
            <form onSubmit={changePasswords} className="space-y-4">
              <div className="rounded-lg border bg-blue-500/10 border-blue-500/20 p-3 text-sm text-blue-700 dark:text-blue-300">
                ✅ OTP sent to {OWNER_EMAIL_MASKED}. Check inbox (and spam folder).
              </div>

              <div className="space-y-2">
                <Label htmlFor="otp">Enter 6-digit OTP</Label>
                <Input
                  id="otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  placeholder="123456"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  className="text-center text-xl tracking-widest"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    required
                    className="pr-10"
                    autoComplete="new-password"
                    placeholder="Minimum 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                  placeholder="Repeat new password"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={changing}>
                  {changing ? "Changing all passwords…" : "Change All Passwords"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setStep("request"); setOtp(""); }}
                >
                  Resend
                </Button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to="/auth" className="text-primary hover:underline">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
