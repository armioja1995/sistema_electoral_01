"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/utils/cn";

// Contador global de peticiones en curso. Se intercepta window.fetch una sola vez:
// cubre Supabase (REST/RPC/Auth) y las cargas de página del App Router.
let inFlight = 0;
const listeners = new Set<(busy: boolean) => void>();
let patched = false;

function emit() {
  const busy = inFlight > 0;
  listeners.forEach((l) => l(busy));
}

function patchFetch() {
  if (patched || typeof window === "undefined") return;
  patched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (...args) => {
    inFlight++;
    emit();
    try {
      return await original(...args);
    } finally {
      inFlight--;
      emit();
    }
  };
}

const SHOW_DELAY = 150; // evita parpadeos en peticiones instantáneas
const MIN_VISIBLE = 500; // el estado "cargando" se ve lo suficiente para notarlo

export function ActivityButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    patchFetch();
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let shownAt = 0;

    const onChange = (active: boolean) => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      if (active) {
        showTimer = setTimeout(() => { shownAt = Date.now(); setBusy(true); }, SHOW_DELAY);
      } else {
        const wait = Math.max(0, MIN_VISIBLE - (Date.now() - shownAt));
        hideTimer = setTimeout(() => setBusy(false), wait);
      }
    };
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const loading = busy || pending;

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={loading}
      aria-live="polite"
      aria-label={loading ? "Cargando datos" : "Actualizar datos"}
      title={loading ? "Cargando datos…" : "Actualizar datos"}
      className={cn(
        "group fixed bottom-5 right-5 z-50 flex h-12 items-center gap-2 rounded-full px-3.5 text-sm font-medium shadow-lg",
        "transition-all duration-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-ok/40",
        loading
          ? "cursor-progress bg-ok-soft text-ok ring-2 ring-ok/60"
          : "bg-ok text-white hover:-translate-y-0.5 hover:bg-green-600 hover:shadow-xl active:translate-y-0",
      )}
    >
      {loading && <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-ok/25" aria-hidden />}
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      ) : (
        <RefreshCw className="h-5 w-5 transition-transform duration-500 group-hover:rotate-180" aria-hidden />
      )}
      <span className={cn(
        "overflow-hidden whitespace-nowrap transition-all duration-300",
        loading ? "max-w-[120px]" : "max-w-0 group-hover:max-w-[120px] group-focus-visible:max-w-[120px]",
      )}>
        {loading ? "Cargando…" : "Actualizar"}
      </span>
    </button>
  );
}
