"use client";
import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

export type LiveStatus = "conectando" | "en_vivo" | "sin_conexion";

/**
 * Suscribe a cambios de mesas/actas de la elección vía Supabase Realtime.
 * No transporta datos: ante cada aviso se vuelve a pedir el agregado (debounce),
 * así el navegador nunca descarga la base de datos completa.
 */
export function useRealtimeRefresh(electionId: string | undefined, onChange: () => void, debounceMs = 800) {
  const [status, setStatus] = useState<LiveStatus>("conectando");
  const [lastEvent, setLastEvent] = useState<Date | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;


  useEffect(() => {
    if (!electionId) return;
    const supabase = getSupabase();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { setLastEvent(new Date()); cb.current(); }, debounceMs);
    };
    const channel = supabase
      .channel(`election-${electionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "polling_tables", filter: `election_id=eq.${electionId}` }, fire)
      .on("postgres_changes", { event: "*", schema: "public", table: "table_results", filter: `election_id=eq.${electionId}` }, fire)
      .subscribe((s) => setStatus(s === "SUBSCRIBED" ? "en_vivo" : s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED" ? "sin_conexion" : "conectando"));

    // Respaldo: si la pestaña vuelve a estar visible, refrescar
    const onVis = () => document.visibilityState === "visible" && cb.current();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
      supabase.removeChannel(channel);
    };
  }, [electionId, debounceMs]);

  return { status, lastEvent };
}
