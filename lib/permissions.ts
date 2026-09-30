import type { UserRole } from "@/types";

export const ROLE_LABELS: Record<UserRole, string> = {
  administrador: "Administrador",
  registrador: "Registrador",
  consulta: "Consulta",
};

export type NavKey =
  | "dashboard" | "configuracion" | "locales" | "mesas" | "partidos" | "candidatos"
  | "registro" | "estadisticas" | "proyeccion" | "usuarios" | "auditoria";

const ALL: UserRole[] = ["administrador", "registrador", "consulta"];
const ADMIN: UserRole[] = ["administrador"];

export const NAV: { key: NavKey; href: string; label: string; roles: UserRole[] }[] = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", roles: ALL },
  { key: "configuracion", href: "/configuracion", label: "Configuración electoral", roles: ADMIN },
  { key: "locales", href: "/locales", label: "Locales de votación", roles: ADMIN },
  { key: "mesas", href: "/mesas", label: "Mesas", roles: ADMIN },
  { key: "partidos", href: "/partidos", label: "Partidos políticos", roles: ADMIN },
  { key: "candidatos", href: "/candidatos", label: "Candidatos", roles: ADMIN },
  { key: "registro", href: "/registro", label: "Registro de resultados", roles: ["administrador", "registrador"] },
  { key: "estadisticas", href: "/estadisticas", label: "Estadísticas", roles: ALL },
  { key: "proyeccion", href: "/proyeccion", label: "Proyección", roles: ALL },
  { key: "usuarios", href: "/usuarios", label: "Usuarios", roles: ADMIN },
  { key: "auditoria", href: "/auditoria", label: "Auditoría", roles: ADMIN },
];

export function rolesFor(key: NavKey): UserRole[] {
  return NAV.find((n) => n.key === key)!.roles;
}
