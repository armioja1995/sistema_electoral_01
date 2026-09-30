import { cn } from "@/utils/cn";

export function ProgressBar({ value, max, className, color = "bg-brand", label }: {
  value: number; max: number; className?: string; color?: string; label?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className={cn("h-2.5 w-full overflow-hidden rounded-full bg-paper-sunken", className)}
      role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}
