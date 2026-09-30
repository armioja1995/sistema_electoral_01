/** Traduce errores de Postgres/PostgREST/Supabase a mensajes comprensibles. */
export function friendlyError(err: unknown): string {
  const e = err as { code?: string; message?: string; details?: string } | null;
  const msg = e?.message ?? String(err ?? "Error desconocido");
  switch (e?.code) {
    case "23505": {
      if (/polling_tables_code/.test(msg)) return "Ya existe una mesa con ese código en esta elección.";
      if (/polling_places_code/.test(msg)) return "Ya existe un local con ese código en esta elección.";
      if (/polling_places_name/.test(msg)) return "Ya existe un local con ese nombre en el mismo distrito.";
      if (/parties_acronym/.test(msg)) return "Ya existe un partido con esa sigla.";
      if (/parties_name/.test(msg)) return "Ya existe un partido con ese nombre.";
      if (/parties_number/.test(msg)) return "Ese número de lista ya está asignado a otro partido.";
      if (/candidates_name/.test(msg)) return "Ese candidato ya está registrado para el mismo cargo.";
      if (/candidates_number/.test(msg)) return "Ese número de candidatura ya existe para el cargo.";
      if (/elections_name/.test(msg)) return "Ya existe una elección con ese nombre.";
      return "El registro ya existe (dato duplicado).";
    }
    case "23503":
      return "No se puede completar: el registro está vinculado a otros datos (por ejemplo, votos registrados). Desactívelo en lugar de eliminarlo.";
    case "23514":
      return "Algún valor no cumple las reglas de validación (formato, longitud o rango).";
    case "42501":
      return /row-level security/i.test(msg) ? "Su rol no tiene permiso para realizar esta operación." : msg;
    case "PGRST116":
      return "El registro solicitado no existe.";
  }
  if (/Failed to fetch|NetworkError/i.test(msg)) return "Sin conexión con el servidor. Verifique su conexión a internet.";
  if (/Invalid login credentials/i.test(msg)) return "Correo o contraseña incorrectos.";
  if (/Email not confirmed/i.test(msg)) return "El correo aún no ha sido confirmado.";
  return msg;
}
