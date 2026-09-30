import { db, range, unwrap, PAGE_SIZE } from "./base";
import type { Paged, PollingPlace } from "@/types";
import { cleanCode, cleanSearch, cleanText } from "@/utils/sanitize";

export interface PlaceFilters {
  search?: string;
  department?: string;
  province?: string;
  district?: string;
  active?: "all" | "true" | "false";
}

export async function listPlaces(electionId: string, f: PlaceFilters, page: number): Promise<Paged<PollingPlace>> {
  let q = db().from("v_polling_places").select("*", { count: "exact" }).eq("election_id", electionId);
  const s = cleanSearch(f.search ?? "");
  if (s) q = q.or(`name.ilike.%${s}%,code.ilike.%${s}%,address.ilike.%${s}%`);
  if (f.department) q = q.eq("department", f.department);
  if (f.province) q = q.eq("province", f.province);
  if (f.district) q = q.eq("district", f.district);
  if (f.active && f.active !== "all") q = q.eq("active", f.active === "true");
  const [a, b] = range(page, PAGE_SIZE);
  const res = await q.order("code").range(a, b);
  return { rows: unwrap(res) ?? [], total: res.count ?? 0 };
}

/** Lista liviana para selectores (solo id, código y nombre). */
export async function placeOptions(electionId: string) {
  return unwrap(
    await db().from("polling_places").select("id, code, name").eq("election_id", electionId).eq("active", true).order("code").limit(5000),
  ) as { id: string; code: string; name: string }[];
}

/** Valores distintos de ubicación para los filtros. */
export async function placeLocations(electionId: string) {
  const rows = unwrap(
    await db().from("polling_places").select("department, province, district").eq("election_id", electionId).limit(5000),
  ) as { department: string; province: string; district: string }[];
  const uniq = (k: "department" | "province" | "district") => [...new Set(rows.map((r) => r[k]).filter(Boolean))].sort();
  return { departments: uniq("department"), provinces: uniq("province"), districts: uniq("district") };
}

export function normalizePlace(v: Record<string, unknown>) {
  return {
    code: cleanCode(v.code),
    name: cleanText(v.name, 200),
    address: cleanText(v.address, 300) || null,
    district: cleanText(v.district, 100),
    province: cleanText(v.province, 100),
    department: cleanText(v.department, 100),
    reference: cleanText(v.reference, 300) || null,
  };
}

export async function savePlace(electionId: string, v: Record<string, unknown>, id?: string) {
  const row = normalizePlace(v);
  const q = id
    ? db().from("polling_places").update(row).eq("id", id)
    : db().from("polling_places").insert({ ...row, election_id: electionId });
  unwrap(await q);
}

export async function setPlaceActive(id: string, active: boolean) {
  unwrap(await db().from("polling_places").update({ active }).eq("id", id));
}

export async function importPlaces(electionId: string, rows: Record<string, string>[]) {
  const data = rows.map((r) => ({ ...normalizePlace(r), election_id: electionId }));
  unwrap(await db().from("polling_places").upsert(data, { onConflict: "election_id,code" }));
  return data.length;
}
