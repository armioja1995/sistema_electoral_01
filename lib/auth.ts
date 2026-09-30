import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rolesFor, type NavKey } from "@/lib/permissions";
import type { Election, Profile } from "@/types";

/** Usuario + perfil de la sesión actual (cacheado por request). */
export const getSession = cache(async () => {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, role, active, created_at")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  return { user, profile };
});

export const getActiveElection = cache(async (): Promise<Election | null> => {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.from("elections").select("*").eq("is_active", true).maybeSingle<Election>();
  return data ?? null;
});

/** Protege una página por rol (defensa en profundidad: RLS también lo impone). */
export async function requireAccess(key: NavKey) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { profile } = session;
  if (!profile || !profile.active || !rolesFor(key).includes(profile.role)) redirect("/dashboard?denied=1");
  return profile;
}
