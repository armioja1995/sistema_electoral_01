import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export function StatCard({ label, value, sub, icon, tone = "default", children }: {
  label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode;
  tone?: "default" | "warn" | "ok"; children?: ReactNode;
}) {
  return (
    <div className={cn(
      "rounded-lg border bg-paper-raised p-4",
      tone === "warn" ? "border-orange-200" : tone === "ok" ? "border-green-200" : "border-line",
    )}>
      <div className="flex items-center justify-between gap-2 text-sm text-ink-muted">
        <span>{label}</span>
        {icon && <span className="text-ink-muted/70">{icon}</span>}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-muted tabular-nums">{sub}</div>}
      {children}
    </div>
  );
}
