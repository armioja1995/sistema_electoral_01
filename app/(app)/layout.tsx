import { redirect } from "next/navigation";
import { getActiveElection, getSession } from "@/lib/auth";
import { AppProvider } from "@/hooks/useApp";
import { AppShell } from "@/components/layout/AppShell";
import { SignOutButton } from "@/components/layout/SignOutButton";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { profile } = session;

  if (!profile || !profile.active) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="max-w-md rounded-lg border border-line bg-paper-raised p-6 text-center">
          <h1 className="text-lg font-semibold text-ink">Cuenta sin acceso</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {profile ? "Su usuario está desactivado." : "Su usuario no tiene un perfil asignado."} Solicite acceso a un administrador.
          </p>
          <div className="mt-4"><SignOutButton /></div>
        </div>
      </main>
    );
  }

  const election = await getActiveElection();
  return (
    <AppProvider value={{ profile, election }}>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
