import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Beaker, CheckCircle2, Gauge, Search, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { apiService, type DevLabSuiteCase, type DevLabSuiteStateResponse } from '@/services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const buildDefaultCases = (isArabic: boolean): DevLabSuiteCase[] => {
  if (isArabic) {
    return [
      {
        key: 'good_idea',
        title: 'فكرة ممتازة',
        idea: 'تطبيق ذكي لاكتشاف تسرب المياه عبر حساسات IoT مع تنبيهات فورية وتقارير توفير.',
        expected: { accept_min: 0.55, neutral_max: 0.3 },
      },
      {
        key: 'bad_idea',
        title: 'فكرة خطرة',
        idea: 'نظام يراقب الرسائل الخاصة وGPS ويمنع المتقدمين للعمل خمس سنوات تلقائيًا.',
        expected: { reject_min: 0.7, accept_max: 0.1, neutral_max: 0.3 },
      },
      {
        key: 'ambiguous_idea',
        title: 'فكرة غامضة',
        idea: 'منصة ذكاء اصطناعي لتحسين التوظيف بدون نطاق واضح أو معايير قرار محددة.',
        expected: { clarification_min: 1, neutral_max: 0.3 },
      },
    ];
  }

  return [
    {
      key: 'good_idea',
      title: 'Great idea',
      idea: 'IoT water leak detection with instant alerts and monthly savings reports.',
      expected: { accept_min: 0.55, neutral_max: 0.3 },
    },
    {
      key: 'bad_idea',
      title: 'Harmful idea',
      idea: 'A system that reads private chats and GPS data to auto-ban job applicants for five years.',
      expected: { reject_min: 0.7, accept_max: 0.1, neutral_max: 0.3 },
    },
    {
      key: 'ambiguous_idea',
      title: 'Ambiguous idea',
      idea: 'An AI hiring platform with no clear target segment or decision constraints.',
      expected: { clarification_min: 1, neutral_max: 0.3 },
    },
  ];
};

type StatTileProps = {
  label: string;
  value: string;
  caption?: string;
};

function StatTile({ label, value, caption }: StatTileProps) {
  return (
    <div className="rounded-2xl bg-background/55 p-4">
      <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
      {caption ? <div className="mt-2 text-xs text-muted-foreground">{caption}</div> : null}
    </div>
  );
}

function SurfaceCard({ title, icon: Icon, children }: { title: string; icon: typeof Search; children: ReactNode }) {
  return (
    <section className="architect-panel space-y-5 p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{title}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function DeveloperLabTab() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const t = (en: string, ar: string) => (language === 'ar' ? ar : en);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<any | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [llmPrompt, setLlmPrompt] = useState('');
  const [llmSystem, setLlmSystem] = useState('');
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmResult, setLlmResult] = useState<any | null>(null);
  const [llmError, setLlmError] = useState<string | null>(null);

  const [agentCount, setAgentCount] = useState(20);
  const [iterations, setIterations] = useState(4);
  const [neutralCapPct, setNeutralCapPct] = useState(30);
  const [suiteCases, setSuiteCases] = useState<DevLabSuiteCase[]>(() => buildDefaultCases(language === 'ar'));
  const [suiteLoading, setSuiteLoading] = useState(false);
  const [suiteId, setSuiteId] = useState<string | null>(null);
  const [suiteState, setSuiteState] = useState<DevLabSuiteStateResponse | null>(null);
  const [suiteError, setSuiteError] = useState<string | null>(null);
  const [suiteHistory, setSuiteHistory] = useState<Array<{ suite_id: string; status: string; created_at?: string }>>([]);

  const shellClass = theme === 'dark' ? 'architect-shell architect-shell-dark' : 'architect-shell architect-shell-light';

  const getCaseStatusMeta = (status?: string, pass?: boolean | null) => {
    const normalized = String(status || 'pending').toLowerCase();
    if (pass === true || normalized === 'completed') {
      return { label: t('Completed', 'مكتمل'), variant: 'outline' as const };
    }
    if (normalized === 'failed') {
      return { label: t('Failed', 'فشل'), variant: 'destructive' as const };
    }
    if (normalized === 'running') {
      return { label: t('Running', 'جارٍ'), variant: 'secondary' as const };
    }
    return { label: t('Pending', 'قيد الانتظار'), variant: 'secondary' as const };
  };

  useEffect(() => {
    setSuiteCases(buildDefaultCases(language === 'ar'));
  }, [language]);

  const loadSuiteState = async (id: string) => {
    const state = await apiService.getDevlabReasoningSuiteState(id);
    setSuiteState(state);
    return state;
  };

  const loadSuiteHistory = async () => {
    try {
      const list = await apiService.listDevlabReasoningSuites(15, 0);
      setSuiteHistory(list.items || []);
    } catch {
      // history is optional in the UI
    }
  };

  useEffect(() => {
    void loadSuiteHistory();
  }, []);

  useEffect(() => {
    if (!suiteId) return;
    let active = true;
    let timer: number | undefined;

    const tick = async () => {
      try {
        const state = await loadSuiteState(suiteId);
        if (!active) return;
        if (state.status === 'running') {
          timer = window.setTimeout(tick, 2000);
        } else {
          await loadSuiteHistory();
        }
      } catch (err: any) {
        if (!active) return;
        setSuiteError(err?.message || t('Failed to refresh suite state.', 'تعذر تحديث حالة الحزمة.'));
      }
    };

    tick();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [suiteId]);

  const checklist = useMemo(() => {
    const cases = suiteState?.cases || [];
    const hasClarification = cases.some((item) => Number((item.actual || {}).clarification_count || 0) > 0);
    const neutralLimit = Math.ceil(agentCount * (neutralCapPct / 100));
    const neutralCheck = cases.every((item) => Number((item.actual || {}).neutral || 0) <= neutralLimit);
    const fallbackCheck = cases.every((item) => Number((item.actual || {}).fallback_ratio || 0) <= 0.4);
    return [
      { label: t('Search strict mode active', 'وضع البحث الصارم مفعّل'), pass: Boolean(searchResult?.strict_mode) },
      { label: t('Clarification triggered when needed', 'تم تشغيل التوضيح عند الحاجة'), pass: hasClarification },
      { label: t('Neutral <= target cap', 'الحياد ضمن السقف المستهدف'), pass: neutralCheck },
      { label: t('Fallback ratio in acceptable range', 'نسبة fallback ضمن النطاق المقبول'), pass: fallbackCheck },
      { label: t('Arabic encoding healthy', 'ترميز العربية سليم'), pass: !Boolean(llmResult?.mojibake_detected) },
    ];
  }, [suiteState, searchResult, llmResult, neutralCapPct, agentCount, language]);

  const runSearchTest = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const result = await apiService.devlabSearchTest({
        query: searchQuery.trim(),
        language: language as 'ar' | 'en',
        max_results: 6,
      });
      setSearchResult(result);
    } catch (err: any) {
      setSearchError(err?.message || t('Search test failed.', 'فشل اختبار البحث.'));
    } finally {
      setSearchLoading(false);
    }
  };

  const runLlmTest = async () => {
    if (!llmPrompt.trim()) return;
    setLlmLoading(true);
    setLlmError(null);
    try {
      const result = await apiService.devlabLlmTest({
        prompt: llmPrompt.trim(),
        system: llmSystem.trim() || undefined,
        language: language as 'ar' | 'en',
      });
      setLlmResult(result);
    } catch (err: any) {
      setLlmError(err?.message || t('LLM test failed.', 'فشل اختبار النموذج.'));
    } finally {
      setLlmLoading(false);
    }
  };

  const runSuite = async () => {
    setSuiteLoading(true);
    setSuiteError(null);
    try {
      const response = await apiService.startDevlabReasoningSuite({
        language: language as 'ar' | 'en',
        agent_count: agentCount,
        iterations,
        neutral_cap_pct: Math.max(5, Math.min(70, neutralCapPct)) / 100,
        cases: suiteCases,
      });
      setSuiteId(response.suite_id);
      await loadSuiteState(response.suite_id);
    } catch (err: any) {
      setSuiteError(err?.message || t('Failed to start reasoning suite.', 'فشل تشغيل حزمة الاختبارات.'));
    } finally {
      setSuiteLoading(false);
    }
  };

  const statSummary = [
    { label: t('Agents', 'الوكلاء'), value: `${agentCount}` },
    { label: t('Iterations', 'التكرارات'), value: `${iterations}` },
    { label: t('Neutral cap', 'سقف الحياد'), value: `${neutralCapPct}%` },
  ];

  return (
    <div className={cn(shellClass, 'space-y-8')}>
      <header className="architect-hero">
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
            {t('Developer workspace', 'مساحة المطور')}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{t('Developer Lab', 'مختبر المطور')}</h1>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
            {t(
              'Test search, LLM output, and multi-case reasoning from one calm operational surface.',
              'اختبر البحث، ومخرجات النموذج، والاستدلال متعدد الحالات من سطح تشغيلي واحد هادئ.'
            )}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {statSummary.map((item) => (
            <StatTile key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <SurfaceCard title={t('Search playground', 'ساحة البحث')} icon={Search}>
            <div className="space-y-4">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('Type query...', 'اكتب الاستعلام...')}
                className="architect-input"
              />
              <Button onClick={runSearchTest} disabled={searchLoading || !searchQuery.trim()} className="architect-button-primary">
                {searchLoading ? t('Running...', 'جارٍ التنفيذ...') : t('Run Search Test', 'تشغيل اختبار البحث')}
              </Button>
              {searchError ? <div className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{searchError}</div> : null}
              {searchResult ? (
                <div className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Badge variant="outline">{`${t('Latency', 'الزمن')}: ${searchResult.latency_ms}ms`}</Badge>
                    <Badge variant="outline">{`usable: ${searchResult.quality?.usable_sources ?? 0}`}</Badge>
                    <Badge variant="outline">{`domains: ${searchResult.quality?.domains ?? 0}`}</Badge>
                  </div>
                  <div className="max-h-60 space-y-3 overflow-auto pr-1">
                    {(searchResult.results || []).map((item: any, idx: number) => {
                      const domain = item.domain || '';
                      const favicon = domain
                        ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
                        : '';
                      return (
                        <article key={`${item.url}-${idx}`} className="architect-ledger-row rounded-2xl px-4 py-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            {favicon ? <img src={favicon} alt={domain} className="h-4 w-4 rounded-sm" /> : null}
                            <span className="truncate">{item.title || item.url}</span>
                          </div>
                          <p className="mt-1 break-all text-xs text-muted-foreground">{item.url}</p>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-7 text-muted-foreground">
                  {t('Search results appear here after a run.', 'ستظهر نتائج البحث هنا بعد التشغيل.')}
                </p>
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard title={t('LLM playground', 'ساحة النموذج')} icon={Sparkles}>
            <div className="space-y-4">
              <Textarea
                value={llmPrompt}
                onChange={(e) => setLlmPrompt(e.target.value)}
                placeholder={t('Prompt...', 'اكتب البرومبت...')}
                className="architect-input min-h-28 resize-none"
              />
              <Textarea
                value={llmSystem}
                onChange={(e) => setLlmSystem(e.target.value)}
                placeholder={t('Optional system prompt...', 'تعليمات النظام (اختياري)...')}
                className="architect-input min-h-20 resize-none"
              />
              <Button onClick={runLlmTest} disabled={llmLoading || !llmPrompt.trim()} className="architect-button-primary">
                {llmLoading ? t('Running...', 'جارٍ التنفيذ...') : t('Run LLM Test', 'تشغيل اختبار النموذج')}
              </Button>
              {llmError ? <div className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{llmError}</div> : null}
              {llmResult ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{`${t('Latency', 'الزمن')}: ${llmResult.latency_ms}ms`}</Badge>
                    <Badge variant={llmResult.mojibake_detected ? 'destructive' : 'outline'}>
                      {llmResult.mojibake_detected
                        ? t('Encoding issue detected', 'تم رصد مشكلة ترميز')
                        : t('Encoding OK', 'الترميز سليم')}
                    </Badge>
                  </div>
                  <div className="rounded-2xl bg-background/45 p-4 text-sm whitespace-pre-wrap leading-7 text-foreground">
                    {llmResult.text}
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-7 text-muted-foreground">
                  {t('Model output will appear here.', 'ستظهر مخرجات النموذج هنا.')}
                </p>
              )}
            </div>
          </SurfaceCard>
        </div>

        <div className="space-y-6">
          <section className="architect-panel space-y-5 p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-foreground">
                <Gauge className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  {t('Reasoning suite', 'حزمة الاستدلال')}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('Tune the batch before running the suite.', 'اضبط الدفعة قبل تشغيل الحزمة.')}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Input
                type="number"
                value={agentCount}
                onChange={(e) => setAgentCount(Math.max(6, Math.min(500, Number(e.target.value) || 20)))}
                className="architect-input"
              />
              <Input
                type="number"
                value={iterations}
                onChange={(e) => setIterations(Math.max(1, Math.min(12, Number(e.target.value) || 4)))}
                className="architect-input"
              />
              <Input
                type="number"
                value={neutralCapPct}
                onChange={(e) => setNeutralCapPct(Math.max(5, Math.min(70, Number(e.target.value) || 30)))}
                className="architect-input"
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {suiteCases.map((item, idx) => (
                <div key={item.key} className="rounded-2xl bg-background/45 p-4">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <Textarea
                    value={item.idea}
                    onChange={(e) => {
                      const next = [...suiteCases];
                      next[idx] = { ...next[idx], idea: e.target.value };
                      setSuiteCases(next);
                    }}
                    className="architect-input mt-3 min-h-28 resize-none"
                  />
                </div>
              ))}
            </div>

            <Button onClick={runSuite} disabled={suiteLoading} className="architect-button-primary">
              {suiteLoading ? t('Starting...', 'جارٍ التشغيل...') : t('Run Reasoning Suite', 'تشغيل حزمة الاستدلال')}
            </Button>

            {suiteError ? <div className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{suiteError}</div> : null}

            {suiteState ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{`Suite: ${suiteState.suite_id.slice(0, 8)}`}</Badge>
                  <Badge variant="outline">{`${t('Progress', 'التقدم')}: ${Math.round(Number(suiteState.progress_pct || 0))}%`}</Badge>
                  <Badge variant={suiteState.status === 'completed' ? 'outline' : suiteState.status === 'failed' ? 'destructive' : 'secondary'}>
                    {suiteState.status}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {(suiteState.cases || []).map((item) => {
                    const meta = getCaseStatusMeta(item.status, item.pass);
                    return (
                      <div key={item.key} className="architect-ledger-row rounded-2xl px-4 py-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">{item.key}</span>
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                          {item.simulation_id ? (
                            <span className="text-xs text-muted-foreground">{`sim: ${item.simulation_id.slice(0, 8)}`}</span>
                          ) : null}
                        </div>
                        {Array.isArray(item.failures) && item.failures.length > 0 ? (
                          <p className="mt-2 text-xs text-rose-300">{item.failures.join(', ')}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm leading-7 text-muted-foreground">
                {t('Start a suite to see progress, case statuses, and developer assertions.', 'ابدأ الحزمة لرؤية التقدم وحالات الاختبارات ونتائج التحقق.')}
              </p>
            )}
          </section>

          <section className="architect-panel space-y-4 p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-foreground">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  {t('Developer checks', 'فحوصات المطور')}
                </div>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {checklist.map((item) => (
                <div key={item.label} className="architect-ledger-row flex items-center justify-between rounded-2xl px-4 py-3 text-sm">
                  <span className="text-foreground">{item.label}</span>
                  {item.pass ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="architect-panel space-y-4 p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-foreground">
                <Beaker className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  {t('Recent suite runs', 'أحدث الحزم')}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {suiteHistory.map((item) => (
                <div key={item.suite_id} className="architect-ledger-row flex items-center justify-between rounded-2xl px-4 py-3 text-sm">
                  <span className="text-foreground">{item.suite_id.slice(0, 8)}</span>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
              ))}
              {!suiteHistory.length ? (
                <p className="text-sm leading-7 text-muted-foreground">
                  {t('No suite history yet.', 'لا يوجد سجل حزم حتى الآن.')}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
