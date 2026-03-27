import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Scale, Sparkles, Gavel, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { apiService } from "@/services/api";
import { cn } from "@/lib/utils";

function Panel({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[color:var(--surface)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Idea Court</p>
          <h2 className="mt-2 text-lg font-semibold text-[color:var(--ink)]">{title}</h2>
          <p className="mt-2 max-w-xl text-sm leading-7 text-[color:var(--muted)]">{description}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--surface-2)] text-[color:var(--ink)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {children}
    </section>
  );
}

export default function IdeaCourtPage() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [idea, setIdea] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rtl = language === "ar";
  const t = (en: string, ar: string) => (rtl ? ar : en);

  useEffect(() => {
    const pending = localStorage.getItem("pendingCourtIdea");
    if (pending) {
      setIdea(pending);
      localStorage.removeItem("pendingCourtIdea");
    }
  }, []);

  const runCourt = async () => {
    if (!idea.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiService.runCourt({ idea: idea.trim() });
      setResult(res);
    } catch (e: any) {
      setError(e?.message || t("Failed to run Idea Court.", "فشل تشغيل محكمة الأفكار."));
    } finally {
      setLoading(false);
    }
  };

  const shellClass = cn(
    "min-h-screen",
    theme === "dark"
      ? "text-white [--bg:#050505] [--surface:#101010] [--surface-2:#171717] [--ink:#f3f3f3] [--muted:#a3a3a3]"
      : "text-[#100c3d] [--bg:#f5f6f8] [--surface:#ffffff] [--surface-2:#eceef2] [--ink:#100c3d] [--muted:#637083]",
  );

  return (
    <div dir={rtl ? "rtl" : "ltr"} className={shellClass} style={{ background: "var(--bg)" }}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[30px] border border-white/10 bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[color:var(--muted)]">
                {t("Decision Surface", "مساحة قرار")}
              </p>
              <h1 className="mt-3 font-['IBM_Plex_Sans_Arabic'] text-4xl font-semibold tracking-[-0.05em] text-[color:var(--ink)] sm:text-5xl">
                {t("Idea Court", "محكمة الأفكار")}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-[color:var(--muted)]">
                {t(
                  "Test a single idea, inspect the arguments, and keep the output close to the system theme.",
                  "اختبر فكرة واحدة، وراجع الحجج، واحفظ المظهر متسقًا مع ثيم النظام.",
                )}
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--surface-2)] px-4 py-2 text-sm text-[color:var(--ink)]">
              <Scale className="h-4 w-4" />
              {loading ? t("Running", "جاري التشغيل") : t("Ready", "جاهز")}
            </div>
          </div>
        </motion.header>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
          <Panel
            title={t("Input", "المدخل")}
            description={t(
              "Write the idea you want judged by the court.",
              "اكتب الفكرة التي تريد أن تفصل فيها المحكمة.",
            )}
            icon={Gavel}
          >
            <div className="space-y-4">
              <Textarea
                style={{ minHeight: 180 }}
                className="rounded-2xl border-white/10 bg-[color:var(--surface-2)] text-[color:var(--ink)] placeholder:text-[color:var(--muted)]"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder={t("Write your idea...", "اكتب فكرتك...")}
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => void runCourt()}
                  disabled={loading || !idea.trim()}
                  className="h-12 rounded-2xl bg-[color:var(--ink)] text-[color:var(--surface)] hover:opacity-90"
                >
                  <Sparkles className="h-4 w-4" />
                  {loading ? t("Running...", "جارٍ التشغيل...") : t("Run Idea Court", "تشغيل المحكمة")}
                </Button>
              </div>
              {error ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel
            title={t("Verdict", "النتيجة")}
            description={t(
              "Structured output appears here after the run completes.",
              "ستظهر النتيجة المنظمة هنا بعد انتهاء التشغيل.",
            )}
            icon={FileText}
          >
            {result ? (
              <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-[color:var(--surface-2)] p-4 font-['Be_Vietnam_Pro'] text-sm leading-6 text-[color:var(--ink)]">
                {JSON.stringify(result, null, 2)}
              </pre>
            ) : (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-[color:var(--surface-2)] px-5 py-10 text-center text-[color:var(--muted)]">
                {t("Run a court pass to reveal the verdict.", "شغّل المحكمة لعرض النتيجة.")}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
