import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_minmax(420px,520px)]">
      <section className="hidden flex-col justify-between bg-brand-dark p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <Seal />
          <span className="text-sm text-white/80">Sistema de Resultados Electorales</span>
        </div>
        <div className="max-w-md">
          <p className="text-3xl font-semibold leading-tight">Registro de actas y seguimiento del conteo por mesa.</p>
          <p className="mt-4 text-white/70">
            Acceso restringido a personal autorizado. Toda operación queda registrada con usuario, fecha y hora.
          </p>
        </div>
        <p className="text-xs text-white/50">Los resultados mostrados dependen de las actas registradas en el sistema.</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden"><Seal dark /><span className="text-sm text-ink-muted">Sistema de Resultados Electorales</span></div>
          <h1 className="text-2xl font-semibold text-ink">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-ink-muted">Ingrese con el usuario asignado por el administrador.</p>
          <Suspense><LoginForm /></Suspense>
        </div>
      </section>
    </main>
  );
}

function Seal({ dark }: { dark?: boolean }) {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
      <rect x="4" y="12" width="28" height="20" rx="2" fill="none" stroke={dark ? "#1F4E79" : "#fff"} strokeWidth="2" />
      <rect x="11" y="4" width="14" height="12" rx="1" fill={dark ? "#E3ECF5" : "#ffffff33"} stroke={dark ? "#1F4E79" : "#fff"} strokeWidth="2" />
      <path d="M14 10l3 3 5-6" fill="none" stroke={dark ? "#1F4E79" : "#fff"} strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="18" x2="32" y2="18" stroke={dark ? "#1F4E79" : "#fff"} strokeWidth="2" />
    </svg>
  );
}
