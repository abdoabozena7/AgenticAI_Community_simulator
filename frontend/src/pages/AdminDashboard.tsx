import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  BadgePercent,
  Coins,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  SystemChip,
  SystemPanel,
  SystemStat,
  systemSectionVariants,
} from "@/components/system/Architect";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { apiService, BillingSettingsResponse } from "@/services/api";

type AdminUser = {
  id: number;
  username: string;
  role: string;
  credits?: number;
};

type AdminStats = {
  total_simulations?: number;
  used_today?: number;
};

type FeedbackItem = {
  kind: "error" | "success";
  message: string;
};

export function AdminControlCenterContent({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isArabic = language === "ar";

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [creditTarget, setCreditTarget] = useState("");
  const [creditDelta, setCreditDelta] = useState(10);
  const [creditMessage, setCreditMessage] = useState<string | null>(null);
  const [creditBusy, setCreditBusy] = useState(false);

  const [billing, setBilling] = useState<BillingSettingsResponse | null>(null);
  const [billingPrice, setBillingPrice] = useState("0.10");
  const [billingFreeDailyTokens, setBillingFreeDailyTokens] = useState("2500");
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);

  const [roleTarget, setRoleTarget] = useState("");
  const [roleValue, setRoleValue] = useState("admin");
  const [roleMessage, setRoleMessage] = useState<string | null>(null);
  const [roleBusy, setRoleBusy] = useState(false);

  const [usageTarget, setUsageTarget] = useState("");
  const [usageMessage, setUsageMessage] = useState<string | null>(null);
  const [usageBusy, setUsageBusy] = useState(false);

  const [promoCode, setPromoCode] = useState("");
  const [promoBonus, setPromoBonus] = useState(5);
  const [promoMaxUses, setPromoMaxUses] = useState(1);
  const [promoExpires, setPromoExpires] = useState("");
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);

  const [resetAllDate, setResetAllDate] = useState("");
  const [resetAllMessage, setResetAllMessage] = useState<string | null>(null);
  const [resetAllBusy, setResetAllBusy] = useState(false);

  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const loadAdminData = async () => {
    setError(null);
    try {
      const [usersResponse, statsResponse, billingResponse] = await Promise.all([
        apiService.listUsers(),
        apiService.getStats(),
        apiService.getBillingSettings(),
      ]);

      setUsers(Array.isArray(usersResponse) ? usersResponse : []);
      setStats(statsResponse || null);
      setBilling(billingResponse);
      setBillingPrice(Number(billingResponse.token_price_per_1k_credits ?? 0).toFixed(2));
      setBillingFreeDailyTokens(String(billingResponse.free_daily_tokens ?? 0));
    } catch (e: any) {
      setError(e?.message || t("Failed to load control center data.", "فشل تحميل بيانات مركز التحكم."));
    }
  };

  useEffect(() => {
    void loadAdminData();
  }, []);

  const totalCredits = useMemo(
    () => users.reduce((sum, user) => sum + (Number(user?.credits) || 0), 0),
    [users],
  );

  const userCount = users.length;
  const averageCredits = userCount ? totalCredits / userCount : 0;

  const highestCreditUser = useMemo(
    () =>
      users.reduce<AdminUser | null>((top, current) => {
        if (!top) return current;
        return Number(current.credits ?? 0) > Number(top.credits ?? 0) ? current : top;
      }, null),
    [users],
  );

  const feedbackItems = [
    error ? { kind: "error" as const, message: error } : null,
    billingMessage ? { kind: "success" as const, message: billingMessage } : null,
    creditMessage ? { kind: "success" as const, message: creditMessage } : null,
    roleMessage ? { kind: "success" as const, message: roleMessage } : null,
    usageMessage ? { kind: "success" as const, message: usageMessage } : null,
    resetAllMessage ? { kind: "success" as const, message: resetAllMessage } : null,
    promoMessage ? { kind: "success" as const, message: promoMessage } : null,
  ].filter(Boolean) as FeedbackItem[];

  const handleGrantCredits = async () => {
    setCreditMessage(null);
    setError(null);

    const target = creditTarget.trim();
    if (!target) {
      setCreditMessage(t("Enter a username or user ID.", "أدخل اسم المستخدم أو رقم المستخدم."));
      return;
    }

    const delta = Number(creditDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      setCreditMessage(t("Enter a non-zero credit amount.", "أدخل قيمة رصيد غير صفرية."));
      return;
    }

    setCreditBusy(true);
    try {
      const payload = /^\d+$/.test(target)
        ? { user_id: Number(target), delta }
        : { username: target, delta };
      const response = await apiService.adjustCredits(payload);
      setCreditMessage(
        t(
          `Credits updated for ${response.username || target}. New balance: ${response.credits}.`,
          `تم تحديث الرصيد للمستخدم ${response.username || target}. الرصيد الجديد: ${response.credits}.`,
        ),
      );
      setCreditTarget("");
      await loadAdminData();
    } catch (e: any) {
      setError(e?.message || t("Failed to update credits.", "فشل تحديث الرصيد."));
    } finally {
      setCreditBusy(false);
    }
  };

  const handleUpdateBilling = async () => {
    setBillingMessage(null);
    setError(null);

    const parsedPrice = Number.parseFloat(billingPrice);
    const parsedTokens = Number.parseInt(billingFreeDailyTokens, 10);

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setBillingMessage(t("Enter a valid token price.", "أدخل سعرًا صحيحًا للتوكن."));
      return;
    }

    if (!Number.isFinite(parsedTokens) || parsedTokens < 0) {
      setBillingMessage(t("Enter a valid free daily token limit.", "أدخل حدًا صحيحًا للتوكنات اليومية."));
      return;
    }

    setBillingBusy(true);
    try {
      const payload: BillingSettingsResponse = {
        token_price_per_1k_credits: Number(parsedPrice.toFixed(2)),
        free_daily_tokens: parsedTokens,
      };
      const response = await apiService.updateBillingSettings(payload);
      setBilling(response);
      setBillingPrice(Number(response.token_price_per_1k_credits ?? 0).toFixed(2));
      setBillingFreeDailyTokens(String(response.free_daily_tokens ?? 0));
      setBillingMessage(t("Billing policy updated.", "تم تحديث سياسة الفوترة."));
    } catch (e: any) {
      setError(e?.message || t("Failed to update billing settings.", "فشل تحديث إعدادات الفوترة."));
    } finally {
      setBillingBusy(false);
    }
  };

  const handleUpdateRole = async () => {
    setRoleMessage(null);
    setError(null);

    const target = roleTarget.trim();
    if (!target) {
      setRoleMessage(t("Enter a username or user ID.", "أدخل اسم المستخدم أو رقم المستخدم."));
      return;
    }

    setRoleBusy(true);
    try {
      const payload = /^\d+$/.test(target)
        ? { user_id: Number(target), role: roleValue }
        : { username: target, role: roleValue };
      const response = await apiService.updateRole(payload);
      setRoleMessage(
        t(
          `Role updated for ${response.username || target}: ${response.role}.`,
          `تم تحديث الدور للمستخدم ${response.username || target}: ${response.role}.`,
        ),
      );
      setRoleTarget("");
      await loadAdminData();
    } catch (e: any) {
      setError(e?.message || t("Failed to update role.", "فشل تحديث الدور."));
    } finally {
      setRoleBusy(false);
    }
  };

  const handleResetUsage = async () => {
    setUsageMessage(null);
    setError(null);

    const target = usageTarget.trim();
    if (!target) {
      setUsageMessage(t("Enter a username or user ID.", "أدخل اسم المستخدم أو رقم المستخدم."));
      return;
    }

    setUsageBusy(true);
    try {
      const payload = /^\d+$/.test(target)
        ? { user_id: Number(target) }
        : { username: target };
      await apiService.resetUsage(payload);
      setUsageMessage(
        t(`Daily usage reset for ${target}.`, `تم تصفير الاستخدام اليومي للمستخدم ${target}.`),
      );
      setUsageTarget("");
      await loadAdminData();
    } catch (e: any) {
      setError(e?.message || t("Failed to reset usage.", "فشل تصفير الاستخدام."));
    } finally {
      setUsageBusy(false);
    }
  };

  const handleResetAllUsage = async () => {
    setResetAllMessage(null);
    setError(null);
    setResetAllBusy(true);
    try {
      const date = resetAllDate.trim();
      await apiService.resetUsage({ all_users: true, date: date || undefined });
      setResetAllMessage(
        t(
          `Daily usage reset for all users${date ? ` on ${date}` : ""}.`,
          `تم تصفير الاستخدام اليومي لكل المستخدمين${date ? ` بتاريخ ${date}` : ""}.`,
        ),
      );
      setResetAllDate("");
      await loadAdminData();
    } catch (e: any) {
      setError(e?.message || t("Failed to reset all usage.", "فشل تصفير استخدام جميع المستخدمين."));
    } finally {
      setResetAllBusy(false);
    }
  };

  const handleCreatePromo = async () => {
    setPromoMessage(null);
    setError(null);

    const code = promoCode.trim();
    if (!code) {
      setPromoMessage(t("Enter a promo code.", "أدخل كود الخصم."));
      return;
    }

    const bonus = Number(promoBonus);
    if (!Number.isFinite(bonus) || bonus < 0) {
      setPromoMessage(t("Enter a valid bonus amount.", "أدخل قيمة مكافأة صحيحة."));
      return;
    }

    const maxUses = Number(promoMaxUses);
    if (!Number.isFinite(maxUses) || maxUses < 1) {
      setPromoMessage(t("Enter a valid max uses value.", "أدخل عدد استخدامات صحيح."));
      return;
    }

    setPromoBusy(true);
    try {
      const payload = {
        code,
        bonus_attempts: bonus,
        max_uses: maxUses,
        expires_at: promoExpires.trim() || undefined,
      };
      const response = await apiService.createPromo(payload);
      setPromoMessage(
        t(`Promo code created: ${response.code}.`, `تم إنشاء كود الخصم: ${response.code}.`),
      );
      setPromoCode("");
      setPromoExpires("");
      await loadAdminData();
    } catch (e: any) {
      setError(e?.message || t("Failed to create promo code.", "فشل إنشاء كود الخصم."));
    } finally {
      setPromoBusy(false);
    }
  };

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className={cn(
        "architect-shell",
        embedded ? "min-h-0" : "min-h-screen",
        theme === "dark" ? "architect-shell-dark" : "architect-shell-light",
      )}
    >
      <div
        className={cn(
          "mx-auto max-w-[1600px]",
          embedded ? "px-0 py-0" : "px-6 py-6 sm:px-8 lg:px-14 lg:py-8 2xl:px-24",
        )}
      >
        <motion.header
          initial="hidden"
          animate="visible"
          custom={0}
          variants={systemSectionVariants}
          className="architect-hero"
        >
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_20rem] xl:items-start">
            <div>
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <SystemChip tone="primary">
                  <ShieldCheck className="h-4 w-4" />
                  {t("Control Center", "مركز التحكم")}
                </SystemChip>
                <SystemChip tone="soft">
                  {t("Architectural Minimalist", "النسق المعماري الهادئ")}
                </SystemChip>
              </div>

              <h1 className="font-['IBM_Plex_Sans_Arabic','Be_Vietnam_Pro',sans-serif] text-4xl font-semibold leading-[1.18] tracking-[-0.05em] text-[color:var(--architect-ink)] sm:text-5xl">
                {t("Admin Operations", "عمليات الإدارة")}
              </h1>

              <p className="mt-4 max-w-3xl text-base leading-8 text-[color:var(--architect-muted)]">
                {t(
                  "A control room for credit policy, role governance, usage resets, promo campaigns, and live user balance supervision.",
                  "غرفة تشغيل لإدارة سياسة الأرصدة، وصلاحيات الوصول، وتصفير الاستخدام، وحملات الخصم، ومتابعة أرصدة المستخدمين بشكل مباشر.",
                )}
              </p>
            </div>

            <div className="architect-side-note">
              <p className="architect-kicker">{t("Quick Actions", "إجراءات سريعة")}</p>
              <div className="mt-4 grid gap-3">
                <Button
                  type="button"
                  onClick={() => void loadAdminData()}
                  className="architect-button architect-button-primary h-12 justify-center rounded-md px-5"
                >
                  <RefreshCw className="h-4 w-4" />
                  {t("Refresh data", "تحديث البيانات")}
                </Button>
                {!embedded ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/dashboard")}
                    className="architect-button architect-button-secondary h-12 justify-center rounded-md px-5"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {t("Back to dashboard", "العودة إلى اللوحة")}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </motion.header>

        {feedbackItems.length ? (
          <motion.section
            initial="hidden"
            animate="visible"
            custom={1}
            variants={systemSectionVariants}
            className="mt-6 grid gap-3"
          >
            {feedbackItems.map((item, index) => (
              <div
                key={`${item.kind}-${index}`}
                className={cn(
                  "architect-feedback",
                  item.kind === "error" ? "architect-feedback-error" : "architect-feedback-success",
                )}
              >
                {item.message}
              </div>
            ))}
          </motion.section>
        ) : null}

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_21rem]">
          <motion.main
            initial="hidden"
            animate="visible"
            custom={2}
            variants={systemSectionVariants}
            className="space-y-8"
          >
            <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
              <div className="architect-stage-card architect-stage-card-hero">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="max-w-2xl">
                    <p className="architect-kicker">{t("Operational Snapshot", "ملخص تشغيلي")}</p>
                    <div className="mt-5 font-['Be_Vietnam_Pro'] text-5xl font-semibold tracking-[-0.06em] text-[color:var(--architect-ink)] sm:text-6xl">
                      {totalCredits.toFixed(2)}
                    </div>
                    <p className="mt-3 max-w-xl text-base leading-8 text-[color:var(--architect-muted)]">
                      {t(
                        "Total credit volume currently circulating across the platform.",
                        "إجمالي حجم الأرصدة المتداولة حاليًا عبر المنصة.",
                      )}
                    </p>
                  </div>

                  <div className="grid min-w-[220px] gap-3 text-sm text-[color:var(--architect-muted)]">
                    <div className="rounded-2xl bg-[color:var(--architect-surface-strong)] px-4 py-4">
                      <p className="architect-kicker">{t("Top balance", "أعلى رصيد")}</p>
                      <p className="mt-2 font-medium text-[color:var(--architect-ink)]">
                        {highestCreditUser?.username || t("No users", "لا يوجد مستخدمون")}
                      </p>
                      <p className="font-['Be_Vietnam_Pro'] text-xl font-semibold text-[color:var(--architect-ink)]">
                        {Number(highestCreditUser?.credits ?? 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[color:var(--architect-contrast)] px-4 py-4 text-[color:var(--architect-contrast-ink)]">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--architect-contrast-muted)]">
                        {t("Today", "اليوم")}
                      </p>
                      <p className="mt-2 font-['Be_Vietnam_Pro'] text-2xl font-semibold">
                        {stats?.used_today ?? 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <SystemStat
                  label={t("Users", "المستخدمون")}
                  value={String(userCount)}
                  detail={t("Registered identities under active control.", "الهويات المسجلة تحت نطاق الإدارة الحالية.")}
                  tone="accent"
                />
                <SystemStat
                  label={t("Average Credits", "متوسط الأرصدة")}
                  value={averageCredits.toFixed(2)}
                  detail={t("Average balance per account.", "متوسط الرصيد لكل حساب داخل النظام.")}
                  tone="success"
                />
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <SystemStat
                label={t("Simulations Today", "محاكيات اليوم")}
                value={String(stats?.used_today ?? 0)}
                detail={t("Sessions launched in the current day.", "عدد الجلسات التي بدأت خلال اليوم الحالي.")}
              />
              <SystemStat
                label={t("Total Simulations", "إجمالي المحاكيات")}
                value={String(stats?.total_simulations ?? 0)}
                detail={t("Cumulative simulation runs.", "عدد المحاكيات المنفذة تراكميًا.")}
              />
              <SystemStat
                label={t("Free Daily Tokens", "التوكنات اليومية المجانية")}
                value={String(billing?.free_daily_tokens ?? 0)}
                detail={t("Current allowance before billing applies.", "الحصة الحالية قبل بدء احتساب الفوترة.")}
              />
            </section>

            <SystemPanel
              title={t("System Pulse", "نبض النظام")}
              description={t(
                "A concise operator-grade summary of the live usage rhythm and current billing stance.",
                "ملخص تشغيلي سريع لإيقاع الاستخدام الحالي ووضع الفوترة النشط.",
              )}
              icon={Activity}
            >
              <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="architect-surface-muted p-5">
                  <p className="architect-kicker">{t("Usage Pattern", "نمط الاستخدام")}</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-[color:var(--architect-muted)]">{t("Started today", "بدأت اليوم")}</p>
                      <p className="mt-2 font-['Be_Vietnam_Pro'] text-3xl font-semibold text-[color:var(--architect-ink)]">
                        {stats?.used_today ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-[color:var(--architect-muted)]">{t("Total runs", "إجمالي الجولات")}</p>
                      <p className="mt-2 font-['Be_Vietnam_Pro'] text-3xl font-semibold text-[color:var(--architect-ink)]">
                        {stats?.total_simulations ?? 0}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="architect-surface-soft p-5">
                  <p className="architect-kicker">{t("Current Billing", "الوضع الحالي للفوترة")}</p>
                  <p className="mt-4 text-sm leading-7 text-[color:var(--architect-muted)]">
                    {t(
                      `${Number(billing?.token_price_per_1k_credits ?? 0).toFixed(2)} credits are billed per 1000 tokens, with ${billing?.free_daily_tokens ?? 0} free tokens issued every day.`,
                      `يتم احتساب ${Number(billing?.token_price_per_1k_credits ?? 0).toFixed(2)} رصيد لكل 1000 توكن، مع ${billing?.free_daily_tokens ?? 0} توكن مجاني يوميًا.`,
                    )}
                  </p>
                </div>
              </div>
            </SystemPanel>

            <SystemPanel
              title={t("Users Ledger", "سجل المستخدمين")}
              description={t(
                "A dense but calm list for balances and access roles, with whitespace replacing dividers.",
                "قائمة تشغيلية كثيفة لكن هادئة للأرصدة والصلاحيات، مع اعتماد المسافات بدل الفواصل التقليدية.",
              )}
              icon={Users}
            >
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <SystemChip tone="soft">
                  {t(`${users.length} records`, `${users.length} سجل`)}
                </SystemChip>
                <SystemChip tone="jewel">
                  <Coins className="h-4 w-4" />
                  {t(`Total credits ${totalCredits.toFixed(2)}`, `إجمالي الأرصدة ${totalCredits.toFixed(2)}`)}
                </SystemChip>
              </div>

              <div className="architect-ledger-shell">
                <div className="hidden grid-cols-[72px_minmax(0,1.3fr)_140px_150px] gap-6 px-5 pb-4 text-[11px] uppercase tracking-[0.22em] text-[color:var(--architect-subtle)] md:grid">
                  <span>{t("ID", "المعرف")}</span>
                  <span>{t("Username", "اسم المستخدم")}</span>
                  <span>{t("Role", "الدور")}</span>
                  <span>{t("Credits", "الرصيد")}</span>
                </div>

                <div className="max-h-[720px] overflow-auto scrollbar-thin pr-1">
                  {users.length ? (
                    <div className="grid gap-4">
                      {users.map((user) => (
                        <article
                          key={user.id}
                          className="architect-ledger-row grid gap-3 px-5 py-4 md:grid-cols-[72px_minmax(0,1.3fr)_140px_150px] md:items-center md:gap-6"
                        >
                          <div className="font-['Be_Vietnam_Pro'] text-sm font-medium text-[color:var(--architect-subtle)]">
                            {user.id}
                          </div>
                          <div>
                            <p className="font-medium text-[color:var(--architect-ink)]">{user.username}</p>
                            <p className="mt-1 text-sm text-[color:var(--architect-muted)]">
                              {t("Managed account identity", "هوية مستخدم خاضعة للإدارة")}
                            </p>
                          </div>
                          <div>
                            <span className="architect-role-pill">{user.role}</span>
                          </div>
                          <div className="font-['Be_Vietnam_Pro'] text-lg font-semibold tracking-[-0.03em] text-[color:var(--architect-ink)]">
                            {Number(user.credits ?? 0).toFixed(2)}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[28px] bg-[color:var(--architect-surface-2)] px-6 py-12 text-center text-[color:var(--architect-muted)]">
                      {t("No users available.", "لا يوجد مستخدمون حاليًا.")}
                    </div>
                  )}
                </div>
              </div>
            </SystemPanel>
          </motion.main>

          <motion.aside
            initial="hidden"
            animate="visible"
            custom={3}
            variants={systemSectionVariants}
            className="architect-rail space-y-4"
          >
            <SystemPanel
              title={t("Billing Controls", "ضبط الفوترة")}
              description={t(
                "Adjust how token usage converts into credits.",
                "اضبط طريقة تحويل استهلاك التوكنات إلى أرصدة.",
              )}
              icon={Wallet}
            >
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="architect-label">
                    {t("Credits per 1000 tokens", "الرصيد لكل 1000 توكن")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={billingPrice}
                    onChange={(e) => setBillingPrice(e.target.value)}
                    className="architect-input"
                  />
                </div>
                <div className="space-y-2">
                  <label className="architect-label">
                    {t("Free daily tokens", "التوكنات اليومية المجانية")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={billingFreeDailyTokens}
                    onChange={(e) => setBillingFreeDailyTokens(e.target.value)}
                    className="architect-input"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleUpdateBilling}
                  disabled={billingBusy}
                  className="architect-button architect-button-primary h-12 w-full rounded-md"
                >
                  {billingBusy ? t("Updating...", "جارٍ التحديث...") : t("Update billing", "تحديث الفوترة")}
                </Button>
              </div>
            </SystemPanel>

            <SystemPanel
              title={t("Credits", "الأرصدة")}
              description={t(
                "Add or deduct balance by username or numeric user ID.",
                "أضف أو اخصم الرصيد باستخدام اسم المستخدم أو رقم المستخدم.",
              )}
              icon={Coins}
            >
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder={t("Username or user ID", "اسم المستخدم أو رقم المستخدم")}
                  value={creditTarget}
                  onChange={(e) => setCreditTarget(e.target.value)}
                  className="architect-input"
                />
                <input
                  type="number"
                  step="0.01"
                  value={creditDelta}
                  onChange={(e) => {
                    const value = Number.parseFloat(e.target.value);
                    setCreditDelta(Number.isFinite(value) ? value : 0);
                  }}
                  className="architect-input"
                />
                <Button
                  type="button"
                  onClick={handleGrantCredits}
                  disabled={creditBusy}
                  className="architect-button architect-button-primary h-12 w-full rounded-md"
                >
                  {creditBusy ? t("Applying...", "جارٍ التطبيق...") : t("Apply credits", "تطبيق الرصيد")}
                </Button>
              </div>
            </SystemPanel>

            <SystemPanel
              title={t("Roles", "الأدوار")}
              description={t(
                "Change account access levels without leaving the control rail.",
                "غيّر صلاحيات الحسابات دون مغادرة المسار التشغيلي.",
              )}
              icon={UserCog}
            >
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder={t("Username or user ID", "اسم المستخدم أو رقم المستخدم")}
                  value={roleTarget}
                  onChange={(e) => setRoleTarget(e.target.value)}
                  className="architect-input"
                />
                <select
                  value={roleValue}
                  onChange={(e) => setRoleValue(e.target.value)}
                  className="architect-input"
                >
                  <option value="admin">admin</option>
                  <option value="developer">developer</option>
                  <option value="user">user</option>
                </select>
                <Button
                  type="button"
                  onClick={handleUpdateRole}
                  disabled={roleBusy}
                  className="architect-button architect-button-secondary h-12 w-full rounded-md"
                >
                  {roleBusy ? t("Updating...", "جارٍ التحديث...") : t("Apply role", "تطبيق الدور")}
                </Button>
              </div>
            </SystemPanel>

            <SystemPanel
              title={t("Usage Reset", "تصفير الاستخدام")}
              description={t(
                "Reset daily usage counters for one account or the full system.",
                "أعد تعيين عدادات الاستخدام اليومية لحساب واحد أو للنظام بالكامل.",
              )}
              icon={RotateCcw}
            >
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder={t("Username or user ID", "اسم المستخدم أو رقم المستخدم")}
                  value={usageTarget}
                  onChange={(e) => setUsageTarget(e.target.value)}
                  className="architect-input"
                />
                <Button
                  type="button"
                  onClick={handleResetUsage}
                  disabled={usageBusy}
                  className="architect-button architect-button-primary h-12 w-full rounded-md"
                >
                  {usageBusy ? t("Resetting...", "جارٍ التصفير...") : t("Reset user usage", "تصفير استخدام المستخدم")}
                </Button>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    type="date"
                    value={resetAllDate}
                    onChange={(e) => setResetAllDate(e.target.value)}
                    className="architect-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetAllUsage}
                    disabled={resetAllBusy}
                    className="architect-button architect-button-secondary h-12 rounded-md px-4"
                  >
                    {resetAllBusy ? t("Resetting...", "جارٍ التصفير...") : t("Reset all", "تصفير الكل")}
                  </Button>
                </div>
              </div>
            </SystemPanel>

            <SystemPanel
              title={t("Promo Codes", "أكواد الخصم")}
              description={t(
                "Create reusable or one-off campaign codes with optional expiry.",
                "أنشئ أكواد حملات قابلة لإعادة الاستخدام أو لمرة واحدة مع تاريخ انتهاء اختياري.",
              )}
              icon={BadgePercent}
            >
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder={t("Promo code", "كود الخصم")}
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="architect-input"
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <input
                    type="number"
                    value={promoBonus}
                    onChange={(e) => setPromoBonus(Number(e.target.value))}
                    className="architect-input"
                    placeholder={t("Bonus", "المكافأة")}
                  />
                  <input
                    type="number"
                    value={promoMaxUses}
                    onChange={(e) => setPromoMaxUses(Number(e.target.value))}
                    className="architect-input"
                    placeholder={t("Max uses", "العدد")}
                  />
                  <input
                    type="date"
                    value={promoExpires}
                    onChange={(e) => setPromoExpires(e.target.value)}
                    className="architect-input"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleCreatePromo}
                  disabled={promoBusy}
                  className="architect-button architect-button-primary h-12 w-full rounded-md"
                >
                  {promoBusy ? t("Creating...", "جارٍ الإنشاء...") : t("Create promo code", "إنشاء كود خصم")}
                </Button>
              </div>
            </SystemPanel>

            <div className="architect-premium-note">
              <p className="architect-kicker">{t("Governance Note", "ملاحظة تشغيلية")}</p>
              <p className="mt-3 text-sm leading-7 text-[#5d6577]">
                {t(
                  "Risky actions are intentionally isolated in the side rail so the primary stage remains focused on reading and verification before action.",
                  "تم عزل الإجراءات عالية الحساسية في المسار الجانبي حتى تبقى المساحة الرئيسية مخصصة للقراءة والتحقق قبل التنفيذ.",
                )}
              </p>
            </div>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return <AdminControlCenterContent />;
}
