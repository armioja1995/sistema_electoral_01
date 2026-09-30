import { db, range, unwrap, PAGE_SIZE } from "./base";
import type { Paged, PollingTable, TableStatus } from "@/types";
import { cleanCode, cleanSearch, toNonNegInt } from "@/utils/sanitize";

export interface TableFilters {
  search?: string;
  placeId?: string;
  status?: TableStatus | "";
  assignedTo?: string; // filtra por registrador (vista del registrador)
}

export async function listTables(electionId: string, f: TableFilters, page: number, pageSize = PAGE_SIZE): Promise<Paged<PollingTable>> {
  let q = db().from("v_polling_tables").select("*", { count: "exact" }).eq("election_id", electionId);
  const s = cleanSearch(f.search ?? "");
  if (s) q = q.or(`code.ilike.%${s}%,place_name.ilike.%${s}%,place_code.ilike.%${s}%`);
  if (f.placeId) q = q.eq("polling_place_id", f.placeId);
  if (f.status) q = q.eq("status", f.status);
  if (f.assignedTo) q = q.eq("assigned_to", f.assignedTo);
  const [a, b] = range(page, pageSize);
  const res = await q.order("code").range(a, b);
  return { rows: unwrap(res) ?? [], total: res.count ?? 0 };
}

export async function getTable(id: string): Promise<PollingTable | null> {
  return unwrap(await db().from("v_polling_tables").select("*").eq("id", id).maybeSingle<PollingTable>());
}

export async function saveTable(v: { code: string; polling_place_id: string; registered_voters: unknown; assigned_to?: string | null }, id?: string) {
  const voters = toNonNegInt(v.registered_voters);
  if (voters === null) throw new Error("Los electores habilitados deben ser un número entero no negativo.");
  const row = {
    code: cleanCode(v.code),
    polling_place_id: v.polling_place_id,
    registered_voters: voters,
    assigned_to: v.assigned_to || null,
  };
  // election_id lo fija un trigger a partir del local
  const q = id
    ? db().from("polling_tables").update(row).eq("id", id)
    : db().from("polling_tables").insert({ ...row, election_id: "00000000-0000-0000-0000-000000000000" });
  unwrap(await q);
}

export async function deleteTable(id: string) {
  unwrap(await db().from("polling_tables").delete().eq("id", id));
}

/** CSV: codigo_mesa, codigo_local, electores_habilitados */
export async function importTables(electionId: string, rows: Record<string, string>[]) {
  const places = unwrap(
    await db().from("polling_places").select("id, code").eq("election_id", electionId).limit(10000),
  ) as { id: string; code: string }[];
  const map = new Map(places.map((p) => [p.code.toUpperCase(), p.id]));
  const errors: string[] = [];
  const data = rows.flatMap((r, i) => {
    const placeId = map.get(cleanCode(r.codigo_local));
    const voters = toNonNegInt(r.electores_habilitados);
    if (!placeId) { errors.push(`Fila ${i + 2}: el local "${r.codigo_local}" no existe.`); return []; }
    if (voters === null) { errors.push(`Fila ${i + 2}: electores habilitados inválidos.`); return []; }
    return [{ election_id: electionId, polling_place_id: placeId, code: cleanCode(r.codigo_mesa), registered_voters: voters }];
  });
  if (errors.length) throw new Error(errors.slice(0, 5).join("\n") + (errors.length > 5 ? `\n… y ${errors.length - 5} errores más.` : ""));
  unwrap(await db().from("polling_tables").upsert(data, { onConflict: "election_id,code" }));
  return data.length;
}
