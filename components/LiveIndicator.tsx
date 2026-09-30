"use client";
import type { LiveStatus } from "@/hooks/useRealtimeStats";
import { cn } from "@/utils/cn";

export function LiveIndicator({ status, updatedAt }: { status: LiveStatus; updatedAt?: string | null }) {
  const map = {
    en_vivo: { dot: "bg-ok", text: "Actualización automática activa" },
    conectando: { dot: "bg-amber-400", text: "Conectando…" },
    sin_conexion: { dot: "bg-danger", text: "Sin conexión en tiempo real" },
  }[status];
  return (
    <span className="inline-flex items-center gap-2 text-xs text-ink-muted" aria-live="polite">
      <span className="relative flex h-2 w-2">
        {status === "en_vivo" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok/60" />}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", map.dot)} />
      </span>
      {map.text}
      {updatedAt && <span className="tabular-nums">· {new Date(updatedAt).toLocaleTimeString("es-PE")}</span>}
    </span>
  );
}
