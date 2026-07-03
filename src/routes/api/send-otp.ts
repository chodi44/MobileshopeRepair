import { createAPIFileRoute } from "@tanstack/react-start/api";
import { Resend } from "resend";
import { generateAndStoreOtp } from "@/lib/otp-store";

const OWNER_EMAIL = "mobilepointkakinada@gmail.com";

export const APIRoute = createAPIFileRoute("/api/send-otp")({
  POST: async () => {
    try {
      if (!process.env.RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY environment variable is not set");
      }

      const otp = generateAndStoreOtp();
      const resend = new Resend(process.env.RESEND_API_KEY);

      const { data, error } = await resend.emails.send({
        from: "MP Repair Security <onboarding@resend.dev>",
        to: OWNER_EMAIL,
        subject: `MP Repair Password Change OTP: ${otp}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #0f172a; margin-bottom: 8px;">🔐 MP Repair Password Change</h2>
            <p style="color: #64748b; font-size: 14px;">Someone requested a password change for all staff accounts.</p>
            <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #3b82f6;">${otp}</div>
            </div>
            <p style="color: #64748b; font-size: 13px;">This OTP expires in <strong>5 minutes</strong>.</p>
            <p style="color: #64748b; font-size: 13px;">If you did not request this, ignore this email. Your password will NOT change.</p>
          </div>
        `,
      });

      if (error) {
        console.error("[send-otp] Resend API error:", error);
        return new Response(
          JSON.stringify({ error: `Email service error: ${error.message}` }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }

      console.log("[send-otp] OTP email sent, id:", data?.id);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[send-otp] Exception:", msg);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
});
