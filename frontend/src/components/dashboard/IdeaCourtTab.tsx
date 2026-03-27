import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Gavel,
  Loader2,
  Scale,
  Shield,
  Target,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { apiService } from '@/services/api';
import { cn } from '@/lib/utils';

interface CourtResult {
  defense: string[];
  prosecution: string[];
  verdict: 'strong' | 'medium' | 'weak';
  verdictText: string;
  verdictTextAr: string;
  successConditions: string[];
  risks: string[];
  nextSteps: string[];
}

const classifyVerdict = (text: string, isRTL: boolean): CourtResult['verdict'] => {
  const lower = text.toLowerCase();
  if (lower.includes('strong') || lower.includes('accept') || lower.includes('great')) return 'strong';
  if (lower.includes('weak') || lower.includes('reject') || lower.includes('fail')) return 'weak';
  if (isRTL && (text.includes('قوية') || text.includes('ممتاز'))) return 'strong';
  if (isRTL && (text.includes('ضعيفة') || text.includes('رفض'))) return 'weak';
  return 'medium';
};

type SectionCardProps = {
  id: string;
  title: string;
  icon: typeof Shield;
  tone: 'emerald' | 'amber' | 'rose' | 'slate';
  open: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
};

function SectionCard({ id, title, icon: Icon, tone, open, onToggle, children }: SectionCardProps) {
  const toneMap = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    slate: 'text-slate-300',
  } as const;

  return (
    <section className="architect-panel overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/3"
      >
        <div className="flex items-center gap-3">
          <span className={cn('flex h-9 w-9 items-center justify-center rounded-full bg-white/5', toneMap[tone])}>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-semibold text-foreground">{title}</div>
            <div className="text-xs text-muted-foreground">
              {open ? 'Expanded section' : 'Collapsed section'}
            </div>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="px-5 pb-5"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default function IdeaCourtTab() {
  const { language, isRTL } = useLanguage();
  const { theme } = useTheme();
  const [idea, setIdea] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<CourtResult | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>(['defense', 'prosecution', 'verdict']);
  const [error, setError] = useState<string | null>(null);
  const t = (en: string, ar: string) => (language === 'ar' ? ar : en);

  useEffect(() => {
    const pending = localStorage.getItem('pendingCourtIdea');
    if (pending) {
      setIdea(pending);
      localStorage.removeItem('pendingCourtIdea');
    }
  }, []);

  const handleSubmit = async () => {
    if (!idea.trim()) return;
    setIsProcessing(true);
    setError(null);
    try {
      const res = await apiService.runCourt({ idea: idea.trim(), language });
      const verdictText = res?.verdict || '';
      const verdict = classifyVerdict(verdictText, isRTL);
      setResult({
        defense: res?.defense || [],
        prosecution: res?.prosecution || [],
        verdict,
        verdictText,
        verdictTextAr: verdictText,
        successConditions: res?.success_conditions || [],
        risks: res?.fatal_risks || [],
        nextSteps: res?.next_steps || [],
      });
      setExpandedSections(['defense', 'prosecution', 'verdict']);
    } catch (err: any) {
      setError(err?.message || t('Failed to run Idea Court', 'تعذر تشغيل محكمة الأفكار'));
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => (
      prev.includes(section) ? prev.filter((item) => item !== section) : [...prev, section]
    ));
  };

  const verdictConfig = (() => {
    switch (result?.verdict) {
      case 'strong':
        return {
          icon: CheckCircle,
          label: isRTL ? 'قوية' : 'Strong',
          wrap: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
          accent: 'text-emerald-400',
        };
      case 'weak':
        return {
          icon: XCircle,
          label: isRTL ? 'ضعيفة' : 'Weak',
          wrap: 'border-rose-500/20 bg-rose-500/10 text-rose-100',
          accent: 'text-rose-400',
        };
      default:
        return {
          icon: AlertTriangle,
          label: isRTL ? 'متوسطة' : 'Moderate',
          wrap: 'border-amber-500/20 bg-amber-500/10 text-amber-100',
          accent: 'text-amber-400',
        };
    }
  })();

  const shellClass = theme === 'dark' ? 'architect-shell architect-shell-dark' : 'architect-shell architect-shell-light';

  const bullets = (items: string[], tone: 'emerald' | 'amber' | 'rose') => (
    <ul className="space-y-3">
      {items.length ? items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex items-start gap-3 text-sm text-muted-foreground">
          {tone === 'emerald' ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : null}
          {tone === 'rose' ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" /> : null}
          {tone === 'amber' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /> : null}
          <span>{item}</span>
        </li>
      )) : (
        <li className="text-sm text-muted-foreground">{t('No items yet.', 'لا توجد عناصر بعد.')}</li>
      )}
    </ul>
  );

  return (
    <div className={cn(shellClass, 'space-y-8')}>
      <header className="architect-hero">
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
            {t('Architectural review', 'مراجعة معمارية')}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {t('Idea Court', 'محكمة الأفكار')}
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
            {t(
              'Test whether an idea is strong enough to survive scrutiny from both sides before you invest in it.',
              'اختبر ما إذا كانت الفكرة قوية بما يكفي للصمود أمام التحليل من كل الجهات قبل أن تستثمر فيها.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{t('Balanced critique', 'مراجعة متوازنة')}</Badge>
          <Badge variant="outline">{t('Fast verdict', 'حكم سريع')}</Badge>
          <Badge variant="outline">{theme === 'dark' ? t('Black / charcoal mode', 'وضع أسود / فحمي') : t('Light mode', 'الوضع الفاتح')}</Badge>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="architect-panel space-y-5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
                {t('Input brief', 'مدخل الفكرة')}
              </div>
              <h2 className="mt-2 text-xl font-semibold text-foreground">
                {t('Describe the idea clearly', 'صف الفكرة بوضوح')}
              </h2>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-foreground">
              <Scale className="h-5 w-5" />
            </div>
          </div>

          <Textarea
            placeholder={t('Quick coffee kiosk near a university...', 'كشك قهوة سريع بجانب جامعة...')}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            className="architect-input min-h-32 resize-none"
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleSubmit}
              disabled={isProcessing || !idea.trim()}
              className="architect-button-primary min-w-44"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('Analyzing...', 'جاري التحليل...')}
                </>
              ) : (
                <>
                  <Gavel className="mr-2 h-4 w-4" />
                  {t('Run Idea Court', 'تشغيل محكمة الأفكار')}
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t('The verdict becomes a structured critique, not a raw score.', 'الحكم يخرج كمراجعة منظمة، لا كدرجة فقط.')}
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
        </section>

        <section className="architect-panel space-y-5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
                {t('Verdict stage', 'مرحلة الحكم')}
              </div>
              <h2 className="mt-2 text-xl font-semibold text-foreground">
                {t('Architectural summary', 'الملخص المعماري')}
              </h2>
            </div>
            <Badge className={cn('border px-3 py-1 text-xs', verdictConfig.wrap)}>
              {result ? verdictConfig.label : t('Waiting', 'بانتظار الإدخال')}
            </Badge>
          </div>

          {result ? (
            <div className={cn('rounded-2xl border p-5', verdictConfig.wrap)}>
              <div className="flex items-start gap-4">
                <div className={cn('flex h-12 w-12 items-center justify-center rounded-full bg-white/5', verdictConfig.accent)}>
                  <verdictConfig.icon className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <div className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
                    {t('Decision', 'القرار')}
                  </div>
                  <p className="text-base leading-7 text-foreground">
                    {result.verdictText}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-background/40 p-5">
              <p className="text-sm leading-7 text-muted-foreground">
                {t(
                  'Run the review to generate a defense, a prosecution, a verdict, and the next operational steps.',
                  'شغّل المراجعة للحصول على دفاع، واتهام، وحكم، وخطوات تنفيذية واضحة.'
                )}
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-background/50 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                {t('Strength', 'القوة')}
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {result?.verdict === 'strong' ? 'A' : result?.verdict === 'medium' ? 'B' : 'C'}
              </div>
            </div>
            <div className="rounded-2xl bg-background/50 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                {t('Risk', 'المخاطرة')}
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {result?.risks.length ?? 0}
              </div>
            </div>
            <div className="rounded-2xl bg-background/50 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                {t('Actions', 'الإجراءات')}
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {result?.nextSteps.length ?? 0}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          id="defense"
          title={t('Defense AI', 'الدفاع')}
          icon={Shield}
          tone="emerald"
          open={expandedSections.includes('defense')}
          onToggle={toggleSection}
        >
          {bullets(result?.defense || [], 'emerald')}
        </SectionCard>

        <SectionCard
          id="prosecution"
          title={t('Prosecution AI', 'الادعاء')}
          icon={Gavel}
          tone="rose"
          open={expandedSections.includes('prosecution')}
          onToggle={toggleSection}
        >
          {bullets(result?.prosecution || [], 'rose')}
        </SectionCard>

        <SectionCard
          id="verdict"
          title={t('Judge Verdict', 'حكم القاضي')}
          icon={Scale}
          tone="amber"
          open={expandedSections.includes('verdict')}
          onToggle={toggleSection}
        >
          <div className={cn('rounded-2xl border p-4', verdictConfig.wrap)}>
            <div className="flex items-start gap-3">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-full bg-white/5', verdictConfig.accent)}>
                <verdictConfig.icon className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <Badge className={cn('border px-3 py-1 text-xs', verdictConfig.wrap)}>
                  {verdictConfig.label}
                </Badge>
                <p className="text-sm leading-7 text-foreground">
                  {result?.verdictText || t('No verdict yet.', 'لا يوجد حكم بعد.')}
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          id="success"
          title={t('Success conditions', 'شروط النجاح')}
          icon={Target}
          tone="emerald"
          open={expandedSections.includes('success')}
          onToggle={toggleSection}
        >
          {bullets(result?.successConditions || [], 'emerald')}
        </SectionCard>

        <SectionCard
          id="risks"
          title={t('Risks', 'المخاطر')}
          icon={AlertCircle}
          tone="amber"
          open={expandedSections.includes('risks')}
          onToggle={toggleSection}
        >
          {bullets(result?.risks || [], 'amber')}
        </SectionCard>

        <SectionCard
          id="nextSteps"
          title={t('Next steps', 'الخطوات التالية')}
          icon={ArrowRight}
          tone="slate"
          open={expandedSections.includes('nextSteps')}
          onToggle={toggleSection}
        >
          <ol className="space-y-3">
            {(result?.nextSteps || []).length ? result!.nextSteps.map((step, index) => (
              <li key={`${step}-${index}`} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs font-semibold text-foreground">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            )) : (
              <li className="text-sm text-muted-foreground">{t('No next steps yet.', 'لا توجد خطوات تالية بعد.')}</li>
            )}
          </ol>
        </SectionCard>
      </div>
    </div>
  );
}
