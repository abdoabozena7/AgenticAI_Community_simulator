import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  FileText,
  Globe2,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { apiService } from "@/services/api";
import { cn } from "@/lib/utils";

interface ResearchResult {
  search_results: unknown;
  structured: unknown;
  evidence_cards: { text: string }[];
  pages: { title: string; url: string; snippet?: string }[];
  map_data: unknown;
}

function Surface({
  title,
  eyebrow,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  eyebrow?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-white/10 bg-[color:var(--surface)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)]",
        className,
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-2 text-lg font-semibold text-[color:var(--ink)]">{title}</h2>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--surface-2)] text-[color:var(--ink)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {children}
    </section>
  );
}

export default function AgentResearchScreen() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(null);

  const rtl = language === "ar";
  const t = (en: string, ar: string) => (rtl ? ar : en);

  const shellClass = useMemo(
    () =>
      cn(
        "min-h-screen",
        theme === "dark"
          ? "text-white [--bg:#050505] [--surface:#101010] [--surface-2:#171717] [--ink:#f3f3f3] [--muted:#a3a3a3]"
          : "text-[#100c3d] [--bg:#f5f6f8] [--surface:#ffffff] [--surface-2:#eceef2] [--ink:#100c3d] [--muted:#637083]",
      ),
    [theme],
  );

  const runResearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res: ResearchResult = await apiService.runResearch(
        query.trim(),
        location.trim() || undefined,
        category.trim() || undefined,
      );
      setResult(res);
    } catch (err: any) {
      setError(err?.message || t("Failed to run research.", "فشل تشغيل البحث."));
    } finally {
      setLoading(false);
    }
  };

  const handleStartSimulation = async () => {
    if (!result) return;
    try {
      window.localStorage.setItem("pendingIdea", query.trim());
      window.localStorage.setItem("pendingAutoStart", "true");
      window.localStorage.setItem("dashboardIdea", query.trim());
      navigate("/simulate", {
        state: {
          idea: query.trim(),
          autoStart: true,
          source: "agent_research",
        },
      });
    } catch (err: any) {
      setError(err?.message || t("Unable to open the simulation flow.", "تعذر فتح مسار المحاكاة."));
    }
  };

  return (
    <div dir={rtl ? "rtl" : "ltr"} className={shellClass} style={{ background: "var(--bg)" }}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[30px] border border-white/10 bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_420px] lg:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[color:var(--muted)]">
                {t("Research Surface", "مساحة البحث")}
              </p>
              <h1 className="mt-3 font-['IBM_Plex_Sans_Arabic'] text-4xl font-semibold tracking-[-0.05em] text-[color:var(--ink)] sm:text-5xl">
                {t("Agent Research", "بحث الوكلاء")}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-[color:var(--muted)]">
                {t(
                  "Run a focused market research pass, review evidence, and promote the result into the simulation flow.",
                  "شغّل تمريرة بحث سوق مركزة، راجع الأدلة، ثم انقل النتيجة إلى مسار المحاكاة.",
                )}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl bg-[color:var(--surface-2)] p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted)]">
                  {t("Status", "الحالة")}
                </p>
                <p className="mt-2 font-['Be_Vietnam_Pro'] text-2xl font-semibold text-[color:var(--ink)]">
                  {loading ? t("Running", "جاري التشغيل") : t("Ready", "جاهز")}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => void runResearch()}
                disabled={loading || !query.trim()}
                className="h-12 rounded-2xl bg-[color:var(--ink)] text-[color:var(--surface)] hover:opacity-90"
              >
                <Search className="h-4 w-4" />
                {loading ? t("Searching...", "جاري البحث...") : t("Run research", "تشغيل البحث")}
              </Button>
            </div>
          </div>
        </motion.header>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
          <Surface title={t("Research Inputs", "مدخلات البحث")} eyebrow={t("Workspace", "مساحة العمل")} icon={Globe2}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  {t("Query", "الاستعلام")}
                </label>
                <Textarea
                  placeholder={t(
                    "Describe the market, product, or problem you want researched",
                    "صف السوق أو المنتج أو المشكلة التي تريد بحثها",
                  )}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="min-h-[140px] rounded-2xl border-white/10 bg-[color:var(--surface-2)] text-[color:var(--ink)] placeholder:text-[color:var(--muted)]"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {t("Location", "الموقع")}
                  </label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
                    <Input
                      placeholder={t("Optional place or city", "مكان أو مدينة اختيارية")}
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="rounded-2xl border-white/10 bg-[color:var(--surface-2)] pr-10 text-[color:var(--ink)] placeholder:text-[color:var(--muted)]"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {t("Category", "الفئة")}
                  </label>
                  <Input
                    placeholder={t("Optional category", "فئة اختيارية")}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="rounded-2xl border-white/10 bg-[color:var(--surface-2)] text-[color:var(--ink)] placeholder:text-[color:var(--muted)]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => void runResearch()}
                  disabled={loading || !query.trim()}
                  className="h-12 rounded-2xl bg-[color:var(--ink)] text-[color:var(--surface)] hover:opacity-90"
                >
                  <Sparkles className="h-4 w-4" />
                  {loading ? t("Working...", "جارٍ العمل...") : t("Run pipeline", "تشغيل المسار")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                  className="h-12 rounded-2xl border-white/10 bg-transparent text-[color:var(--ink)]"
                >
                  {t("Back to dashboard", "العودة إلى اللوحة")}
                </Button>
              </div>
            </div>
          </Surface>

          <div className="space-y-6">
            <Surface title={t("Output", "المخرجات")} eyebrow={t("Review", "مراجعة")} icon={FileText}>
              {error ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : result ? (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-[color:var(--surface-2)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      {t("Structured Summary", "ملخص منظم")}
                    </p>
                    <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words font-['Be_Vietnam_Pro'] text-sm leading-6 text-[color:var(--ink)]">
                      {JSON.stringify(result.structured, null, 2)}
                    </pre>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(result.evidence_cards || []).map((card, idx) => (
                      <div key={idx} className="rounded-2xl bg-[color:var(--surface-2)] p-4 text-sm text-[color:var(--ink)]">
                        {card.text}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {(result.pages || []).map((page, idx) => (
                      <a
                        key={idx}
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-2xl bg-[color:var(--surface-2)] p-4 transition hover:translate-y-[-1px]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-[color:var(--ink)]">{page.title || page.url}</p>
                          <ArrowRight className="h-4 w-4 text-[color:var(--muted)]" />
                        </div>
                        {page.snippet ? <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{page.snippet}</p> : null}
                      </a>
                    ))}
                  </div>
                  <Button
                    onClick={() => void handleStartSimulation()}
                    className="h-12 rounded-2xl bg-[color:var(--ink)] text-[color:var(--surface)] hover:opacity-90"
                  >
                    {t("Start simulation", "بدء المحاكاة")}
                  </Button>
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-white/10 bg-[color:var(--surface-2)] px-5 py-10 text-center text-[color:var(--muted)]">
                  {t("Run a research pass to reveal evidence and structured output.", "شغّل البحث لعرض الأدلة والنتيجة المنظمة.")}
                </div>
              )}
            </Surface>
          </div>
        </div>
      </div>
    </div>
  );
}
