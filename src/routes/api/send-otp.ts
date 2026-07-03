import { createAPIFileRoute } from "@tanstack/react-start/api";
import nodemailer from "nodemailer";
import { generateAndStoreOtp } from "@/lib/otp-store";

const OWNER_EMAIL = "mobilepointkakinada@gmail.com";

export const APIRoute = createAPIFileRoute("/api/send-otp")({
  POST: async () => {
    try {
      const otp = generateAndStoreOtp();

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: `"FixCell Security" <${process.env.GMAIL_USER}>`,
        to: OWNER_EMAIL,
        subject: `FixCell Password Change OTP: ${otp}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #0f172a; margin-bottom: 8px;">🔐 FixCell Password Change</h2>
            <p style="color: #64748b; font-size: 14px;">Someone requested a password change for all staff accounts.</p>
            <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #3b82f6;">${otp}</div>
            </div>
            <p style="color: #64748b; font-size: 13px;">This OTP expires in <strong>5 minutes</strong>.</p>
            <p style="color: #64748b; font-size: 13px;">If you did not request this, ignore this email. Your password will NOT change.</p>
          </div>
        `,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[send-otp]", err);
      return new Response(JSON.stringify({ error: "Failed to send OTP email" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
});
