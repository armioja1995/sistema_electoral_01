import { cn } from "@/utils/cn";
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-paper-sunken", className)} aria-hidden />;
}
