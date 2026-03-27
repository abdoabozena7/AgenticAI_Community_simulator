import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle, MapPin, Play, Sparkles, Tag, XCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

const categories = [
  { value: 'technology', label: 'Technology', labelAr: 'التكنولوجيا' },
  { value: 'healthcare', label: 'Healthcare', labelAr: 'الرعاية الصحية' },
  { value: 'finance', label: 'Finance', labelAr: 'التمويل' },
  { value: 'education', label: 'Education', labelAr: 'التعليم' },
  { value: 'e-commerce', label: 'E-commerce', labelAr: 'التجارة الإلكترونية' },
  { value: 'entertainment', label: 'Entertainment', labelAr: 'الترفيه' },
  { value: 'social', label: 'Social', labelAr: 'اجتماعي' },
  { value: 'b2b saas', label: 'B2B SaaS', labelAr: 'برمجيات أعمال' },
  { value: 'consumer apps', label: 'Consumer Apps', labelAr: 'تطبيقات استهلاكية' },
  { value: 'hardware', label: 'Hardware', labelAr: 'أجهزة' },
];

interface HomeTabProps {
  onStartResearch: (payload: { idea: string; location?: string; category?: string }) => void;
  onStartSimulation: (idea: string, extras?: { location?: string; category?: string }) => void;
  onChoosePersonaSource: (idea: string, extras?: { location?: string; category?: string }) => void;
  onOpenPersonaLab: () => void;
  hasDefaultPersonaSelection?: boolean;
  onRedeemPromo: (code: string) => Promise<string>;
  researchBusy?: boolean;
}

export default function HomeTab({
  onStartResearch,
  onStartSimulation,
  onChoosePersonaSource,
  onOpenPersonaLab,
  hasDefaultPersonaSelection,
  onRedeemPromo,
  researchBusy,
}: HomeTabProps) {
  const { language, isRTL } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [idea, setIdea] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      return window.localStorage.getItem('dashboardIdea') || '';
    } catch {
      return '';
    }
  });
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('technology');
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const t = (en: string, ar: string) => (language === 'ar' ? ar : en);

  useEffect(() => {
    try {
      if (idea.trim()) {
        window.localStorage.setItem('dashboardIdea', idea.trim());
      } else {
        window.localStorage.removeItem('dashboardIdea');
      }
    } catch {
      // ignore
    }
  }, [idea]);

  const handleStartResearch = () => {
    if (!idea.trim()) return;
    onStartResearch({
      idea: idea.trim(),
      location: location.trim() || undefined,
      category: category || undefined,
    });
  };

  const handleStartSimulation = () => {
    if (!idea.trim()) return;
    onStartSimulation(idea.trim(), {
      location: location.trim() || undefined,
      category: category || undefined,
    });
  };

  const handleRedeemPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoStatus('idle');
    setPromoMessage(null);
    try {
      const message = await onRedeemPromo(promoCode.trim());
      setPromoStatus('success');
      setPromoMessage(message);
      setPromoCode('');
    } catch (err: any) {
      setPromoStatus('error');
      setPromoMessage(err?.message || t('Failed to redeem code.', 'فشل استرداد الكود.'));
    }
  };

  const pageClass = cn(
    'architect-shell rounded-[32px] p-4 md:p-6',
    isDark ? 'architect-shell-dark bg-black text-white' : 'architect-shell-light bg-[#f5f2ea] text-slate-900',
  );
  const panelClass = cn(
    'rounded-[28px] p-5 md:p-6 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.35)]',
    isDark ? 'bg-zinc-950/90 text-white ring-1 ring-white/5' : 'bg-white/90 text-slate-900 ring-1 ring-black/5',
  );
  const insetClass = cn(
    'rounded-2xl px-4 py-3 transition-colors',
    isDark ? 'bg-white/5 text-white/90 ring-1 ring-white/10' : 'bg-slate-50 text-slate-900 ring-1 ring-black/5',
  );
  const mutedClass = isDark ? 'text-white/60' : 'text-slate-600';
  const strongClass = isDark ? 'text-white' : 'text-slate-900';
  const inputClass = cn(
    'architect-input bg-transparent',
    isDark
      ? 'border-white/10 bg-white/5 text-white placeholder:text-white/40'
      : 'border-black/10 bg-white text-slate-900 placeholder:text-slate-400',
  );
  const buttonSecondaryClass = isDark
    ? 'architect-button-secondary bg-white/10 text-white hover:bg-white/20'
    : 'architect-button-secondary bg-slate-100 text-slate-900 hover:bg-slate-200';

  return (
    <div className={pageClass}>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]"
      >
        <section className={panelClass}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs tracking-[0.22em] uppercase', isDark ? 'bg-white/5 text-white/60' : 'bg-slate-100 text-slate-600')}>
                <Sparkles className="h-3.5 w-3.5" />
                {t('Architectural Minimalist', 'الهوية المعمارية البسيطة')}
              </div>
              <h2 className={cn('text-2xl md:text-3xl font-semibold tracking-tight', strongClass)}>
                {t('Start a new simulation pipeline', 'ابدأ محاكاة جديدة')}
              </h2>
              <p className={cn('max-w-2xl text-sm md:text-base leading-7', mutedClass)}>
                {t(
                  'Describe the idea, choose the place and category, then move directly into research or simulation.',
                  'اكتب الفكرة، حدّد المكان والتصنيف، ثم انتقل مباشرة إلى البحث أو المحاكاة.',
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className={cn('rounded-full px-3 py-1 text-xs', isDark ? 'bg-white/5 text-white/70' : 'bg-slate-100 text-slate-600')}>
                {t('Dark mode uses black surfaces', 'الوضع الداكن يعتمد على الأسود')}
              </div>
              {hasDefaultPersonaSelection ? (
                <div className={cn('rounded-full px-3 py-1 text-xs', isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700')}>
                  {t('Default persona source set', 'تم تعيين مصدر افتراضي للشخصيات')}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <label className={cn('text-sm font-medium', mutedClass)}>{t('Your idea', 'فكرتك')}</label>
              <Textarea
                placeholder={t(
                  'Example: Quick coffee kiosk near a university',
                  'مثال: كشك قهوة سريع بجوار جامعة',
                )}
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                className={cn(inputClass, 'min-h-[120px] resize-none text-base leading-7')}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className={cn('text-sm font-medium', mutedClass)}>{t('Place / area (optional)', 'المكان / المنطقة (اختياري)')}</label>
                <div className="relative">
                  <MapPin className={cn('pointer-events-none absolute top-1/2 h-4.5 w-4.5 -translate-y-1/2', isRTL ? 'right-3' : 'left-3', mutedClass)} />
                  <Input
                    placeholder={t('Example: Nasr City, Cairo', 'مثال: مدينة نصر، القاهرة')}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className={cn(inputClass, isRTL ? 'pr-10' : 'pl-10')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className={cn('text-sm font-medium', mutedClass)}>{t('Category', 'التصنيف')}</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className={cn(inputClass, 'w-full')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {isRTL ? cat.labelAr : cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className={cn('rounded-2xl p-4 text-sm leading-7', isDark ? 'bg-white/5 text-white/70 ring-1 ring-white/10' : 'bg-slate-50 text-slate-600 ring-1 ring-black/5')}>
              {location.trim()
                ? t(
                    'The place is set. Starting now will use this location unless you choose a different persona source.',
                    'تم تحديد المكان. سيستخدم النظام هذا الموقع ما لم تغيّر مصدر الشخصيات.',
                  )
                : t(
                    'No place is set yet. General ideas will ask for a persona source before simulation starts.',
                    'لم يتم تحديد مكان بعد. الأفكار العامة ستطلب مصدرًا للشخصيات قبل بدء المحاكاة.',
                  )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Button
                onClick={handleStartSimulation}
                disabled={!idea.trim()}
                className={cn('architect-button-primary h-12 px-5 text-base font-medium', isDark ? 'bg-white text-black hover:bg-white/90' : 'bg-slate-950 text-white hover:bg-slate-800')}
              >
                <Play className="mr-2 h-4 w-4" />
                {t('Run mandatory pipeline', 'شغّل المسار الإلزامي')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <Button onClick={handleStartResearch} disabled={!idea.trim() || researchBusy} className={cn(buttonSecondaryClass, 'h-12 px-5 text-base font-medium')}>
                <Zap className="mr-2 h-4 w-4" />
                {researchBusy ? t('Researching...', 'جارٍ البحث...') : t('Preview research only', 'عرض البحث فقط')}
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Button
                onClick={() =>
                  onChoosePersonaSource(idea.trim(), {
                    location: location.trim() || undefined,
                    category: category || undefined,
                  })
                }
                disabled={!idea.trim()}
                variant="secondary"
                className={cn(buttonSecondaryClass, 'h-11')}
              >
                {t('Choose persona source', 'اختر مصدر الشخصيات')}
              </Button>
              <Button onClick={onOpenPersonaLab} variant="secondary" className={cn(buttonSecondaryClass, 'h-11')}>
                {t('Open persona lab', 'افتح مختبر الشخصيات')}
              </Button>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={panelClass}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={cn('text-xs uppercase tracking-[0.22em]', mutedClass)}>{t('Persona state', 'حالة الشخصيات')}</p>
                <h3 className={cn('mt-1 text-lg font-semibold', strongClass)}>{t('Current draft', 'المسودة الحالية')}</h3>
              </div>
              <div className={cn('rounded-full px-3 py-1 text-xs', isDark ? 'bg-white/5 text-white/70' : 'bg-slate-100 text-slate-600')}>
                {t('Ready', 'جاهز')}
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <div className={insetClass}>
                <p className={cn('text-xs uppercase tracking-[0.18em]', mutedClass)}>{t('Idea length', 'طول الفكرة')}</p>
                <p className={cn('mt-1 text-base font-medium', strongClass)}>{idea.trim() ? `${idea.trim().length} ${t('chars', 'حرفًا')}` : t('No idea yet', 'لا توجد فكرة بعد')}</p>
              </div>
              <div className={insetClass}>
                <p className={cn('text-xs uppercase tracking-[0.18em]', mutedClass)}>{t('Location', 'المكان')}</p>
                <p className={cn('mt-1 text-base font-medium', strongClass)}>{location.trim() || t('Not set', 'غير محدد')}</p>
              </div>
              <div className={insetClass}>
                <p className={cn('text-xs uppercase tracking-[0.18em]', mutedClass)}>{t('Category', 'التصنيف')}</p>
                <p className={cn('mt-1 text-base font-medium', strongClass)}>{isRTL ? categories.find((item) => item.value === category)?.labelAr : categories.find((item) => item.value === category)?.label}</p>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={panelClass}>
            <div className="flex items-center gap-2">
              <Tag className={cn('h-4 w-4', isDark ? 'text-emerald-300' : 'text-emerald-700')} />
              <h3 className={cn('text-lg font-semibold', strongClass)}>{t('Promo code', 'كود الخصم')}</h3>
            </div>
            <div className="mt-4 flex gap-3">
              <Input
                placeholder={t('Enter promo code', 'أدخل كود الخصم')}
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value);
                  setPromoStatus('idle');
                  setPromoMessage(null);
                }}
                className={cn(inputClass, 'flex-1')}
              />
              <Button onClick={handleRedeemPromo} variant="secondary" className={cn(buttonSecondaryClass, 'min-w-24')}>
                {t('Redeem', 'استرداد')}
              </Button>
            </div>
            {promoStatus === 'success' && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className={cn('mt-3 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm', isDark ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/15' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200')}>
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{promoMessage || t('Promo redeemed successfully.', 'تم استرداد الكود بنجاح.')}</span>
              </motion.div>
            )}
            {promoStatus === 'error' && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className={cn('mt-3 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm', isDark ? 'bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/15' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200')}>
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{promoMessage || t('Invalid code', 'كود غير صحيح')}</span>
              </motion.div>
            )}
          </motion.div>
        </aside>
      </motion.div>
    </div>
  );
}
