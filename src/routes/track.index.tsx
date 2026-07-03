import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Search } from "lucide-react";
import { UI, DEFAULT_LANGUAGE, isLanguageCode, getDirection, type LanguageCode } from "@/lib/i18n";
import { LanguagePicker } from "./track.$code";

export const Route = createFileRoute("/track/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Track your repair — MP Repair" },
      { name: "description", content: "Enter your repair ticket code to see the latest status of your device." },
      { property: "og:title", content: "Track your repair — MP Repair" },
      { property: "og:description", content: "Enter your repair ticket code to see the latest status." },
    ],
  }),
  component: TrackHome,
});

const STORAGE_KEY = "MP Repair.trackLang";

function TrackHome() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [lang, setLang] = useState<LanguageCode>(() => {
    if (typeof window === "undefined") return DEFAULT_LANGUAGE;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLanguageCode(stored) ? stored : DEFAULT_LANGUAGE;
  });
  const t = UI[lang];
  const dir = getDirection(lang);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.dir = dir;
  }, [dir]);

  function onLangChange(v: string) {
    if (!isLanguageCode(v)) return;
    setLang(v);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, v);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) return;
    navigate({ to: "/track/$code", params: { code: c } });
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col" dir={dir}>
      <header className="h-16 border-b bg-card flex items-center px-6 gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <Wrench className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">{t.brand}</span>
        </div>
        <div className="ms-auto">
          <LanguagePicker value={lang} onChange={onLangChange} label={t.language} />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold text-center mb-2">{t.trackTitle}</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">{t.trackSubtitle}</p>
          <form
            onSubmit={submit}
            className="bg-card border rounded-xl p-6 shadow-[var(--shadow-card)] space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="code">{t.ticketCode}</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="FX-XXXXXX"
                autoFocus
                className="font-mono uppercase tracking-wider"
                maxLength={20}
                dir="ltr"
              />
            </div>
            <Button type="submit" className="w-full">
              <Search className="h-4 w-4 me-2" />
              {t.checkStatus}
            </Button>
          </form>
          <div className="mt-8 text-center">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
              {t.adminLogin}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
