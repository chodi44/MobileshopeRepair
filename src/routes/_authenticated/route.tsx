import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Users,
  Wrench,
  Smartphone,
  Package,
  Receipt,
  LogOut,
  Menu,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/auth",
        search: { redirect: location.href },
      });
    }
  },
  component: AuthenticatedLayout,
});

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  disabled?: boolean;
};
const nav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/repairs", label: "Repairs", icon: Wrench },
  { to: "/history", label: "History", icon: History },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/devices", label: "Devices", icon: Smartphone, disabled: true },
  { to: "/inventory", label: "Inventory", icon: Package, disabled: true },
  { to: "/billing", label: "Billing", icon: Receipt, disabled: true },
];


function AuthenticatedLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!session) navigate({ to: "/auth", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data?.length) {
          const roles = data.map((r) => r.role);
          setRole(roles.includes("admin") ? "admin" : roles[0]);
        }
      });
  }, [user]);

  useEffect(() => setMobileOpen(false), [pathname]);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  const activeLabel =
    nav.find((n) => pathname === n.to || pathname.startsWith(n.to + "/"))?.label ?? "FixCell";
  const activeIndex = nav.findIndex(
    (n) => pathname === n.to || pathname.startsWith(n.to + "/"),
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="h-16 flex items-center gap-3 px-5 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded-sm bg-sidebar-primary flex items-center justify-center">
            <Wrench className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="display text-lg text-sidebar-accent-foreground">FixCell</span>
            <span className="eyebrow mt-0.5">Command Center</span>
          </div>
        </div>
        <div className="px-5 pt-4 pb-2 eyebrow text-sidebar-foreground/60">Workspace</div>
        <nav className="flex-1 px-3 pb-3 space-y-0.5">
          {nav.map((item, i) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            const idx = String(i + 1).padStart(2, "0");
            if (item.disabled) {
              return (
                <div
                  key={item.to}
                  className="group flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/35 cursor-not-allowed"
                  title="Coming in a later phase"
                >
                  <span className="num text-[10px] w-6 text-sidebar-foreground/25">{idx}</span>
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  <span className="ml-auto text-[9px] uppercase tracking-widest">soon</span>
                </div>
              );
            }
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group relative flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-sidebar-primary" />
                )}
                <span
                  className={cn(
                    "num text-[10px] w-6",
                    active ? "text-sidebar-primary" : "text-sidebar-foreground/40",
                  )}
                >
                  {idx}
                </span>
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2">
            <div className="eyebrow text-sidebar-foreground/50 mb-1">Signed in</div>
            <div className="text-sm font-medium truncate text-sidebar-accent-foreground">
              {user?.email}
            </div>
            <div className="text-xs text-sidebar-foreground/60 capitalize num">
              {role ? `role · ${role}` : "…"}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start gap-2 text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">
        <header className="h-16 bg-background/85 backdrop-blur border-b flex items-center gap-3 px-4 md:px-8 sticky top-0 z-20">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-baseline gap-3 min-w-0">
            <span className="eyebrow hidden sm:inline">
              {activeIndex >= 0 ? String(activeIndex + 1).padStart(2, "0") : "—"}
            </span>
            <h1 className="display text-2xl md:text-3xl truncate text-ink">{activeLabel}</h1>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="kbd">FixCell</span>
            <span className="num">v1.0</span>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 grid-paper">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

