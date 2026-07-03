import { createAPIFileRoute } from "@tanstack/react-start/api";
import { createClient } from "@supabase/supabase-js";
import { verifyOtp } from "@/lib/otp-store";


// All 3 staff email accounts
const STAFF_EMAILS = [
  "mobilepointms@kkd.com",
  "mobilepointms@kkd2.com",
  "mobilepointms@kkd3.com",
];

export const APIRoute = createAPIFileRoute("/api/change-all-passwords")({
  POST: async ({ request }) => {
    try {
      const { otp, newPassword } = await request.json();

      if (!otp || !newPassword) {
        return new Response(JSON.stringify({ error: "OTP and new password are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (newPassword.length < 8) {
        return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Verify OTP using our custom store (paired with Gmail send)
      if (!verifyOtp(otp)) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired OTP. Request a new one." }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      // Use Supabase Admin client
      const adminClient = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );

      // OTP verified — change password for all 3 staff accounts
      const { data: users } = await adminClient.auth.admin.listUsers();
      const results: { email: string; success: boolean; error?: string }[] = [];

      for (const email of STAFF_EMAILS) {
        const user = users?.users.find((u) => u.email === email);
        if (!user) {
          results.push({ email, success: false, error: "User not found in Supabase" });
          continue;
        }
        const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
          password: newPassword,
        });
        results.push({ email, success: !updateError, error: updateError?.message });
      }

      const anySuccess = results.some((r) => r.success);
      return new Response(
        JSON.stringify({ success: anySuccess, allUpdated: results.every((r) => r.success), results }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } catch (err) {
      console.error("[change-all-passwords]", err);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
});
