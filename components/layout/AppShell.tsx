"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Settings2, School, Grid3x3, Flag, UserSquare2, ClipboardPen, BarChart3,
  TrendingUp, Users, History, LogOut, Menu, X,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { NAV, ROLE_LABELS, type NavKey } from "@/lib/permissions";
import { useApp } from "@/hooks/useApp";
import { cn } from "@/utils/cn";
import { fullName } from "@/utils/format";
import { ElectionStatusBadge } from "@/components/StatusBadge";

const ICONS: Record<NavKey, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard, configuracion: Settings2, locales: School, mesas: Grid3x3, partidos: Flag,
  candidatos: UserSquare2, registro: ClipboardPen, estadisticas: BarChart3, proyeccion: TrendingUp,
  usuarios: Users, auditoria: History,
};

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, election } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => n.roles.includes(profile.role));

  async function signOut() {
    await getSupabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
        <span className="grid h-7 w-7 place-items-center rounded bg-white/15 text-xs font-semibold">SR</span>
        <span className="text-sm font-medium leading-tight">Resultados<br /><span className="text-white/60">Electorales</span></span>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {items.map((n) => {
          const Icon = ICONS[n.key];
          const active = pathname === n.href || pathname.startsWith(n.href + "/");
          return (
            <li key={n.key}>
              <Link href={n.href} onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-white text-brand-dark font-medium" : "text-white/80 hover:bg-white/10 hover:text-white",
                )}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden />{n.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-white/10 p-2">
        <button onClick={signOut} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white">
          <LogOut className="h-4 w-4" aria-hidden />Cerrar sesión
        </button>
        <p className="px-3 pb-1 pt-2 text-[11px] text-white/50">
           © Desarrollado por <span className="font-semibold text-white/70">ARMITEC</span>
        </p>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-brand-dark text-white lg:block">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-64 bg-brand-dark text-white shadow-xl">
            <button onClick={() => setOpen(false)} className="absolute right-2 top-3 rounded p-1.5 text-white/80 hover:bg-white/10" aria-label="Cerrar menú">
              <X className="h-5 w-5" />
            </button>
            {nav}
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-line bg-paper-raised/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <button onClick={() => setOpen(true)} className="-ml-1 rounded p-1.5 text-ink-soft hover:bg-paper-sunken lg:hidden" aria-label="Abrir menú">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            {election ? (
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium text-ink">{election.name}</span>
                <span className="hidden sm:inline"><ElectionStatusBadge status={election.status} /></span>
              </div>
            ) : (
              <span className="text-sm text-ink-muted">Sin elección activa</span>
            )}
          </div>
          <div className="text-right leading-tight">
            <div className="max-w-[160px] truncate text-sm font-medium text-ink">{fullName(profile) || profile.email}</div>
            <div className="text-xs text-ink-muted">{ROLE_LABELS[profile.role]}</div>
          </div>
        </div>
        {election?.is_demo && (
          <div className="border-t border-amber-300 bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900 sm:px-6">
            DATOS DEMO: la elección activa contiene datos de prueba. No corresponden a resultados reales.
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">{children}</main>
    </div>
  );
}
