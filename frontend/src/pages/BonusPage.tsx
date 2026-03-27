import { ArrowLeft, Gift, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

export default function BonusPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const rtl = language === "ar";
  const t = (en: string, ar: string) => (rtl ? ar : en);

  const shellClass = cn(
    "min-h-screen",
    theme === "dark"
      ? "text-white [--bg:#050505] [--surface:#101010] [--surface-2:#171717] [--ink:#f3f3f3] [--muted:#a3a3a3]"
      : "text-[#100c3d] [--bg:#f5f6f8] [--surface:#ffffff] [--surface-2:#eceef2] [--ink:#100c3d] [--muted:#637083]",
  );

  return (
    <div dir={rtl ? "rtl" : "ltr"} className={shellClass} style={{ background: "var(--bg)" }}>
      <div className="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
          <section className="rounded-[32px] border border-white/10 bg-[color:var(--surface)] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:p-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--surface-2)] px-4 py-2 text-sm text-[color:var(--ink)]">
              <Gift className="h-4 w-4" />
              {t("Bonus Credits", "الأرصدة الإضافية")}
            </div>

            <h1 className="mt-6 max-w-xl font-['IBM_Plex_Sans_Arabic'] text-4xl font-semibold tracking-[-0.05em] text-[color:var(--ink)] sm:text-5xl">
              {t("Bonus packs are coming soon", "حزم المكافآت قادمة قريبًا")}
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-8 text-[color:var(--muted)]">
              {t(
                "We are preparing bonus packs for teams, founders, and trial users. The layout stays aligned with the same system theme, with black-based dark mode and calm editorial spacing.",
                "نجهز حزم مكافآت للفرق والمؤسسين والمستخدمين التجريبيين. الواجهة تظل متسقة مع ثيم النظام نفسه، مع وضع ليلي قائم على الأسود ومسافات تحريرية هادئة.",
              )}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="h-12 rounded-2xl bg-[color:var(--ink)] text-[color:var(--surface)] hover:opacity-90"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("Back to dashboard", "العودة إلى اللوحة")}
              </Button>
            </div>
          </section>

          <aside className="rounded-[32px] border border-white/10 bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <div className="rounded-[28px] bg-[color:var(--surface-2)] p-6">
              <Sparkles className="h-7 w-7 text-[color:var(--ink)]" />
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
                {t("Status", "الحالة")}
              </p>
              <p className="mt-2 font-['Be_Vietnam_Pro'] text-2xl font-semibold text-[color:var(--ink)]">
                {t("In design", "قيد التصميم")}
              </p>
              <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
                {t(
                  "This section will host bonus offers, credit bundles, and campaign timing once the product flow is ready.",
                  "ستستضيف هذه المساحة عروض المكافآت وحزم الرصيد وتوقيت الحملات بمجرد جاهزية مسار المنتج.",
                )}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
