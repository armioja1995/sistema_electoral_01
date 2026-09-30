"use client";
import { useAsync } from "./useAsync";
import { useRealtimeRefresh } from "./useRealtimeStats";
import { getStats } from "@/services/results";

/** Estadísticas agregadas de la elección + actualización en tiempo real. */
export function useLiveStats(electionId: string | undefined) {
  const q = useAsync(() => (electionId ? getStats(electionId) : Promise.resolve(null)), [electionId]);
  const live = useRealtimeRefresh(electionId, q.reload);
  return { ...q, live };
}
