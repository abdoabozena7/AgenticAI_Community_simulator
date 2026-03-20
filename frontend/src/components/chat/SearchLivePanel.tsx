import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  FileText,
  Globe2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SearchPanelModel } from '@/lib/searchPanelModel';

interface SearchLivePanelProps {
  model: SearchPanelModel;
}

const stepToneClasses: Record<'pending' | 'running' | 'completed' | 'blocked', string> = {
  pending: 'border-border/60 bg-background/55 text-muted-foreground',
  running: 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100',
  completed: 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100',
  blocked: 'border-amber-400/35 bg-amber-500/10 text-amber-100',
};

const noteToneClasses: Record<'info' | 'success' | 'warning', string> = {
  info: 'border-sky-400/25 bg-sky-500/8',
  success: 'border-emerald-400/25 bg-emerald-500/8',
  warning: 'border-amber-400/30 bg-amber-500/10',
};

export function SearchLivePanel({ model }: SearchLivePanelProps) {
  if (model.stage === 'hidden') return null;

  const isArabic = /[\u0600-\u06FF]/.test(model.title + model.subtitle + model.description);

  return (
    <section className="rounded-[28px] border border-border/60 bg-card/75 p-4 shadow-[0_20px_60px_-34px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
            {model.isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe2 className="h-3.5 w-3.5" />}
            <span>{model.title}</span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">{model.subtitle}</h3>
            <p className="text-sm leading-7 text-muted-foreground">{model.description}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/55 px-3 py-2 text-start">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {isArabic ? 'الحالة' : 'Status'}
          </div>
          <div className="mt-1 text-sm font-semibold text-foreground">{model.statusLabel}</div>
        </div>
      </div>

      {model.pipelineSteps.length ? (
        <div className="mt-4 rounded-[24px] border border-border/50 bg-background/35 p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>{isArabic ? 'مسار التنفيذ الحالي' : 'Current execution flow'}</span>
          </div>
          <div className="grid gap-2">
            {model.pipelineSteps.map((step, index) => (
              <div
                key={`${step.key}-${index}`}
                className={cn('rounded-2xl border px-3 py-3 transition-colors', stepToneClasses[step.status])}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/10">
                    {step.status === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : step.status === 'blocked' ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : step.status === 'running' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <div className="h-2.5 w-2.5 rounded-full bg-current/70" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{step.label}</div>
                    {step.detail ? <div className="mt-1 text-xs leading-6 text-current/80">{step.detail}</div> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {model.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-background/35 px-4 py-5 text-sm text-muted-foreground">
            <div className="text-sm font-semibold text-foreground">{model.emptyTitle}</div>
            <div className="mt-2 leading-7">{model.emptyDescription}</div>
          </div>
        ) : (
          model.items.map((item) => {
            if (item.kind === 'summary') {
              return (
                <article key={item.id} className="rounded-2xl border border-border/55 bg-background/55 p-4 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-2xl border border-border/50 bg-card text-muted-foreground">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="truncate text-sm font-semibold text-foreground">{item.title}</div>
                        <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                          <Sparkles className="h-3 w-3" />
                          <span>{item.badgeLabel}</span>
                        </div>
                      </div>
                      <div className="mt-3 rounded-xl border border-border/45 bg-card/45 px-3 py-3 leading-7 text-foreground/90">
                        {item.content}
                      </div>
                    </div>
                  </div>
                </article>
              );
            }

            if (item.kind === 'note') {
              return (
                <article
                  key={item.id}
                  className={cn(
                    'rounded-2xl border p-4 transition-colors',
                    noteToneClasses[item.tone || 'info'],
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/10 text-foreground">
                      {item.tone === 'warning' ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : item.tone === 'success' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="text-sm font-semibold text-foreground">{item.title}</div>
                        <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-[11px] font-medium text-foreground/80">
                          <Sparkles className="h-3 w-3" />
                          <span>{item.badgeLabel}</span>
                        </div>
                      </div>
                      <div className="mt-3 text-sm leading-7 text-foreground/90">{item.content}</div>
                      {item.bullets?.length ? (
                        <div className="mt-3 space-y-2">
                          {item.bullets.map((bullet, index) => (
                            <div key={`${item.id}-bullet-${index}`} className="rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-xs leading-6 text-foreground/85">
                              {bullet}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {item.cta ? (
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-xs leading-6 text-foreground/80">
                          {item.cta}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            }

            return (
              <article
                key={item.id}
                className={cn(
                  'rounded-2xl border border-border/55 bg-background/55 p-3 transition-colors',
                  item.kind === 'live_event' && item.highlighted && 'border-primary/30 bg-primary/5',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-2xl border border-border/50 bg-card">
                    {item.faviconUrl ? (
                      <img
                        src={item.faviconUrl}
                        alt={item.domain || item.title}
                        className="h-5 w-5 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <FileSearch className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">{item.title}</div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground" dir="ltr">
                          <span className="truncate">{item.url || item.domain}</span>
                          {'url' in item && item.url ? <ExternalLink className="h-3 w-3 flex-none" /> : null}
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        <Sparkles className="h-3 w-3" />
                        <span>{item.badgeLabel}</span>
                      </div>
                    </div>

                    {item.kind === 'live_event' ? (
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{isArabic ? 'تقدم الخطوة' : 'Step progress'}</span>
                          <span>{item.progress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-secondary/70">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="rounded-xl border border-border/45 bg-card/45 px-3 py-2 leading-6 text-foreground/85">
                        {item.preview}
                      </div>
                      <div className="flex flex-col items-start gap-1 rounded-xl border border-border/45 bg-card/45 px-3 py-2 text-[11px]">
                        {'httpStatus' in item && typeof item.httpStatus === 'number' ? (
                          <span>{`HTTP: ${item.httpStatus}`}</span>
                        ) : null}
                        {'contentChars' in item && typeof item.contentChars === 'number' ? (
                          <span>{isArabic ? `${item.contentChars} حرف` : `${item.contentChars} chars`}</span>
                        ) : null}
                        {typeof item.relevanceScore === 'number' ? (
                          <span>{isArabic ? `صلة ${Math.round(item.relevanceScore * 100)}%` : `Relevance ${Math.round(item.relevanceScore * 100)}%`}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
