import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ChatProgressStep = {
  key: string;
  label: string;
  state: 'completed' | 'current' | 'upcoming';
};

export function ChatShell({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('chat-shell', className)}>
      {children}
    </div>
  );
}

export function ChatTopProgress({
  steps,
  headline,
  detail,
  className,
}: {
  steps: ChatProgressStep[];
  headline: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div className={cn('chat-top-progress', className)}>
      <div className="chat-top-progress-track" role="list" aria-label="Conversation progress">
        {steps.map((step) => (
          <div
            key={step.key}
            role="listitem"
            className={cn(
              'chat-top-progress-step',
              step.state === 'completed' && 'is-completed',
              step.state === 'current' && 'is-current',
            )}
          >
            <span className="chat-top-progress-dot" aria-hidden="true" />
            <span className="chat-top-progress-label">{step.label}</span>
          </div>
        ))}
      </div>
      <div className="chat-top-progress-meta" role="status" aria-live="polite">
        <div className="chat-top-progress-headline">{headline}</div>
        {detail ? <div className="chat-top-progress-detail">{detail}</div> : null}
      </div>
    </div>
  );
}

export function ChatBubble({
  side = 'assistant',
  tone = 'default',
  kicker,
  meta,
  className,
  bubbleClassName,
  children,
}: {
  side?: 'assistant' | 'user';
  tone?: 'default' | 'interactive' | 'research' | 'success' | 'warning' | 'muted';
  kicker?: ReactNode;
  meta?: ReactNode;
  className?: string;
  bubbleClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('message message-compact', side === 'user' ? 'user' : 'bot', className)}>
      <div
        className={cn(
          'bubble bubble-compact chat-bubble-shell',
          tone === 'interactive' && 'chat-bubble-interactive',
          tone === 'research' && 'chat-bubble-research',
          tone === 'success' && 'chat-bubble-success',
          tone === 'warning' && 'chat-bubble-warning',
          tone === 'muted' && 'chat-bubble-muted',
          bubbleClassName,
        )}
      >
        {kicker ? <div className="chat-bubble-kicker">{kicker}</div> : null}
        <div className="chat-bubble-body">{children}</div>
        {meta ? <div className="chat-bubble-meta">{meta}</div> : null}
      </div>
    </div>
  );
}

export function ChatActionRow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn('chat-action-row', className)}>{children}</div>;
}

export function ChatOptionChips({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn('chat-option-chips', className)}>{children}</div>;
}

export function ChatOptionChip({
  selected = false,
  disabled = false,
  className,
  children,
  onClick,
}: {
  selected?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn('chat-option-chip', selected && 'is-selected', className)}
    >
      {children}
    </button>
  );
}

export function ChatInlineSection({
  title,
  description,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('chat-inline-section', className)}>
      {title || description ? (
        <div className="chat-inline-section-header">
          {title ? <div className="chat-inline-section-title">{title}</div> : null}
          {description ? <div className="chat-inline-section-description">{description}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function ReasoningDebugDrawer({
  title,
  open,
  onToggle,
  children,
}: {
  title: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="reasoning-debug-drawer">
      <div className="reasoning-debug-header">
        <div className="reasoning-debug-title">{title}</div>
        <button type="button" onClick={onToggle} className="reasoning-debug-toggle">
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open ? <div className="reasoning-debug-body">{children}</div> : null}
    </div>
  );
}
