import { createFileRoute } from "@tanstack/react-router";

const ADMIN_EMAIL = "mobilepointms@kkd.com";
const ADMIN_PASSWORD = "P@int888";

export const Route = createFileRoute("/api/public/seed-admin")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Check if user already exists
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
        if (listErr) {
          return new Response(JSON.stringify({ ok: false, error: listErr.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        const existing = list.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());

        let userId: string;
        if (existing) {
          const { data: updated, error: updErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            password: ADMIN_PASSWORD,
            email_confirm: true,
          });
          if (updErr) {
            return new Response(JSON.stringify({ ok: false, error: updErr.message }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          }
          userId = updated.user.id;
        } else {
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            email_confirm: true,
            user_metadata: { name: "Mobile Point Admin" },
          });
          if (createErr) {
            return new Response(JSON.stringify({ ok: false, error: createErr.message }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          }
          userId = created.user.id;
        }

        // Ensure admin role
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

        return new Response(
          JSON.stringify({ ok: true, email: ADMIN_EMAIL, message: "Admin account ready. You can log in now." }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
