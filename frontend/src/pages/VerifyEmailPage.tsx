import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, ShieldCheck, Sparkles } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { SystemChip, SystemPanel, SystemStat } from "@/components/system/Architect";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { apiService } from "@/services/api";

const authThemeVars = (theme: "dark" | "light") =>
  theme === "dark"
    ? {
        "--architect-bg": "#050505",
        "--architect-bg-secondary": "#0b0b0b",
        "--architect-glow-a": "rgba(255,255,255,0.03)",
        "--architect-glow-b": "rgba(0,106,97,0.06)",
        "--architect-ink": "#f4f5f7",
        "--architect-muted": "#b0b5bf",
        "--architect-subtle": "#858b96",
        "--architect-surface-0": "rgba(16,16,16,0.94)",
        "--architect-surface-1": "#121212",
        "--architect-surface-2": "#1a1a1a",
        "--architect-surface-strong": "rgba(24,24,24,0.96)",
        "--architect-contrast": "#f4f5f7",
        "--architect-contrast-ink": "#090909",
        "--architect-contrast-muted": "rgba(9,9,9,0.56)",
        "--architect-kicker": "#949aa6",
        "--architect-chip-soft-bg": "#181818",
        "--architect-chip-soft-ink": "#c8cdd6",
        "--architect-jewel-bg": "rgba(134,242,228,0.12)",
        "--architect-jewel-ink": "#86f2e4",
        "--architect-outline": "rgba(125,129,139,0.38)",
        "--architect-input-bg": "#101010",
        "--architect-input-placeholder": "#818794",
        "--architect-panel-shadow": "inset 0 1px 0 rgba(255,255,255,0.04), 0 20px 40px -32px rgba(0,0,0,0.72)",
      }
    : {
        "--architect-bg": "#f7f9fb",
        "--architect-bg-secondary": "#eef1f4",
        "--architect-glow-a": "rgba(16,12,61,0.06)",
        "--architect-glow-b": "rgba(0,106,97,0.08)",
        "--architect-ink": "#100c3d",
        "--architect-muted": "#536073",
        "--architect-subtle": "#778196",
        "--architect-surface-0": "rgba(255,255,255,0.92)",
        "--architect-surface-1": "#f4f6f8",
        "--architect-surface-2": "#eceef0",
        "--architect-surface-strong": "rgba(255,255,255,0.78)",
        "--architect-contrast": "#100c3d",
        "--architect-contrast-ink": "#ffffff",
        "--architect-contrast-muted": "rgba(255,255,255,0.55)",
        "--architect-kicker": "#6f7890",
        "--architect-chip-soft-bg": "#eceef0",
        "--architect-chip-soft-ink": "#5d6880",
        "--architect-jewel-bg": "#86f2e4",
        "--architect-jewel-ink": "#006f66",
        "--architect-outline": "rgba(197,198,205,0.45)",
        "--architect-input-bg": "#ffffff",
        "--architect-input-placeholder": "#9aa3b4",
        "--architect-panel-shadow": "inset 0 1px 0 rgba(255,255,255,0.9), 0 18px 34px -30px rgba(16,12,61,0.16)",
      };

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState<string>("");

  const isArabic = language === "ar";
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const themeVars = useMemo(() => authThemeVars(theme), [theme]);

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage(t("Verification token missing.", "رمز التحقق مفقود."));
      return;
    }

    apiService
      .verifyEmail(token)
      .then(() => {
        setStatus("success");
        setMessage(t("Email verified successfully.", "تم التحقق من البريد الإلكتروني بنجاح."));
      })
      .catch((err: any) => {
        setStatus("error");
        setMessage(err?.message || t("Verification failed.", "فشل التحقق."));
      });
  }, [params, t]);

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className="architect-shell min-h-screen" style={themeVars as React.CSSProperties}>
      <div className="relative isolate min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="absolute inset-0 opacity-70">
          <div className="absolute left-[-8%] top-[-10%] h-72 w-72 rounded-full bg-[color:var(--architect-glow-a)] blur-3xl" />
          <div className="absolute right-[-6%] top-[14%] h-80 w-80 rounded-full bg-[color:var(--architect-glow-b)] blur-3xl" />
          <div className="absolute inset-x-0 bottom-[-20%] h-96 bg-gradient-to-t from-transparent to-[color:var(--architect-bg-secondary)]" />
        </div>

        <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-6 lg:grid-cols-[1.04fr_0.96fr]">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="architect-hero hidden h-full flex-col justify-between lg:flex"
          >
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <SystemChip tone="primary">
                  <ShieldCheck className="h-4 w-4" />
                  {t("Email Security", "أمان البريد")}
                </SystemChip>
                <SystemChip>
                  <Sparkles className="h-4 w-4" />
                  {t("Black-first dark mode", "وضع داكن أسود")}
                </SystemChip>
              </div>
              <h1 className="font-['IBM_Plex_Sans_Arabic','Be_Vietnam_Pro',sans-serif] text-5xl font-semibold leading-[1.12] tracking-[-0.05em] text-[color:var(--architect-ink)]">
                {t("Verify your email", "تحقق من بريدك الإلكتروني")}
              </h1>
              <p className="max-w-xl text-base leading-8 text-[color:var(--architect-muted)]">
                {t(
                  "We are confirming ownership of your email before returning you to the workspace.",
                  "نؤكد الآن ملكية بريدك الإلكتروني قبل إعادتك إلى مساحة العمل.",
                )}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: t("Native RTL", "RTL أصيل"), value: "01", detail: t("Readable Arabic hierarchy.", "تدرج عربي واضح.") },
                { label: t("Theme aware", "حسب الثيم"), value: "02", detail: t("Light and black dark tokens.", "فاتح وداكن أسود.") },
                { label: t("Secure flow", "مسار آمن"), value: "03", detail: t("Verification before access.", "التحقق قبل الدخول.") },
                { label: t("Fast recovery", "استعادة سريعة"), value: "04", detail: t("Simple next step after verify.", "خطوة تالية بسيطة.") },
              ].map((item) => (
                <SystemStat key={item.value} label={item.label} value={item.value} detail={item.detail} />
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.06 }}
            className="min-w-0"
          >
            <SystemPanel
              title={t("Verification", "التحقق")}
              description={t("Email confirmation before login.", "تأكيد البريد الإلكتروني قبل الدخول.")}
              icon={BadgeCheck}
            >
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--architect-surface-2)] text-[color:var(--architect-ink)]">
                  <BadgeCheck className="h-6 w-6" />
                </div>

                {status === "verifying" ? (
                  <div className="architect-feedback bg-[color:var(--architect-surface-2)] text-[color:var(--architect-muted)]">
                    {t("Verifying your email...", "جارٍ التحقق من بريدك الإلكتروني...")}
                  </div>
                ) : (
                  <div
                    className={
                      status === "success"
                        ? "architect-feedback architect-feedback-success"
                        : "architect-feedback architect-feedback-error"
                    }
                  >
                    {message}
                  </div>
                )}

                <Button
                  onClick={() => navigate("/?auth=login")}
                  className="architect-button h-12 w-full rounded-md bg-[color:var(--architect-contrast)] text-[color:var(--architect-contrast-ink)] hover:opacity-95"
                >
                  {t("Go to login", "الانتقال إلى تسجيل الدخول")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </SystemPanel>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
