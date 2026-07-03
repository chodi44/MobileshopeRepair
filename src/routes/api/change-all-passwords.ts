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

      // Verify OTP
      if (!verifyOtp(otp)) {
        return new Response(JSON.stringify({ error: "Invalid or expired OTP" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Use Supabase Admin client (service role key)
      const adminClient = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );

      const results: { email: string; success: boolean; error?: string }[] = [];

      for (const email of STAFF_EMAILS) {
        // Find user by email
        const { data: users, error: listError } = await adminClient.auth.admin.listUsers();
        if (listError) {
          results.push({ email, success: false, error: listError.message });
          continue;
        }

        const user = users.users.find((u) => u.email === email);
        if (!user) {
          // User doesn't exist yet — skip silently
          results.push({ email, success: false, error: "User not found in Supabase" });
          continue;
        }

        const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
          password: newPassword,
        });

        results.push({
          email,
          success: !updateError,
          error: updateError?.message,
        });
      }

      const allSuccess = results.every((r) => r.success);
      const anySuccess = results.some((r) => r.success);

      return new Response(
        JSON.stringify({
          success: anySuccess,
          allUpdated: allSuccess,
          results,
        }),
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
