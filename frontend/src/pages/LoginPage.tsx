import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, LockKeyhole, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SystemChip, SystemPanel, SystemStat, systemInputClass } from "@/components/system/Architect";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { apiService } from "../services/api";

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

export default function LoginPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isArabic = language === "ar";
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const themeVars = useMemo(() => authThemeVars(theme), [theme]);
  const fieldClass = `${systemInputClass} h-12 w-full rounded-xl text-[15px]`;

  useEffect(() => {
    document.getElementById("username-input")?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegistering) {
        await apiService.register(username.trim(), email.trim(), password);
      } else {
        await apiService.login(username.trim(), password);
      }
      const me = await apiService.getMe();
      navigate(me?.role === "admin" ? "/control-center" : "/dashboard", { replace: true });
    } catch (err: any) {
      setError(err?.message || t("Authentication failed.", "فشل تسجيل الدخول."));
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering((value) => !value);
    setError(null);
  };

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className="architect-shell min-h-screen" style={themeVars as React.CSSProperties}>
      <div className="relative isolate min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="absolute inset-0 opacity-70">
          <div className="absolute left-[-8%] top-[-10%] h-72 w-72 rounded-full bg-[color:var(--architect-glow-a)] blur-3xl" />
          <div className="absolute right-[-6%] top-[14%] h-80 w-80 rounded-full bg-[color:var(--architect-glow-b)] blur-3xl" />
          <div className="absolute inset-x-0 bottom-[-20%] h-96 bg-gradient-to-t from-transparent to-[color:var(--architect-bg-secondary)]" />
        </div>

        <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="architect-hero flex h-full flex-col justify-between"
          >
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <SystemChip tone="primary">
                  <ShieldCheck className="h-4 w-4" />
                  {t("Control Surface", "واجهة التحكم")}
                </SystemChip>
                <SystemChip>
                  <Sparkles className="h-4 w-4" />
                  {t("Architectural Minimalist", "النسق المعماري")}
                </SystemChip>
              </div>

              <div className="max-w-2xl space-y-4">
                <h1 className="font-['IBM_Plex_Sans_Arabic','Be_Vietnam_Pro',sans-serif] text-4xl font-semibold leading-[1.15] tracking-[-0.05em] text-[color:var(--architect-ink)] sm:text-5xl lg:text-6xl">
                  {isRegistering ? t("Create account", "إنشاء حساب") : t("Welcome back", "مرحبًا بعودتك")}
                </h1>
                <p className="max-w-xl text-base leading-8 text-[color:var(--architect-muted)] sm:text-lg">
                  {isRegistering
                    ? t(
                        "Join the workspace to launch simulations, research, and controlled operations.",
                        "انضم إلى مساحة العمل لتشغيل المحاكيات والأبحاث والعمليات المنظمة.",
                      )
                    : t(
                        "Log in to continue into the simulation workspace and control center.",
                        "سجّل الدخول للانتقال إلى مساحة المحاكاة ومركز التحكم.",
                      )}
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { label: t("Arabic-first", "العربية أولًا"), value: "RTL", detail: t("Native layout and spacing.", "تخطيط ومسافات أصلية.") },
                { label: t("Theme-aware", "حسب الثيم"), value: t("Adaptive", "متكيف"), detail: t("Matches light and dark modes.", "يتوافق مع الوضعين الفاتح والداكن.") },
                { label: t("Premium UI", "واجهة فخمة"), value: "UI", detail: t("Architectural minimalist system.", "نظام معماري minimal.") },
              ].map((item) => (
                <SystemStat key={item.label} label={item.label} value={item.value} detail={item.detail} />
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
              title={isRegistering ? t("Register", "تسجيل") : t("Login", "الدخول")}
              description={
                isRegistering
                  ? t("Create an account to start.", "أنشئ حسابًا للبدء.")
                  : t("Enter your credentials to continue.", "أدخل بياناتك للمتابعة.")
              }
              icon={isRegistering ? UserPlus : LockKeyhole}
            >
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="architect-label" htmlFor="username-input">
                    {t("Username", "اسم المستخدم")}
                  </label>
                  <Input
                    id="username-input"
                    type="text"
                    placeholder={t("Enter username", "أدخل اسم المستخدم")}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={fieldClass}
                    required
                  />
                </div>

                {isRegistering ? (
                  <div className="space-y-2">
                    <label className="architect-label" htmlFor="email-input">
                      {t("Email", "البريد الإلكتروني")} {t("(optional)", "(اختياري)")}
                    </label>
                    <Input
                      id="email-input"
                      type="email"
                      placeholder={t("you@example.com", "you@example.com")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="architect-label" htmlFor="password-input">
                    {t("Password", "كلمة المرور")}
                  </label>
                  <Input
                    id="password-input"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={fieldClass}
                    required
                  />
                </div>

                {error ? <div className="architect-feedback architect-feedback-error">{error}</div> : null}

                <Button
                  type="submit"
                  disabled={loading}
                  className="architect-button h-12 w-full rounded-md bg-[color:var(--architect-contrast)] text-[color:var(--architect-contrast-ink)] hover:opacity-95"
                >
                  {loading
                    ? t("Please wait...", "يرجى الانتظار...")
                    : isRegistering
                      ? t("Create account", "إنشاء حساب")
                      : t("Login", "تسجيل الدخول")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              <div className="mt-6 flex flex-col gap-3 text-sm text-[color:var(--architect-muted)] sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={toggleMode}
                  className="inline-flex items-center gap-2 text-[color:var(--architect-ink)] underline underline-offset-4"
                >
                  {isRegistering
                    ? t("Have an account? Login", "لديك حساب؟ سجّل الدخول")
                    : t("Need an account? Register", "تحتاج حسابًا؟ سجّل")}
                </button>
                <SystemChip tone="soft" className="text-xs">
                  API: {import.meta.env.VITE_API_URL || "http://localhost:8000"}
                </SystemChip>
              </div>
            </SystemPanel>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
