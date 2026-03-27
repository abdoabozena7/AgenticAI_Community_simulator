import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Compass, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const rtl = language === "ar";
  const t = (en: string, ar: string) => (rtl ? ar : en);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const shellClass = cn(
    "min-h-screen",
    theme === "dark"
      ? "text-white [--bg:#050505] [--surface:#101010] [--surface-2:#171717] [--ink:#f3f3f3] [--muted:#a3a3a3]"
      : "text-[#100c3d] [--bg:#f5f6f8] [--surface:#ffffff] [--surface-2:#eceef2] [--ink:#100c3d] [--muted:#637083]",
  );

  return (
    <div dir={rtl ? "rtl" : "ltr"} className={shellClass} style={{ background: "var(--bg)" }}>
      <div className="mx-auto flex min-h-screen max-w-4xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(280px,0.88fr)]">
          <section className="rounded-[32px] border border-white/10 bg-[color:var(--surface)] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:p-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--surface-2)] px-4 py-2 text-sm text-[color:var(--ink)]">
              <Compass className="h-4 w-4" />
              {t("Lost route", "مسار غير موجود")}
            </div>

            <h1 className="mt-6 font-['Be_Vietnam_Pro'] text-6xl font-semibold tracking-[-0.08em] text-[color:var(--ink)] sm:text-7xl">
              404
            </h1>

            <h2 className="mt-4 font-['IBM_Plex_Sans_Arabic'] text-3xl font-semibold tracking-[-0.04em] text-[color:var(--ink)]">
              {t("Page not found", "الصفحة غير موجودة")}
            </h2>

            <p className="mt-4 max-w-2xl text-base leading-8 text-[color:var(--muted)]">
              {t(
                "The route you opened does not exist in this system. Return to the working surface or navigate elsewhere.",
                "المسار الذي فتحته غير موجود داخل هذا النظام. ارجع إلى مساحة العمل أو انتقل إلى مكان آخر.",
              )}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => navigate("/")}
                className="h-12 rounded-2xl bg-[color:var(--ink)] text-[color:var(--surface)] hover:opacity-90"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("Return home", "العودة للرئيسية")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/dashboard")}
                className="h-12 rounded-2xl border-white/10 bg-transparent text-[color:var(--ink)]"
              >
                <Sparkles className="h-4 w-4" />
                {t("Go to dashboard", "الذهاب إلى اللوحة")}
              </Button>
            </div>
          </section>

          <aside className="rounded-[32px] border border-white/10 bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <div className="rounded-[28px] bg-[color:var(--surface-2)] p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
                {t("Recovery", "استعادة")}
              </p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
                {t(
                  "Use the dashboard or home route to continue. The app theme remains active here too.",
                  "استخدم اللوحة أو الصفحة الرئيسية للمتابعة. ثيم التطبيق يظل نشطًا هنا أيضًا.",
                )}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
