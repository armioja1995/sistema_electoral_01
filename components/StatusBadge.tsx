import { cn } from "@/utils/cn";
import type { ElectionStatus, TableStatus } from "@/types";

export const TABLE_STATUS: Record<TableStatus, { label: string; cls: string; color: string }> = {
  pendiente:   { label: "Pendiente",   cls: "bg-slate-100 text-slate-700 ring-slate-300",   color: "#94A3B8" },
  en_registro: { label: "En registro", cls: "bg-blue-50 text-blue-700 ring-blue-200",       color: "#2563EB" },
  registrada:  { label: "Registrada",  cls: "bg-green-50 text-green-700 ring-green-200",    color: "#16A34A" },
  observada:   { label: "Observada",   cls: "bg-orange-50 text-orange-700 ring-orange-200", color: "#EA580C" },
  validada:    { label: "Validada",    cls: "bg-green-800 text-white ring-green-900",       color: "#166534" },
};

export const ELECTION_STATUS: Record<ElectionStatus, { label: string; cls: string }> = {
  configuracion: { label: "Configuración", cls: "bg-slate-100 text-slate-700 ring-slate-300" },
  en_proceso:    { label: "En proceso",    cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  finalizado:    { label: "Finalizado",    cls: "bg-green-800 text-white ring-green-900" },
};

const pill = "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";

export function StatusBadge({ status, className }: { status: TableStatus; className?: string }) {
  const s = TABLE_STATUS[status];
  return <span className={cn(pill, s.cls, className)}>{s.label}</span>;
}

export function ElectionStatusBadge({ status }: { status: ElectionStatus }) {
  const s = ELECTION_STATUS[status];
  return <span className={cn(pill, s.cls)}>{s.label}</span>;
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "ok" | "off" | "demo" }) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700 ring-slate-300",
    ok: "bg-green-50 text-green-700 ring-green-200",
    off: "bg-slate-50 text-slate-500 ring-slate-200",
    demo: "bg-amber-100 text-amber-900 ring-amber-300",
  };
  return <span className={cn(pill, tones[tone])}>{children}</span>;
}
