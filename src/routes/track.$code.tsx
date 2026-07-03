import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wrench, ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { statusBadgeClass, type RepairStatus } from "@/lib/repair-status";
import {
  SUPPORTED_LANGUAGES,
  STATUS_LABEL_I18N,
  UI,
  DEFAULT_LANGUAGE,
  isLanguageCode,
  getDirection,
  type LanguageCode,
} from "@/lib/i18n";

export const Route = createFileRoute("/track/$code")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: `Repair ${params.code} — MP Repair` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TrackDetail,
});

type PublicJob = {
  ticket_code: string;
  device_brand: string;
  device_model: string;
  status: RepairStatus;
  estimated_ready_at: string | null;
  created_at: string;
  updated_at: string;
  customer_language?: LanguageCode;
};

type PublicNote = {
  id: string;
  body: string;
  created_at: string;
};

const TIMELINE: RepairStatus[] = ["received", "diagnosing", "repairing", "ready", "delivered"];
const STORAGE_KEY = "MP Repair.trackLang";

function TrackDetail() {
  const { code } = Route.useParams();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [notes, setNotes] = useState<PublicNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lang, setLang] = useState<LanguageCode>(() => {
    if (typeof window === "undefined") return DEFAULT_LANGUAGE;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLanguageCode(stored) ? stored : DEFAULT_LANGUAGE;
  });
  const [langTouched, setLangTouched] = useState(false);

  const t = UI[lang];
  const dir = getDirection(lang);
  const statusLabels = STATUS_LABEL_I18N[lang];

  useEffect(() => {
    (async () => {
      const { data: jobData } = await supabase
        .from("repair_jobs")
        .select("id, ticket_code, device_brand, device_model, status, estimated_ready_at, created_at, updated_at, customer_id")
        .eq("ticket_code", code.trim())
        .maybeSingle();
      if (!jobData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      // Fetch customer's preferred language (public tracking policy allows this)
      let customerLang: LanguageCode | undefined;
      const custId = (jobData as { customer_id?: string }).customer_id;
      if (custId) {
        const { data: cust } = await supabase
          .from("customers")
          .select("preferred_language")
          .eq("id", custId)
          .maybeSingle();
        const pl = (cust as { preferred_language?: string } | null)?.preferred_language;
        if (isLanguageCode(pl)) customerLang = pl;
      }
      setJob({ ...(jobData as unknown as PublicJob), customer_language: customerLang });
      // Default to customer's language unless the visitor already chose one
      if (!langTouched && customerLang && typeof window !== "undefined") {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!isLanguageCode(stored)) setLang(customerLang);
      }
      const { data: noteData } = await supabase
        .from("repair_notes")
        .select("id, body, created_at")
        .eq("job_id", (jobData as { id: string }).id)
        .eq("is_public", true)
        .order("created_at", { ascending: false });
      setNotes((noteData ?? []) as PublicNote[]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.dir = dir;
  }, [dir]);

  function onLangChange(v: string) {
    if (!isLanguageCode(v)) return;
    setLang(v);
    setLangTouched(true);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, v);
  }

  const localeForDate = useMemo(() => {
    const map: Record<LanguageCode, string> = {
      en: "en-US",
      ar: "ar",
      hi: "hi-IN",
      es: "es-ES",
      te: "te-IN",
    };
    return map[lang];
  }, [lang]);

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col" dir={dir}>
      <header className="h-16 border-b bg-card flex items-center px-6 gap-3">
        <Link to="/track" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <Wrench className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">{t.brand}</span>
        </Link>
        <div className="ms-auto">
          <LanguagePicker value={lang} onChange={onLangChange} label={t.language} />
        </div>
      </header>
      <main className="flex-1 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Link
            to="/track"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> {t.lookupAnother}
          </Link>

          {loading ? (
            <div className="bg-card border rounded-xl p-10 text-center text-sm text-muted-foreground">
              {t.loading}
            </div>
          ) : notFound || !job ? (
            <div className="bg-card border rounded-xl p-10 text-center">
              <p className="font-medium mb-1">{t.notFoundTitle}</p>
              <p className="text-sm text-muted-foreground">
                {t.notFoundHint} <span className="font-mono">{code}</span>
              </p>
            </div>
          ) : (
            <>
              <div className="bg-card border rounded-xl p-6 shadow-[var(--shadow-card)]">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-mono text-sm text-muted-foreground">{job.ticket_code}</div>
                    <h1 className="text-2xl font-semibold mt-1">
                      {job.device_brand} {job.device_model}
                    </h1>
                  </div>
                  <span className={statusBadgeClass(job.status) + " text-sm px-3 py-1"}>
                    {statusLabels[job.status]}
                  </span>
                </div>

                {job.estimated_ready_at && job.status !== "delivered" && job.status !== "cancelled" && (
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {t.estimatedReady}{" "}
                    <strong>{new Date(job.estimated_ready_at).toLocaleDateString(localeForDate)}</strong>
                  </div>
                )}

                <Timeline current={job.status} labels={statusLabels} awaitingPartsBadge={t.awaitingPartsBadge} cancelledMsg={t.cancelledMsg} />

                <div className="text-xs text-muted-foreground mt-6">
                  {t.lastUpdated} {new Date(job.updated_at).toLocaleString(localeForDate)}
                </div>
              </div>

              <div className="bg-card border rounded-xl p-6 mt-4 shadow-[var(--shadow-card)]">
                <h2 className="font-semibold mb-3">{t.updatesTitle}</h2>
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.noUpdates}</p>
                ) : (
                  <ol className="space-y-4">
                    {notes.map((n) => (
                      <li key={n.id} className="border-s-2 border-primary/40 ps-3">
                        <div className="text-xs text-muted-foreground">
                          {new Date(n.created_at).toLocaleString(localeForDate)}
                        </div>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{n.body}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Timeline({
  current,
  labels,
  awaitingPartsBadge,
  cancelledMsg,
}: {
  current: RepairStatus;
  labels: Record<RepairStatus, string>;
  awaitingPartsBadge: string;
  cancelledMsg: string;
}) {
  if (current === "cancelled") {
    return (
      <div className="mt-6 rounded-md bg-destructive/10 text-destructive text-sm p-3">
        {cancelledMsg}
      </div>
    );
  }
  const idx = TIMELINE.indexOf(current);
  const effectiveIdx =
    idx === -1 ? (current === "awaiting_parts" ? TIMELINE.indexOf("diagnosing") : 0) : idx;
  return (
    <div className="mt-6 space-y-3">
      {TIMELINE.map((s, i) => {
        const done = i < effectiveIdx || (i === effectiveIdx && current !== "awaiting_parts");
        const active = i === effectiveIdx;
        return (
          <div key={s} className="flex items-center gap-3">
            <div
              className={
                "h-6 w-6 rounded-full flex items-center justify-center text-xs shrink-0 " +
                (done
                  ? "bg-success text-success-foreground"
                  : active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground")
              }
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <div className="text-sm">
              <div className={active ? "font-medium" : done ? "" : "text-muted-foreground"}>
                {labels[s]}
              </div>
              {active && current === "awaiting_parts" && (
                <div className="text-xs text-warning">{awaitingPartsBadge}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LanguagePicker({
  value,
  onChange,
  label,
}: {
  value: LanguageCode;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border bg-background px-2 text-sm"
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
