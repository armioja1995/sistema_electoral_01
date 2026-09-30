import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cleanText } from "@/utils/sanitize";

export const dynamic = "force-dynamic";

const ROLES = ["administrador", "registrador", "consulta"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Verifica que quien llama sea un administrador activo (según la BD, no según el cliente). */
async function requireAdmin() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: fail("Sesión no válida. Inicie sesión nuevamente.", 401) };
  const { data: profile } = await supabase.from("profiles").select("role, active").eq("id", user.id).maybeSingle();
  if (!profile?.active || profile.role !== "administrador")
    return { error: fail("Solo un administrador puede gestionar usuarios.", 403) };
  const admin = getSupabaseAdmin();
  if (!admin)
    return {
      error: fail(
        "La creación de usuarios desde la app requiere configurar SUPABASE_SERVICE_ROLE_KEY en el servidor (variable sin prefijo NEXT_PUBLIC_). " +
        "Alternativa: cree el usuario en Supabase → Authentication → Users y luego asígnele el rol aquí.",
        501,
      ),
    };
  return { user, admin };
}

function checkPassword(p: unknown): string | null {
  if (typeof p !== "string" || p.length < 8 || p.length > 72) return "La contraseña debe tener entre 8 y 72 caracteres.";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "La contraseña debe incluir letras y números.";
  return null;
}

function authError(msg: string) {
  if (/already|registered|exists/i.test(msg)) return "Ya existe un usuario con ese correo electrónico.";
  if (/password/i.test(msg)) return "La contraseña no cumple la política de seguridad de Supabase.";
  return "No se pudo completar la operación en el servicio de autenticación.";
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const body = await req.json().catch(() => null);
  if (!body) return fail("Solicitud inválida.");

  const email = cleanText(body.email, 200).toLowerCase();
  const first_name = cleanText(body.first_name, 80);
  const last_name = cleanText(body.last_name, 80);
  const role = body.role;
  if (!EMAIL_RE.test(email)) return fail("Ingrese un correo electrónico válido.");
  if (!first_name || !last_name) return fail("Nombre y apellido son obligatorios.");
  if (!ROLES.includes(role)) return fail("Rol no válido.");
  const pwErr = checkPassword(body.password);
  if (pwErr) return fail(pwErr);

  const { data, error } = await ctx.admin.auth.admin.createUser({
    email,
    password: body.password,
    email_confirm: true,
    app_metadata: { role },            // el trigger handle_new_user solo confía en app_metadata
    user_metadata: { first_name, last_name },
  });
  if (error || !data.user) return fail(authError(error?.message ?? ""));

  await ctx.admin.from("audit_logs").insert({
    user_id: ctx.user.id, action: "crear_usuario", entity: "profiles", entity_id: data.user.id,
    details: { email, role },
  });
  return NextResponse.json({ id: data.user.id });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string" || !UUID_RE.test(body.id)) return fail("Usuario no válido.");
  const pwErr = checkPassword(body.password);
  if (pwErr) return fail(pwErr);

  const { error } = await ctx.admin.auth.admin.updateUserById(body.id, { password: body.password });
  if (error) return fail(authError(error.message));

  await ctx.admin.from("audit_logs").insert({
    user_id: ctx.user.id, action: "restablecer_contrasena", entity: "profiles", entity_id: body.id, details: {},
  });
  return NextResponse.json({ ok: true });
}
