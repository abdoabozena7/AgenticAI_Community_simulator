import type { ComponentType, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const systemSectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: index * 0.06,
      duration: 0.38,
      ease: "easeOut",
    },
  }),
};

export const systemInputClass = "architect-input";

export function SystemPanel({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("architect-panel p-5 sm:p-6", className)}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="architect-kicker">{title}</p>
          <p className="mt-2 max-w-xl text-sm leading-7 text-[color:var(--architect-muted)]">
            {description}
          </p>
        </div>
        <div className="architect-icon-wrap">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {children}
    </section>
  );
}

export function SystemStat({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "accent" | "success";
}) {
  return (
    <div
      className={cn(
        "architect-stat-block",
        tone === "accent" && "architect-stat-block-accent",
        tone === "success" && "architect-stat-block-success",
      )}
    >
      <p className="architect-kicker">{label}</p>
      <div className="mt-3 font-['Be_Vietnam_Pro'] text-3xl font-semibold tracking-[-0.04em] text-[color:var(--architect-ink)]">
        {value}
      </div>
      <p className="mt-2 text-sm leading-6 text-[color:var(--architect-muted)]">{detail}</p>
    </div>
  );
}

export function SystemChip({
  children,
  tone = "soft",
  className,
}: {
  children: ReactNode;
  tone?: "primary" | "soft" | "jewel";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "architect-chip",
        tone === "primary" && "architect-chip-primary",
        tone === "soft" && "architect-chip-soft",
        tone === "jewel" && "architect-chip-jewel",
        className,
      )}
    >
      {children}
    </span>
  );
}
