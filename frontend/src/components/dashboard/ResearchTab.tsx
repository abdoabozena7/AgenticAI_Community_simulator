import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  ChevronRight,
  CreditCard,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  MapPin,
  Play,
  Search,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import type { SearchResponse, SearchStructured } from '@/services/api';

interface ResearchResult {
  search: SearchResponse;
  map?: {
    counts?: Record<string, number>;
    markers?: { lat: number; lon: number; name: string; tag: string }[];
    center?: { lat: number; lon: number };
    tags?: string[];
  };
  structured?: SearchStructured;
  evidence_cards?: string[];
}

interface TimelineStep {
  id: number;
  icon: typeof Search;
  title: string;
  titleAr: string;
  status: 'pending' | 'running' | 'done';
}

interface ResearchTabProps {
  loading: boolean;
  result: ResearchResult | null;
  query?: string;
  onStartSimulation?: () => void;
}

export default function ResearchTab({ loading, result, query, onStartSimulation }: ResearchTabProps) {
  const { isRTL } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [steps, setSteps] = useState<TimelineStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const stepTemplates = useMemo(() => {
    const q = query || (isRTL ? 'الفكرة' : 'your idea');
    return [
      { id: 1, icon: Search, title: `Searching about "${q}"`, titleAr: `البحث عن "${q}"`, status: 'pending' as const },
      { id: 2, icon: Globe, title: 'Collecting sources', titleAr: 'جمع المصادر', status: 'pending' as const },
      { id: 3, icon: FileText, title: 'Summarizing insights', titleAr: 'تلخيص النتائج', status: 'pending' as const },
      { id: 4, icon: CreditCard, title: 'Creating evidence cards', titleAr: 'إنشاء بطاقات الأدلة', status: 'pending' as const },
      { id: 5, icon: MapPin, title: 'Map analysis', titleAr: 'تحليل الخريطة', status: 'pending' as const },
      { id: 6, icon: CheckCircle, title: 'Research complete', titleAr: 'اكتمل البحث', status: 'pending' as const },
    ];
  }, [query, isRTL]);

  useEffect(() => {
    setSteps(stepTemplates);
    setCurrentStep(0);
  }, [stepTemplates]);

  useEffect(() => {
    if (!loading) {
      if (result) setSteps((prev) => prev.map((step) => ({ ...step, status: 'done' })));
      return;
    }
    if (currentStep >= stepTemplates.length) return;

    const t1 = window.setTimeout(() => {
      setSteps((prev) => prev.map((s, i) => (i === currentStep ? { ...s, status: 'running' } : s)));
    }, 250);
    const t2 = window.setTimeout(() => {
      setSteps((prev) => prev.map((s, i) => (i === currentStep ? { ...s, status: 'done' } : s)));
      setCurrentStep((prev) => prev + 1);
    }, 1200);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [currentStep, loading, stepTemplates.length, result]);

  const structured = result?.structured || result?.search?.structured;
  const evidenceCards = (result?.evidence_cards?.length ? result.evidence_cards : structured?.evidence_cards) || [];
  const sources = result?.search?.results || [];
  const firstSource = sources[0];

  const mapCenter = useMemo(() => {
    const center = result?.map?.center;
    if (center && Number.isFinite(center.lat) && Number.isFinite(center.lon)) return center;
    const marker = (result?.map?.markers || []).find((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));
    return marker ? { lat: marker.lat, lon: marker.lon } : null;
  }, [result?.map]);

  const osmEmbedUrl = useMemo(() => {
    if (!mapCenter) return 'https://www.openstreetmap.org/export/embed.html?bbox=-180%2C-85%2C180%2C85&layer=mapnik';
    const lat = Math.max(-85, Math.min(85, mapCenter.lat));
    const lon = Math.max(-180, Math.min(180, mapCenter.lon));
    const bbox = `${lon - 0.03},${lat - 0.02},${lon + 0.03},${lat + 0.02}`;
    const marker = `${lat},${lon}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(marker)}`;
  }, [mapCenter]);

  const osmPageUrl = useMemo(() => {
    if (!mapCenter) return null;
    return `https://www.openstreetmap.org/?mlat=${mapCenter.lat}&mlon=${mapCenter.lon}#map=14/${mapCenter.lat}/${mapCenter.lon}`;
  }, [mapCenter]);

  const pageClass = cn(
    'architect-shell rounded-[32px] p-4 md:p-6',
    isDark ? 'architect-shell-dark bg-black text-white' : 'architect-shell-light bg-[#f5f2ea] text-slate-900',
  );
  const panelClass = cn(
    'rounded-[28px] p-5 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.35)]',
    isDark ? 'bg-zinc-950/90 text-white ring-1 ring-white/5' : 'bg-white/90 text-slate-900 ring-1 ring-black/5',
  );
  const surfaceClass = isDark ? 'bg-white/5 text-white/80 ring-1 ring-white/10' : 'bg-slate-50 text-slate-900 ring-1 ring-black/5';
  const mutedClass = isDark ? 'text-white/60' : 'text-slate-600';
  const strongClass = isDark ? 'text-white' : 'text-slate-900';
  const linkClass = isDark ? 'text-emerald-300 hover:text-emerald-200' : 'text-emerald-700 hover:text-emerald-800';

  return (
    <div className={pageClass}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
            <div className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs tracking-[0.22em] uppercase', isDark ? 'bg-white/5 text-white/60' : 'bg-slate-100 text-slate-600')}>
            <Search className="h-3.5 w-3.5" />
            {isRTL ? 'البحث والمرجع' : 'Research and reference'}
          </div>
          <h1 className={cn('text-2xl md:text-3xl font-semibold tracking-tight', strongClass)}>
            {isRTL ? 'بحث الوكلاء' : 'Agent Research'}
          </h1>
          <p className={cn('max-w-2xl text-sm md:text-base leading-7', mutedClass)}>
            {isRTL ? 'تابع مراحل البحث خطوة بخطوة داخل مساحة عمل هادئة وواضحة.' : 'Track the research pipeline step by step inside a calm, readable workspace.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn('px-3 py-1.5 text-xs font-medium', isDark ? 'border-white/10 bg-white/5 text-white' : 'border-black/10 bg-white text-slate-800')}
          >
            <Loader2 className={cn('mr-2 h-4 w-4', loading ? 'animate-spin' : '')} />
            {loading ? (isRTL ? 'جارٍ التنفيذ...' : 'Processing...') : isRTL ? 'مكتمل' : 'Complete'}
          </Badge>
          {result && onStartSimulation && (
            <Button
              onClick={onStartSimulation}
              size="sm"
              className={cn('architect-button-primary h-10 px-4', isDark ? 'bg-white text-black hover:bg-white/90' : 'bg-slate-950 text-white hover:bg-slate-800')}
            >
              <Play className="mr-2 h-4 w-4" />
              {isRTL ? 'انتقل إلى المحاكاة' : 'Continue to simulation'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.84fr_1.08fr_0.88fr]">
        <section className={panelClass}>
          <div className="flex items-center justify-between">
            <h3 className={cn('text-lg font-semibold', strongClass)}>{isRTL ? 'الجدول الزمني' : 'Timeline'}</h3>
            <span className={cn('text-xs uppercase tracking-[0.18em]', mutedClass)}>{steps.length} steps</span>
          </div>
          <div className="mt-4 space-y-3">
            {steps.map((step, idx) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className={cn(
                  'flex items-start gap-3 rounded-2xl px-4 py-3 transition-colors',
                  step.status === 'running'
                    ? isDark
                      ? 'bg-white/10 ring-1 ring-white/10'
                      : 'bg-slate-100 ring-1 ring-black/5'
                    : step.status === 'done'
                      ? isDark
                        ? 'bg-emerald-500/10'
                        : 'bg-emerald-50'
                      : isDark
                        ? 'bg-white/5'
                        : 'bg-slate-50',
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                    step.status === 'running'
                      ? isDark
                        ? 'bg-white/10'
                        : 'bg-slate-200'
                      : step.status === 'done'
                        ? isDark
                          ? 'bg-emerald-500/10'
                          : 'bg-emerald-100'
                        : isDark
                          ? 'bg-white/5'
                          : 'bg-white',
                  )}
                >
                  {step.status === 'running' ? (
                    <Loader2 className={cn('h-4 w-4 animate-spin', isDark ? 'text-white' : 'text-slate-900')} />
                  ) : step.status === 'done' ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <step.icon className={cn('h-4 w-4', mutedClass)} />
                  )}
                </div>
                <p className={cn('text-sm leading-6', step.status === 'done' ? strongClass : mutedClass)}>{isRTL ? step.titleAr : step.title}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className={panelClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={cn('text-xs uppercase tracking-[0.18em]', mutedClass)}>{isRTL ? 'النتيجة الحالية' : 'Current result'}</p>
              <h3 className={cn('mt-1 text-lg font-semibold', strongClass)}>{firstSource ? firstSource.title || (isRTL ? 'نتيجة البحث' : 'Search result') : isRTL ? 'لا توجد نتائج بعد' : 'No results yet'}</h3>
            </div>
            {firstSource ? <Badge className={cn('px-3 py-1 text-xs', isDark ? 'bg-white/5 text-white' : 'bg-slate-100 text-slate-700')}>{isRTL ? 'مصدر رئيسي' : 'Primary source'}</Badge> : null}
          </div>

          <div className="mt-4 space-y-4">
            {loading && !result ? (
              <div className="space-y-3">
                <Skeleton className={cn('h-6 w-3/4', isDark ? 'bg-white/10' : 'bg-slate-200')} />
                <Skeleton className={cn('h-4 w-1/2', isDark ? 'bg-white/10' : 'bg-slate-200')} />
                <Skeleton className={cn('h-24 w-full rounded-2xl', isDark ? 'bg-white/10' : 'bg-slate-200')} />
              </div>
            ) : firstSource ? (
              <>
                <a href={firstSource.url} target="_blank" rel="noreferrer" className={cn('inline-flex items-center gap-1 text-sm break-all', linkClass)}>
                  {firstSource.url}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <p className={cn('text-sm leading-7 whitespace-pre-line', mutedClass)}>
                  {structured?.summary || firstSource.snippet || (isRTL ? 'لا يوجد ملخص متاح بعد.' : 'No summary available yet.')}
                </p>
                <div className={cn('grid gap-3 rounded-2xl p-4 md:grid-cols-2', surfaceClass)}>
                  <div>
                    <p className={cn('text-xs uppercase tracking-[0.18em]', mutedClass)}>{isRTL ? 'العنوان' : 'Title'}</p>
                    <p className={cn('mt-1 text-sm font-medium leading-6', strongClass)}>{firstSource.title || (isRTL ? 'غير متوفر' : 'Unavailable')}</p>
                  </div>
                  <div>
                    <p className={cn('text-xs uppercase tracking-[0.18em]', mutedClass)}>{isRTL ? 'نوع السطح' : 'Surface'}</p>
                    <p className={cn('mt-1 text-sm font-medium leading-6', strongClass)}>{isRTL ? 'أسطح هادئة ومتدرجة' : 'Quiet layered surfaces'}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className={cn('text-sm leading-7', mutedClass)}>{isRTL ? 'ابدأ البحث من الصفحة الرئيسية.' : 'Start research from Home.'}</p>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <section className={panelClass}>
            <div className="flex items-center gap-2">
              <CreditCard className={cn('h-4 w-4', isDark ? 'text-emerald-300' : 'text-emerald-700')} />
              <h3 className={cn('text-lg font-semibold', strongClass)}>{isRTL ? 'الأدلة' : 'Evidence'}</h3>
            </div>
            <div className="mt-4 space-y-3">
              {evidenceCards.length ? (
                evidenceCards.map((ev, i) => (
                  <div key={`${ev}-${i}`} className={cn('rounded-2xl p-4', surfaceClass)}>
                    <Badge variant="outline" className={cn('mb-2 text-[11px] uppercase tracking-[0.18em]', isDark ? 'border-white/10 bg-white/5 text-white' : 'border-black/10 bg-white text-slate-700')}>
                      {`E${i + 1}`}
                    </Badge>
                    <p className={cn('text-sm leading-6', strongClass)}>{ev}</p>
                  </div>
                ))
              ) : (
                <p className={cn('text-sm leading-7', mutedClass)}>{isRTL ? 'لا توجد بطاقات أدلة حتى الآن.' : 'No evidence cards yet.'}</p>
              )}
            </div>
          </section>

          <section className={panelClass}>
            <div className="flex items-center gap-2">
              <Globe className={cn('h-4 w-4', isDark ? 'text-white/80' : 'text-slate-700')} />
              <h3 className={cn('text-lg font-semibold', strongClass)}>{isRTL ? 'المصادر' : 'Sources'}</h3>
            </div>
            <div className="mt-4 space-y-2">
              {sources.length ? (
                sources.map((src, i) => (
                  <a key={`${src.url}-${i}`} href={src.url} target="_blank" rel="noreferrer" className={cn('flex items-center gap-2 rounded-2xl px-3 py-2 text-sm transition-colors', isDark ? 'bg-white/5 text-white/75 hover:bg-white/10' : 'bg-slate-50 text-slate-700 hover:bg-slate-100')}>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{src.title || src.url}</span>
                  </a>
                ))
              ) : (
                <p className={cn('text-sm leading-7', mutedClass)}>{isRTL ? 'لا توجد مصادر بعد.' : 'No sources yet.'}</p>
              )}
            </div>
          </section>

          <section className={panelClass}>
            <div className="flex items-center gap-2">
              <MapPin className={cn('h-4 w-4', isDark ? 'text-emerald-300' : 'text-emerald-700')} />
              <h3 className={cn('text-lg font-semibold', strongClass)}>{isRTL ? 'تحليل الخريطة' : 'Map Analysis'}</h3>
            </div>
            <div className={cn('mt-4 aspect-video overflow-hidden rounded-2xl', surfaceClass)}>
              <iframe
                title="OpenStreetMap area analysis"
                src={osmEmbedUrl}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            {osmPageUrl && (
              <a href={osmPageUrl} target="_blank" rel="noreferrer" className={cn('mt-3 inline-flex items-center gap-1 text-sm', linkClass)}>
                {isRTL ? 'افتح الخريطة في تبويب جديد' : 'Open map in new tab'}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
