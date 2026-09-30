/** Normaliza texto de formularios: recorta, colapsa espacios y quita caracteres de control. */
export function cleanText(v: unknown, max = 300): string {
  return String(v ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Texto para búsquedas en filtros PostgREST: elimina caracteres con significado sintáctico. */
export function cleanSearch(v: string): string {
  return v.replace(/[%_,.()*\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

export function cleanCode(v: unknown): string {
  return String(v ?? "").trim().toUpperCase().replace(/\s+/g, "-").slice(0, 20);
}

/** Convierte a entero no negativo; devuelve null si no es válido. */
export function toNonNegInt(v: unknown): number | null {
  const s = String(v ?? "").trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}
