import { db, unwrap } from "./base";
import type { Profile, UserRole } from "@/types";
import { cleanText } from "@/utils/sanitize";

export async function listProfiles(): Promise<Profile[]> {
  return unwrap(await db().from("profiles").select("*").order("created_at", { ascending: true }));
}

export async function listRegistrars() {
  return unwrap(
    await db().from("profiles").select("id, first_name, last_name, email")
      .in("role", ["registrador", "administrador"]).eq("active", true).order("first_name"),
  ) as Pick<Profile, "id" | "first_name" | "last_name" | "email">[];
}

export async function updateProfile(id: string, v: { first_name: string; last_name: string; role: UserRole; active: boolean }) {
  unwrap(await db().from("profiles").update({
    first_name: cleanText(v.first_name, 80),
    last_name: cleanText(v.last_name, 80),
    role: v.role,
    active: v.active,
  }).eq("id", id));
}

async function callAdminApi(method: "POST" | "PATCH", body: unknown) {
  const res = await fetch("/api/admin/users", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "No se pudo completar la operación.");
  return json;
}

export const createUser = (v: { email: string; password: string; first_name: string; last_name: string; role: UserRole }) =>
  callAdminApi("POST", v);
export const resetPassword = (id: string, password: string) => callAdminApi("PATCH", { id, password });
