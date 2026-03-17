import type { ReactNode } from 'react';
import { CheckCircle, MinusCircle, TrendingUp, Users, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { formatCount, formatPercent, hasMetricsData } from '@/lib/simulationUi';
import { SimulationMetrics } from '@/types/simulation';
import { cn } from '@/lib/utils';

interface MetricsPanelProps {
  metrics: SimulationMetrics;
  language: 'ar' | 'en';
  headline?: string;
  description?: string;
  emptyLabel?: string;
  onSelectStance?: (stance: 'accepted' | 'rejected' | 'neutral') => void;
  selectedStance?: 'accepted' | 'rejected' | 'neutral' | null;
  filteredAgents?: {
    agent_id: string;
    agent_label?: string;
    agent_short_id?: string;
    archetype?: string;
    opinion: 'accept' | 'reject' | 'neutral';
  }[];
  filteredAgentsTotal?: number;
}

interface MiniMetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  share: string;
  tone: 'success' | 'destructive' | 'neutral';
  active?: boolean;
  onClick?: () => void;
}

const toneClasses = {
  success: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100',
  destructive: 'border-rose-400/25 bg-rose-500/10 text-rose-100',
  neutral: 'border-border/60 bg-background/55 text-foreground',
};

function MiniMetricCard({ icon, label, value, share, tone, active = false, onClick }: MiniMetricCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-[24px] border p-4 text-start transition',
        toneClasses[tone],
        onClick ? 'hover:border-primary/35' : 'cursor-default',
        active && 'ring-1 ring-primary/50',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-black/10">
            {icon}
          </span>
          <span>{label}</span>
        </div>
        <span className="text-xs text-current/70">{share}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
    </button>
  );
}

export function MetricsPanel({
  metrics,
  language,
  headline,
  description,
  emptyLabel,
  onSelectStance,
  selectedStance = null,
  filteredAgents = [],
  filteredAgentsTotal = 0,
}: MetricsPanelProps) {
  const hasData = hasMetricsData(metrics);
  const totalAgents = Number.isFinite(metrics.totalAgents) ? metrics.totalAgents : 0;
  const accepted = Number.isFinite(metrics.accepted) ? metrics.accepted : 0;
  const rejected = Number.isFinite(metrics.rejected) ? metrics.rejected : 0;
  const neutral = Number.isFinite(metrics.neutral) ? metrics.neutral : 0;
  const acceptanceRate = Number.isFinite(metrics.acceptanceRate) ? metrics.acceptanceRate : 0;
  const totalIterations = Number.isFinite(metrics.totalIterations) ? metrics.totalIterations : 0;
  const currentIteration = Number.isFinite(metrics.currentIteration) ? metrics.currentIteration : 0;
  const progressValue = totalIterations > 0 ? Math.min(100, Math.max(0, (currentIteration / totalIterations) * 100)) : 0;
  const categories = Object.entries(metrics.perCategoryAccepted || {})
    .filter(([, count]) => Number.isFinite(count) && count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const waitingLabel = emptyLabel || (language === 'ar' ? 'بانتظار البيانات' : 'Waiting for data');
  const panelHeadline = headline || (language === 'ar' ? 'مؤشرات القرار' : 'Decision metrics');
  const panelDescription = description || (language === 'ar' ? 'ملخص سريع يساعدك على فهم اتجاه التقييم الآن.' : 'A compact summary to understand the current direction.');

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[28px] border border-border/55 bg-card/65">
      <div className="border-b border-border/45 px-4 py-4">
        <h2 className="text-lg font-semibold text-foreground">{panelHeadline}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{panelDescription}</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 scrollbar-thin">
        {!hasData ? (
          <div className="rounded-[24px] border border-dashed border-border/60 bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
            {waitingLabel}
          </div>
        ) : (
          <>
            <section className="rounded-[26px] border border-primary/20 bg-primary/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-primary">{language === 'ar' ? 'الحالة العامة' : 'Overall status'}</div>
                  <div className="mt-1 text-2xl font-semibold text-foreground">
                    {formatPercent(acceptanceRate, waitingLabel, 1)}
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-background/50 text-primary">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{language === 'ar' ? 'إجمالي الوكلاء' : 'Total agents'}</span>
                <span>{formatCount(totalAgents, waitingLabel)}</span>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-3">
              <MiniMetricCard
                icon={<CheckCircle className="h-4 w-4" />}
                label={language === 'ar' ? 'مؤيد' : 'Accepted'}
                value={formatCount(accepted, waitingLabel)}
                share={formatPercent(totalAgents > 0 ? (accepted / totalAgents) * 100 : 0, waitingLabel)}
                tone="success"
                onClick={onSelectStance ? () => onSelectStance('accepted') : undefined}
                active={selectedStance === 'accepted'}
              />
              <MiniMetricCard
                icon={<XCircle className="h-4 w-4" />}
                label={language === 'ar' ? 'رافض' : 'Rejected'}
                value={formatCount(rejected, waitingLabel)}
                share={formatPercent(totalAgents > 0 ? (rejected / totalAgents) * 100 : 0, waitingLabel)}
                tone="destructive"
                onClick={onSelectStance ? () => onSelectStance('rejected') : undefined}
                active={selectedStance === 'rejected'}
              />
              <MiniMetricCard
                icon={<MinusCircle className="h-4 w-4" />}
                label={language === 'ar' ? 'محايد' : 'Neutral'}
                value={formatCount(neutral, waitingLabel)}
                share={formatPercent(totalAgents > 0 ? (neutral / totalAgents) * 100 : 0, waitingLabel)}
                tone="neutral"
                onClick={onSelectStance ? () => onSelectStance('neutral') : undefined}
                active={selectedStance === 'neutral'}
              />
            </div>

            <section className="rounded-[24px] border border-border/60 bg-background/45 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground">{language === 'ar' ? 'تقدم المحاكاة' : 'Simulation progress'}</div>
                <div className="text-xs text-muted-foreground">
                  {totalIterations > 0
                    ? `${formatCount(currentIteration, waitingLabel)}/${formatCount(totalIterations, waitingLabel)}`
                    : waitingLabel}
                </div>
              </div>
              <Progress value={progressValue} className="h-2" />
            </section>

            {selectedStance ? (
              <section className="rounded-[24px] border border-border/60 bg-background/45 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-foreground">{language === 'ar' ? 'عينة الوكلاء' : 'Agent sample'}</div>
                  {filteredAgentsTotal > filteredAgents.length ? (
                    <div className="text-xs text-muted-foreground">
                      {language === 'ar'
                        ? `المعروض ${filteredAgents.length} من ${filteredAgentsTotal}`
                        : `Showing ${filteredAgents.length} of ${filteredAgentsTotal}`}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-2">
                  {filteredAgents.length ? filteredAgents.map((agent) => (
                    <div key={agent.agent_id} className="rounded-2xl border border-border/50 px-3 py-2">
                      <div className="text-sm font-medium text-foreground">
                        {agent.agent_label || agent.agent_short_id || agent.agent_id.slice(0, 4)}
                      </div>
                      {agent.archetype ? (
                        <div className="mt-1 text-xs text-muted-foreground">{agent.archetype}</div>
                      ) : null}
                    </div>
                  )) : (
                    <div className="text-sm text-muted-foreground">{waitingLabel}</div>
                  )}
                </div>
              </section>
            ) : null}

            {categories.length ? (
              <section className="rounded-[24px] border border-border/60 bg-background/45 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Users className="h-4 w-4" />
                  <span>{language === 'ar' ? 'أقوى الفئات قبولًا' : 'Most accepting categories'}</span>
                </div>
                <div className="space-y-3">
                  {categories.map(([category, count]) => (
                    <div key={category} className="flex items-center justify-between gap-3 rounded-2xl border border-border/45 px-3 py-2">
                      <span className="text-sm text-foreground">{category}</span>
                      <span className="text-sm font-semibold text-emerald-200">{count}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
