import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Brain,
  CheckCircle,
  Clock,
  Lightbulb,
  MessageCircle,
  RefreshCw,
  Rocket,
  Send,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { apiService } from '@/services/api';

export interface SimulationData {
  id: string;
  name: string;
  nameAr?: string;
  category?: string;
  status: 'running' | 'completed' | 'draft' | 'failed';
  acceptanceRate?: number;
  totalAgents?: number;
  avgResponseTime?: string;
  confidenceScore?: number;
  createdAt?: string;
  location?: string;
  locationAr?: string;
  summary?: string;
  summaryAr?: string;
  pros?: { text: string; textAr?: string }[];
  cons?: { text: string; textAr?: string }[];
  suggestions?: { text: string; textAr?: string; impact?: number }[];
}

interface ChatMsg {
  id: string;
  role: 'user' | 'ai';
  content: string;
}

interface SimulationDetailsProps {
  simulation: SimulationData;
  onBack: () => void;
  onRerun: (simId: string) => void;
}

function MetricTile({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) {
  return (
    <div className="rounded-2xl bg-background/55 p-4">
      <Icon className={cn('h-5 w-5', tone)} />
      <div className="mt-3 text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">{label}</div>
    </div>
  );
}

export default function SimulationDetails({ simulation, onBack, onRerun }: SimulationDetailsProps) {
  const { isRTL } = useLanguage();
  const { theme } = useTheme();
  const rawAcceptanceRate = typeof simulation.acceptanceRate === 'number' ? simulation.acceptanceRate : 0;
  const acceptanceRate = rawAcceptanceRate <= 1 ? rawAcceptanceRate * 100 : rawAcceptanceRate;
  const isAbove60 = acceptanceRate >= 60;
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const shellClass = theme === 'dark' ? 'architect-shell architect-shell-dark' : 'architect-shell architect-shell-light';

  const handleSendMessage = async (preset?: string) => {
    const text = (preset ?? chatInput).trim();
    if (!text || chatLoading) return;
    const userMsg: ChatMsg = { id: Date.now().toString(), role: 'user', content: text };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const summary = (isRTL ? (simulation.summaryAr || simulation.summary) : (simulation.summary || simulation.summaryAr)) || '';
      const system = isRTL
        ? 'أنت مساعد يحلل نتائج محاكاة فكرة. أجب بإيجاز وبنقاط عملية.'
        : 'You are an assistant analyzing simulation results. Reply concisely with actionable advice.';
      const prompt = `Simulation summary:\n${summary}\n\nUser question: ${text}`;
      const reply = await apiService.generateMessage(prompt, system);
      const aiMsg: ChatMsg = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: reply || (isRTL ? 'لا توجد إجابة متاحة حالياً.' : 'No response available right now.'),
      };
      setChatMessages((prev) => [...prev, aiMsg]);
    } catch {
      const aiMsg: ChatMsg = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: isRTL ? 'تعذر الاتصال بالـ LLM الآن.' : 'Failed to reach the LLM right now.',
      };
      setChatMessages((prev) => [...prev, aiMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  const pros = simulation.pros ?? [];
  const cons = simulation.cons ?? [];
  const suggestions = simulation.suggestions ?? [];
  const stats = [
    {
      label: isRTL ? 'نسبة القبول' : 'Acceptance',
      value: `${Math.round(acceptanceRate)}%`,
      icon: Target,
      tone: isAbove60 ? 'text-emerald-400' : 'text-amber-400',
    },
    simulation.totalAgents !== undefined
      ? {
          label: isRTL ? 'إجمالي الوكلاء' : 'Total Agents',
          value: simulation.totalAgents.toString(),
          icon: Users,
          tone: 'text-foreground/80',
        }
      : null,
    simulation.avgResponseTime
      ? {
          label: isRTL ? 'متوسط الاستجابة' : 'Avg Response',
          value: simulation.avgResponseTime,
          icon: Clock,
          tone: 'text-foreground/80',
        }
      : null,
    simulation.confidenceScore !== undefined
      ? {
          label: isRTL ? 'درجة الثقة' : 'Confidence',
          value: `${simulation.confidenceScore}%`,
          icon: TrendingUp,
          tone: 'text-foreground/80',
        }
      : null,
  ].filter(Boolean) as { label: string; value: string; icon: any; tone: string }[];

  const summaryText = (isRTL ? (simulation.summaryAr || simulation.summary) : (simulation.summary || simulation.summaryAr)) || (isRTL ? 'لا يوجد ملخص بعد.' : 'No summary yet.');

  return (
    <div className={cn(shellClass, 'space-y-8')}>
      <header className="architect-hero">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="icon" onClick={onBack} className="shrink-0 rounded-full border-border/60 bg-background/50">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
              {isRTL ? 'تفاصيل المحاكاة' : 'Simulation details'}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {isRTL ? (simulation.nameAr || simulation.name) : simulation.name}
            </h1>
            <p className="text-sm leading-7 text-muted-foreground">
              {[isRTL ? (simulation.locationAr || simulation.location) : simulation.location, simulation.category].filter(Boolean).join(' • ')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{simulation.status}</Badge>
          <Badge variant="outline">{theme === 'dark' ? 'Charcoal dark' : 'Light mode'}</Badge>
        </div>
      </header>

      <section className="architect-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {isRTL ? 'الملخص' : 'Summary'}
            </div>
            <h2 className="mt-2 text-xl font-semibold text-foreground">
              {isRTL ? 'قراءة سريعة' : 'Quick read'}
            </h2>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-foreground">
            <Brain className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-4 max-w-4xl text-sm leading-8 text-muted-foreground">{summaryText}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <MetricTile key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} tone={stat.tone} />
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <section className="architect-panel p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  {isRTL ? 'القبول' : 'Acceptance'}
                </div>
                <h2 className="mt-2 text-xl font-semibold text-foreground">
                  {isRTL ? 'نسبة القبول' : 'Acceptance rate'}
                </h2>
              </div>
              <Badge variant="outline">{Math.round(acceptanceRate)}%</Badge>
            </div>
            <div className="mt-5 space-y-3">
              <Progress value={acceptanceRate} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>{isRTL ? '60%' : '60%'}</span>
                <span>100%</span>
              </div>
            </div>
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="architect-panel border-0">
              <CardContent className="p-6">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <ThumbsUp className="h-5 w-5 text-emerald-400" />
                  {isRTL ? 'نقاط القوة' : 'Strengths'}
                </h3>
                <ul className="space-y-3">
                  {pros.length ? pros.map((p, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm leading-7 text-muted-foreground">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{isRTL ? (p.textAr || p.text) : p.text}</span>
                    </li>
                  )) : (
                    <li className="text-sm text-muted-foreground">
                      {isRTL ? 'لا توجد نقاط قوة مستخرجة بعد.' : 'No strengths extracted yet.'}
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>

            <Card className="architect-panel border-0">
              <CardContent className="p-6">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <ThumbsDown className="h-5 w-5 text-rose-400" />
                  {isRTL ? 'نقاط الضعف' : 'Weaknesses'}
                </h3>
                <ul className="space-y-3">
                  {cons.length ? cons.map((c, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm leading-7 text-muted-foreground">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                      <span>{isRTL ? (c.textAr || c.text) : c.text}</span>
                    </li>
                  )) : (
                    <li className="text-sm text-muted-foreground">
                      {isRTL ? 'لا توجد نقاط ضعف مستخرجة بعد.' : 'No weaknesses extracted yet.'}
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>

          <section className={cn('architect-panel p-6', isAbove60 ? 'ring-1 ring-emerald-500/20' : 'ring-1 ring-amber-500/20')}>
            <div className="flex items-start gap-4">
              <div className={cn('flex h-12 w-12 items-center justify-center rounded-full', isAbove60 ? 'bg-emerald-500/10' : 'bg-amber-500/10')}>
                {isAbove60 ? <Rocket className="h-6 w-6 text-emerald-400" /> : <Lightbulb className="h-6 w-6 text-amber-400" />}
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold text-foreground">
                  {isAbove60
                    ? (isRTL ? 'خلينا نحول فكرتك لحقيقة' : 'Let’s bring your idea to real life')
                    : (isRTL ? 'خلينا نخلي فكرتك مقبولة' : 'Let’s make your idea acceptable')}
                </h2>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                  {isAbove60
                    ? (isRTL ? 'نسبة القبول عالية. اسأل عن خطة البداية أو تفاصيل التشغيل.' : 'Acceptance is high. Ask for a launch plan or operational details.')
                    : (isRTL ? 'بتعديلات بسيطة ممكن نرفع نسبة القبول.' : 'Small edits can raise acceptance quickly.')}
                </p>
                {!showChat ? (
                  <Button onClick={() => setShowChat(true)} className="architect-button-primary">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    {isAbove60
                      ? (isRTL ? 'تحدث مع المساعد' : 'Chat with assistant')
                      : (isRTL ? 'اسأل عن التحسينات' : 'Ask for improvements')}
                  </Button>
                ) : null}
              </div>
            </div>
          </section>

          {suggestions.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {suggestions.slice(0, isAbove60 ? 4 : suggestions.length).map((sug, i) => (
                <div key={i} className="architect-panel p-5">
                  <div className="flex items-start gap-3">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', isAbove60 ? 'bg-emerald-500/10' : 'bg-amber-500/10')}>
                      {isAbove60 ? <Sparkles className="h-4 w-4 text-emerald-400" /> : <Lightbulb className="h-4 w-4 text-amber-400" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm leading-7 text-foreground">{isRTL ? (sug.textAr || sug.text) : sug.text}</p>
                      {typeof sug.impact === 'number' ? (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {isAbove60
                            ? `+${Math.round(sug.impact)}% ${isRTL ? 'تأثير' : 'impact'}`
                            : `+${Math.round(sug.impact)}% ${isRTL ? 'تحسين متوقع' : 'expected improvement'}`}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          {showChat ? (
            <section className="architect-panel overflow-hidden">
              <div className="flex items-center gap-3 px-6 pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-foreground">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                    {isRTL ? 'المساعد الذكي' : 'AI assistant'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? 'اسأل عن النتائج أو خطة التحسين.' : 'Ask about the results or the next move.'}
                  </p>
                </div>
              </div>

              <div className="max-h-[420px] space-y-4 overflow-y-auto px-6 py-5">
                {chatMessages.length === 0 ? (
                  <div className="rounded-2xl bg-background/45 p-5 text-center">
                    <Sparkles className="mx-auto h-8 w-8 text-foreground/70" />
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      {isAbove60
                        ? (isRTL ? 'اسأل عن خطة البداية أو البحث العميق.' : 'Ask about the launch plan or a deeper review.')
                        : (isRTL ? 'اسأل عن كيف ترفع القبول.' : 'Ask how to raise acceptance.')}
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {(isAbove60
                        ? [
                            { text: isRTL ? 'كيف أبدأ؟' : 'How do I start?' },
                            { text: isRTL ? 'خطة الإطلاق' : 'Launch plan' },
                          ]
                        : [
                            { text: isRTL ? 'كيف أحسنها؟' : 'How do I improve it?' },
                            { text: isRTL ? 'لماذا منخفضة؟' : 'Why is it low?' },
                          ]
                      ).map((item) => (
                        <Button key={item.text} variant="outline" size="sm" className="rounded-full" onClick={() => handleSendMessage(item.text)}>
                          {item.text}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {chatMessages.map((msg) => (
                  <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {msg.role === 'ai' ? (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-foreground">
                        <Bot className="h-4 w-4" />
                      </div>
                    ) : null}
                    <div className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-7 whitespace-pre-wrap',
                      msg.role === 'user' ? 'bg-foreground text-background' : 'bg-background/45 text-foreground'
                    )}>
                      {msg.content}
                    </div>
                    {msg.role === 'user' ? (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-foreground">
                        <User className="h-4 w-4" />
                      </div>
                    ) : null}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="flex gap-2 border-t border-border/50 p-4">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={isRTL ? 'اكتب رسالتك...' : 'Type your message...'}
                  className="architect-input flex-1"
                />
                <Button onClick={handleSendMessage} disabled={!chatInput.trim() || chatLoading} size="icon" className="architect-button-primary">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </section>
          ) : (
            <section className="architect-panel p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-foreground">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                    {isRTL ? 'المساعد الذكي' : 'AI assistant'}
                  </h3>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                {isRTL ? 'افتح المحادثة لطرح أسئلة على نتيجة المحاكاة.' : 'Open the assistant to ask about the simulation result.'}
              </p>
              <Button onClick={() => setShowChat(true)} className="mt-4 architect-button-primary">
                <MessageCircle className="mr-2 h-4 w-4" />
                {isRTL ? 'فتح المحادثة' : 'Open chat'}
              </Button>
            </section>
          )}

          <section className="architect-panel p-6 text-center">
            <RefreshCw className="mx-auto h-8 w-8 text-foreground/70" />
            <h3 className="mt-3 text-lg font-semibold text-foreground">
              {isRTL ? 'تشغيل محاكاة جديدة' : 'Run a new simulation'}
            </h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {isRTL ? 'أعد التشغيل بعد التعديلات لمقارنة النتائج.' : 'Re-run after edits to compare the results.'}
            </p>
            <Button onClick={() => onRerun(simulation.id)} className="mt-4 architect-button-primary">
              <RefreshCw className="mr-2 h-4 w-4" />
              {isRTL ? 'إعادة المحاكاة' : 'Re-run simulation'}
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}
