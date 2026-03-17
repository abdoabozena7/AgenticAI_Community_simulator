import { cn } from '@/lib/utils';
import type { TopBarStep } from '@/types/simulation';

interface IterationTimelineProps {
  currentIteration: number;
  totalIterations: number;
  milestones?: number[];
  language: 'ar' | 'en';
  currentPhaseKey?: string | null;
  phaseProgressPct?: number | null;
  steps?: TopBarStep[];
}

type CanonicalPhaseKey =
  | 'individual_opinions'
  | 'discussion'
  | 'neutrality_reduction'
  | 'final_convergence';

const PHASE_ORDER: CanonicalPhaseKey[] = [
  'individual_opinions',
  'discussion',
  'neutrality_reduction',
  'final_convergence',
];

const LEGACY_TO_CANONICAL: Record<string, CanonicalPhaseKey> = {
  intake: 'individual_opinions',
  search_bootstrap: 'individual_opinions',
  evidence_map: 'individual_opinions',
  research_digest: 'individual_opinions',
  agent_init: 'individual_opinions',
  debate: 'discussion',
  deliberation: 'discussion',
  convergence: 'neutrality_reduction',
  resolution: 'final_convergence',
  verdict: 'final_convergence',
  summary: 'final_convergence',
  completed: 'final_convergence',
};

const phaseLabel = (key: CanonicalPhaseKey, language: 'ar' | 'en') => {
  const labelsAr: Record<CanonicalPhaseKey, string> = {
    individual_opinions: 'الآراء الفردية',
    discussion: 'النقاش',
    neutrality_reduction: 'تقليل الحياد',
    final_convergence: 'التقارب النهائي',
  };
  const labelsEn: Record<CanonicalPhaseKey, string> = {
    individual_opinions: 'Individual Opinions',
    discussion: 'Discussion',
    neutrality_reduction: 'Neutrality Reduction',
    final_convergence: 'Final Convergence',
  };
  return language === 'ar' ? labelsAr[key] : labelsEn[key];
};

const safePct = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

const normalizePhase = (raw?: string | null): CanonicalPhaseKey | null => {
  const key = String(raw || '').trim();
  if (!key) return null;
  return LEGACY_TO_CANONICAL[key] || null;
};

export function IterationTimeline({
  currentIteration,
  totalIterations,
  milestones = [],
  language,
  currentPhaseKey,
  phaseProgressPct,
  steps = [],
}: IterationTimelineProps) {
  const normalizedPhase = normalizePhase(currentPhaseKey);
  const phaseIndex = normalizedPhase ? PHASE_ORDER.indexOf(normalizedPhase) : -1;
  const phaseRatio = safePct(phaseProgressPct) / 100;

  const phaseDrivenProgress = phaseIndex >= 0
    ? ((phaseIndex + phaseRatio) / (PHASE_ORDER.length - 1)) * 100
    : 0;

  const iterationDrivenProgress = totalIterations > 0
    ? (currentIteration / totalIterations) * 100
    : 0;

  const progress = normalizedPhase ? phaseDrivenProgress : iterationDrivenProgress;

  const defaultMilestones = totalIterations > 0
    ? [0.25, 0.5, 0.75, 1].map((p) => Math.floor(p * totalIterations))
    : [];

  const allMilestones = [...new Set([...milestones, ...defaultMilestones])]
    .filter((value) => value > 0)
    .sort((a, b) => a - b);

  const currentPhaseLabel = normalizedPhase
    ? phaseLabel(normalizedPhase, language)
    : (language === 'ar' ? 'غير محدد' : 'Unknown');

  return (
    <div className="glass-panel p-5 lg:p-6">
      {steps.length ? (
        <div className="mb-5 overflow-x-auto scrollbar-thin">
          <div className="flex min-w-max items-center gap-2 pb-1" dir="rtl">
            {steps.map((step, index) => (
              <div key={step.key} className="flex items-center gap-2">
                <div
                  className={cn(
                    'group flex min-w-[132px] items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all duration-300',
                    step.state === 'completed' && 'border-emerald-400/40 bg-emerald-500/12 text-emerald-100',
                    step.state === 'current' && 'border-white/35 bg-white text-slate-950 shadow-[0_14px_28px_-20px_rgba(255,255,255,0.9)]',
                    step.state === 'upcoming' && 'border-amber-400/40 bg-amber-500/12 text-amber-100',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300',
                      step.state === 'completed' && 'bg-emerald-400 text-slate-950',
                      step.state === 'current' && 'bg-slate-950 text-white',
                      step.state === 'upcoming' && 'bg-amber-300 text-slate-950',
                    )}
                  >
                    {step.state === 'current' ? (
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold">{index + 1}</span>
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{step.label}</div>
                    {step.subtleStatus ? (
                      <div className={cn('truncate text-[11px]', step.state === 'current' ? 'text-slate-700' : 'text-current/70')}>
                        {step.subtleStatus}
                      </div>
                    ) : null}
                  </div>
                </div>
                {index < steps.length - 1 ? (
                  <div
                    className={cn(
                      'h-px w-6 shrink-0 transition-colors duration-300',
                      step.state === 'completed' ? 'bg-emerald-400/60' : 'bg-border/70',
                    )}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
          <span className="text-base font-semibold text-foreground">
            {language === 'ar' ? 'خط التقدم' : 'Progress Timeline'}
          </span>
        </div>
        <div className="flex items-center gap-2" dir="ltr">
          <span className="text-3xl font-mono font-bold leading-none text-primary">{currentIteration}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-base font-mono text-muted-foreground">{totalIterations || '-'}</span>
        </div>
      </div>

      <div className="relative h-3.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        >
          <div className="absolute inset-0 bg-primary/30 blur-sm" />
        </div>
      </div>

      {normalizedPhase ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {language === 'ar' ? 'المرحلة الحالية' : 'Current phase'}
            </span>
            <span className="font-medium text-foreground">
              {currentPhaseLabel}
              {typeof phaseProgressPct === 'number' && ` - ${Math.round(safePct(phaseProgressPct))}%`}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
            {PHASE_ORDER.map((phase, index) => {
              const passed = phaseIndex > index;
              const active = phaseIndex === index;
              return (
                <div
                  key={phase}
                  className={cn(
                    'truncate rounded-md border px-2 py-1.5 text-center text-xs',
                    passed && 'border-primary/40 bg-primary/10 text-primary',
                    active && 'border-accent/50 bg-accent/15 text-foreground',
                    !passed && !active && 'border-border/40 bg-secondary/30 text-muted-foreground',
                  )}
                  title={phaseLabel(phase, language)}
                >
                  {phaseLabel(phase, language)}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {!normalizedPhase && totalIterations > 0 ? (
        <div className="relative mt-2 h-5" dir="ltr">
          {allMilestones.map((milestone) => {
            const position = (milestone / totalIterations) * 100;
            const isPassed = currentIteration >= milestone;
            return (
              <span
                key={milestone}
                className={cn(
                  'absolute -translate-x-1/2 text-xs font-mono transition-colors duration-300',
                  isPassed ? 'text-primary' : 'text-muted-foreground',
                )}
                style={{ left: `${position}%` }}
              >
                {milestone}
              </span>
            );
          })}
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between border-t border-border/50 pt-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className={cn('h-2 w-2 rounded-full', progress > 0 ? 'bg-success' : 'bg-muted-foreground/30')} />
            <span className="text-sm text-muted-foreground">{language === 'ar' ? 'بداية' : 'Started'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={cn('h-2 w-2 rounded-full', progress >= 50 ? 'bg-warning' : 'bg-muted-foreground/30')} />
            <span className="text-sm text-muted-foreground">{language === 'ar' ? 'منتصف' : 'Midpoint'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={cn('h-2 w-2 rounded-full', progress >= 100 ? 'bg-primary' : 'bg-muted-foreground/30')} />
            <span className="text-sm text-muted-foreground">{language === 'ar' ? 'اكتمال' : 'Complete'}</span>
          </div>
        </div>
        <span className="text-sm text-muted-foreground" dir="ltr">
          {language === 'ar' ? `اكتمل ${progress.toFixed(0)}%` : `${progress.toFixed(0)}% complete`}
        </span>
      </div>
    </div>
  );
}
