import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/Header';
import { TopBar } from '@/components/TopBar';
import { ConfigPanel } from '@/components/ConfigPanel';
import { ChatPanel } from '@/components/ChatPanel';
import { MetricsPanel } from '@/components/MetricsPanel';
import { SimulationPanel } from '@/components/SimulationPanel';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useSimulation } from '@/hooks/useSimulation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { buildSimulationUiState } from '@/lib/simulationUi';
import { apiService, type SimulationConfig } from '@/services/api';
import { websocketService } from '@/services/websocket';
import type { ChatMessage, UserInput } from '@/types/simulation';

const DEFAULT_INPUT: UserInput = {
  idea: '',
  category: 'technology',
  targetAudience: ['Consumers'],
  country: 'Egypt',
  city: 'Cairo',
  riskAppetite: 45,
  ideaMaturity: 'concept',
  goals: ['Market Validation'],
  agentCount: 24,
};

const toOpinion = (status: 'accepted' | 'rejected' | 'neutral' | 'thinking' | 'reasoning') => {
  if (status === 'accepted') return 'accept';
  if (status === 'rejected') return 'reject';
  return 'neutral';
};

const buildMissingFields = (input: UserInput) => {
  const missing: string[] = [];
  if (!input.idea.trim()) missing.push('idea');
  if (!input.category.trim()) missing.push('category');
  if (!input.country.trim()) missing.push('country');
  if (!input.city.trim()) missing.push('city');
  if (!input.targetAudience.length) missing.push('target_audience');
  if (!input.goals.length) missing.push('goals');
  if (!input.ideaMaturity) missing.push('idea_maturity');
  return missing;
};

const buildConfig = (input: UserInput, language: 'ar' | 'en'): SimulationConfig => ({
  idea: input.idea.trim(),
  category: input.category,
  targetAudience: input.targetAudience,
  country: input.country.trim(),
  city: input.city.trim(),
  placeName: input.placeName?.trim() || '',
  riskAppetite: input.riskAppetite,
  ideaMaturity: input.ideaMaturity,
  goals: input.goals,
  agentCount: input.agentCount,
  language,
});

export default function Index() {
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const simulation = useSimulation();

  const [userInput, setUserInput] = useState<UserInput>(DEFAULT_INPUT);
  const [showSettings, setShowSettings] = useState(false);
  const [activePanel, setActivePanel] = useState<'config' | 'chat' | 'reasoning'>('config');
  const [selectedStance, setSelectedStance] = useState<'accepted' | 'rejected' | 'neutral' | null>(null);
  const [notes, setNotes] = useState<ChatMessage[]>([]);
  const [resultSummary, setResultSummary] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');

  const missingFields = useMemo(() => buildMissingFields(userInput), [userInput]);
  const isConfigLocked = simulation.status === 'running' || simulation.status === 'paused';

  useEffect(() => {
    const syncConnection = () => {
      const connected = websocketService.isConnected();
      if (connected) {
        setConnectionState('connected');
        return;
      }
      if (simulation.status === 'running' && simulation.simulationId) {
        setConnectionState('reconnecting');
        return;
      }
      setConnectionState('disconnected');
    };

    syncConnection();
    const timer = window.setInterval(syncConnection, 1000);
    return () => window.clearInterval(timer);
  }, [simulation.simulationId, simulation.status]);

  useEffect(() => {
    if (simulation.status !== 'completed' || !simulation.simulationId) return;
    let cancelled = false;
    apiService.getSimulationResult(simulation.simulationId)
      .then((result) => {
        if (cancelled) return;
        setResultSummary(typeof result.summary === 'string' && result.summary.trim() ? result.summary : null);
      })
      .catch(() => {
        if (!cancelled) {
          setResultSummary(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [simulation.simulationId, simulation.status]);

  const simulationUiState = useMemo(() => buildSimulationUiState({
    language,
    phaseKey: simulation.currentPhaseKey,
    simulationStatus: simulation.status,
    simulationError: simulation.error,
    pipeline: simulation.pipeline,
  }), [language, simulation.currentPhaseKey, simulation.error, simulation.pipeline, simulation.status]);

  const agents = useMemo(() => Array.from(simulation.agents.values()), [simulation.agents]);

  const filteredAgents = useMemo(() => {
    if (!selectedStance) return [];
    return agents
      .filter((agent) => agent.status === selectedStance)
      .slice(0, 8)
      .map((agent) => ({
        agent_id: agent.id,
        agent_label: agent.id.slice(0, 8),
        opinion: toOpinion(agent.status),
      }));
  }, [agents, selectedStance]);

  const chatMessages = useMemo<ChatMessage[]>(() => {
    const messages: ChatMessage[] = [
      {
        id: 'system-intro',
        type: 'system',
        content: language === 'ar'
          ? 'اضبط الفكرة ثم شغّل المحاكاة لمراقبة تفاعل المجتمع الوكيل.'
          : 'Configure the idea, then run the simulation to observe the agent society.',
        timestamp: 1,
      },
    ];

    if (userInput.idea.trim()) {
      messages.push({
        id: 'idea',
        type: 'user',
        content: userInput.idea.trim(),
        timestamp: 2,
      });
    }

    if (simulation.simulationId) {
      messages.push({
        id: 'run-meta',
        type: 'system',
        content: `${language === 'ar' ? 'معرّف الجلسة' : 'Run ID'}: ${simulation.simulationId}`,
        timestamp: 3,
      });
    }

    if (simulation.currentPhaseKey) {
      messages.push({
        id: 'phase-meta',
        type: 'system',
        content: `${language === 'ar' ? 'المرحلة الحالية' : 'Current phase'}: ${simulation.currentPhaseKey}`,
        timestamp: 4,
      });
    }

    if (simulation.error) {
      messages.push({
        id: 'runtime-error',
        type: 'system',
        content: simulation.error,
        timestamp: 5,
      });
    }

    const summary = simulation.summary || resultSummary;
    if (summary) {
      messages.push({
        id: 'result-summary',
        type: 'system',
        content: summary,
        timestamp: 6,
      });
    }

    return [...messages, ...notes];
  }, [language, notes, resultSummary, simulation.currentPhaseKey, simulation.error, simulation.simulationId, simulation.summary, userInput.idea]);

  const handleInputChange = useCallback((updates: Partial<UserInput>) => {
    setUserInput((current) => ({ ...current, ...updates }));
  }, []);

  const handleStart = useCallback(async () => {
    if (missingFields.length) return;
    setResultSummary(null);
    setSelectedStance(null);
    setActivePanel('reasoning');
    await simulation.startSimulation(buildConfig(userInput, language));
  }, [language, missingFields.length, simulation, userInput]);

  const handlePause = useCallback(async () => {
    if (!simulation.simulationId) return;
    await simulation.pauseSimulation(simulation.simulationId, 'paused_manual');
  }, [simulation]);

  const handleResume = useCallback(async () => {
    if (!simulation.simulationId) return;
    await simulation.resumeSimulation(simulation.simulationId);
  }, [simulation]);

  const handleReset = useCallback(() => {
    simulation.stopSimulation();
    setResultSummary(null);
    setSelectedStance(null);
    setActivePanel('config');
  }, [simulation]);

  const handleSendNote = useCallback((content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setNotes((current) => [
      ...current,
      {
        id: `note-${Date.now()}`,
        type: 'user',
        content: trimmed,
        timestamp: Date.now(),
      },
      {
        id: `note-reply-${Date.now() + 1}`,
        type: 'system',
        content: language === 'ar'
          ? 'تم حفظ الملاحظة محليًا داخل جلسة البحث الحالية.'
          : 'Note saved locally to the current research session.',
        timestamp: Date.now() + 1,
      },
    ]);
  }, [language]);

  const primaryControl = useMemo(() => {
    if (simulation.status === 'running') {
      return {
        key: 'pause',
        label: language === 'ar' ? 'إيقاف مؤقت' : 'Pause',
        description: language === 'ar' ? 'أوقف المحاكاة مؤقتًا مع الحفاظ على الحالة الحالية.' : 'Pause the simulation and keep the current state.',
        tone: 'warning' as const,
        icon: 'retry' as const,
        onClick: handlePause,
      };
    }
    if (simulation.status === 'paused' && simulation.simulationId) {
      return {
        key: 'resume',
        label: language === 'ar' ? 'استئناف' : 'Resume',
        description: language === 'ar' ? 'تابع الجلسة من آخر مرحلة محفوظة.' : 'Continue from the latest saved phase.',
        tone: 'primary' as const,
        icon: 'play' as const,
        onClick: handleResume,
        secondary: {
          label: language === 'ar' ? 'إعادة ضبط' : 'Reset',
          onClick: handleReset,
        },
      };
    }
    return {
      key: 'start',
      label: simulation.status === 'completed'
        ? (language === 'ar' ? 'تشغيل جديد' : 'Run again')
        : (language === 'ar' ? 'تشغيل المحاكاة' : 'Run simulation'),
      description: language === 'ar'
        ? 'ابدأ تنفيذ التجربة على المجتمع الوكيل.'
        : 'Start the experiment on the agent society.',
      tone: 'primary' as const,
      icon: 'play' as const,
      disabled: missingFields.length > 0 || simulation.status === 'configuring',
      busy: simulation.status === 'configuring',
      onClick: handleStart,
      secondary: simulation.simulationId
        ? {
            label: language === 'ar' ? 'إعادة ضبط' : 'Reset',
            onClick: handleReset,
          }
        : undefined,
    };
  }, [handlePause, handleReset, handleResume, handleStart, language, missingFields.length, simulation.simulationId, simulation.status]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        simulationStatus={simulation.status}
        connectionState={connectionState}
        connectionScope="realtime"
        language={language}
        settings={{ language, theme, autoFocusInput: true }}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings((current) => !current)}
        onSettingsChange={(updates) => {
          if (updates.language) setLanguage(updates.language);
          if (updates.theme === 'dark' || updates.theme === 'light') setTheme(updates.theme);
        }}
      />

      <TopBar
        language={language}
        theme={theme}
        activePanel={activePanel}
        reasoningCount={simulation.reasoningFeed.length}
        screenTitle={simulationUiState.screenTitle}
        stageLabel={simulationUiState.stageLabel}
        currentStatusLabel={simulationUiState.currentStatusLabel}
        currentStatusTone={simulationUiState.currentStatusTone}
        currentStepLoading={simulationUiState.currentStepLoading}
        steps={simulationUiState.steps}
        onPanelChange={setActivePanel}
        configDisabled={isConfigLocked}
        configDisabledReason={language === 'ar' ? 'أوقف الجلسة أولًا قبل تعديل الإعدادات.' : 'Pause or reset the run before editing the configuration.'}
        reasoningDisabled={simulation.reasoningFeed.length === 0}
        reasoningDisabledReason={language === 'ar' ? 'سيظهر هذا العرض بعد بدء النقاش بين الوكلاء.' : 'This view becomes useful after agent reasoning starts.'}
      />

      <div className="px-4 pb-4 pt-3">
        <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-172px)] gap-4">
          <ResizablePanel defaultSize={30} minSize={24}>
            <div className="h-full rounded-[32px] border border-border/60 bg-card/35">
              {activePanel === 'config' ? (
                <ConfigPanel
                  value={userInput}
                  onChange={handleInputChange}
                  onSubmit={handleStart}
                  missingFields={missingFields}
                  language={language}
                  isSearching={simulation.status === 'configuring'}
                  isLocked={isConfigLocked}
                  lockReason={language === 'ar' ? 'المحاكاة تعمل الآن. أعد الضبط أو انتظر حتى تنتهي.' : 'The simulation is active. Reset it or wait until it finishes.'}
                />
              ) : (
                <ChatPanel
                  messages={chatMessages}
                  reasoningFeed={simulation.reasoningFeed}
                  onSendMessage={handleSendNote}
                  simulationStatus={simulation.status}
                  simulationError={simulation.error}
                  reasoningActive={simulation.reasoningFeed.length > 0}
                  isSummarizing={simulation.status === 'completed' && !simulation.summary && !resultSummary}
                  viewMode={activePanel === 'reasoning' ? 'reasoning' : 'chat'}
                  showSearchLivePanel={false}
                  primaryControl={primaryControl}
                  onRequestReasoningView={() => setActivePanel('reasoning')}
                  settings={{ language, autoFocusInput: true }}
                />
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={46} minSize={32}>
            <SimulationPanel
              agents={agents}
              activePulses={simulation.activePulses}
              language={language}
              reasoningActive={simulation.reasoningFeed.length > 0}
              debateReady={simulation.reasoningFeed.length > 0}
              reasoningFeed={simulation.reasoningFeed}
              graphTitle={simulationUiState.graphTitle}
              graphDescription={simulationUiState.graphDescription}
              graphLegend={simulationUiState.graphLegend}
              emptyTitle={simulationUiState.graphEmptyTitle}
              emptyDescription={simulationUiState.graphEmptyDescription}
              onOpenReasoning={() => setActivePanel('reasoning')}
              currentIteration={simulation.metrics.currentIteration}
              totalIterations={simulation.metrics.totalIterations}
              currentPhaseKey={simulation.currentPhaseKey}
              phaseProgressPct={simulation.phaseProgressPct}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={24} minSize={20}>
            <MetricsPanel
              metrics={simulation.metrics}
              language={language}
              headline={simulationUiState.metricsHeadline}
              description={simulationUiState.metricsDescription}
              emptyLabel={simulationUiState.metricsEmptyLabel}
              onSelectStance={setSelectedStance}
              selectedStance={selectedStance}
              filteredAgents={filteredAgents}
              filteredAgentsTotal={selectedStance ? agents.filter((agent) => agent.status === selectedStance).length : 0}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
