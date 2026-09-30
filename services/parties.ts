import { db, unwrap } from "./base";
import type { Candidate, PoliticalParty } from "@/types";
import { cleanText, toNonNegInt } from "@/utils/sanitize";

export async function listParties(electionId: string): Promise<PoliticalParty[]> {
  return unwrap(
    await db().from("political_parties").select("*").eq("election_id", electionId)
      .order("list_number", { ascending: true, nullsFirst: false }).order("name"),
  );
}

function normalizeParty(v: Record<string, unknown>) {
  const color = String(v.color ?? "").trim();
  const logo = cleanText(v.logo_url, 500);
  const num = String(v.list_number ?? "").trim();
  return {
    name: cleanText(v.name, 150),
    acronym: cleanText(v.acronym, 20).toUpperCase(),
    color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#64748B",
    logo_url: logo ? (logo.startsWith("https://") ? logo : null) : null,
    list_number: num ? toNonNegInt(num) : null,
  };
}

export async function saveParty(electionId: string, v: Record<string, unknown>, id?: string) {
  const row = normalizeParty(v);
  const q = id
    ? db().from("political_parties").update(row).eq("id", id)
    : db().from("political_parties").insert({ ...row, election_id: electionId });
  unwrap(await q);
}

export async function setPartyActive(id: string, active: boolean) {
  unwrap(await db().from("political_parties").update({ active }).eq("id", id));
}

/** CSV: nombre, sigla, color, numero_lista */
export async function importParties(electionId: string, rows: Record<string, string>[]) {
  const data = rows.map((r) => ({
    ...normalizeParty({ name: r.nombre, acronym: r.sigla, color: r.color, list_number: r.numero_lista }),
    election_id: electionId,
  }));
  // upsert por (election_id, lower(acronym)) no es posible con índice de expresión: insertar y reportar duplicados
  unwrap(await db().from("political_parties").insert(data));
  return data.length;
}

export async function listCandidates(electionId: string): Promise<Candidate[]> {
  return unwrap(
    await db().from("candidates").select("*, political_parties(name, acronym, color, list_number)")
      .eq("election_id", electionId).order("full_name"),
  );
}

function normalizeCandidate(v: Record<string, unknown>) {
  const num = String(v.candidate_number ?? "").trim();
  const photo = cleanText(v.photo_url, 500);
  return {
    party_id: String(v.party_id ?? ""),
    full_name: cleanText(v.full_name, 200),
    candidate_number: num ? toNonNegInt(num) : null,
    position: cleanText(v.position, 100),
    photo_url: photo && photo.startsWith("https://") ? photo : null,
  };
}

export async function saveCandidate(v: Record<string, unknown>, id?: string) {
  const row = normalizeCandidate(v);
  if (!row.party_id) throw new Error("Seleccione el partido del candidato.");
  const q = id
    ? db().from("candidates").update(row).eq("id", id)
    : db().from("candidates").insert({ ...row, election_id: "00000000-0000-0000-0000-000000000000" }); // lo fija el trigger
  unwrap(await q);
}

export async function setCandidateActive(id: string, active: boolean) {
  unwrap(await db().from("candidates").update({ active }).eq("id", id));
}

/** CSV: nombre_completo, sigla_partido, cargo, numero */
export async function importCandidates(electionId: string, rows: Record<string, string>[]) {
  const parties = await listParties(electionId);
  const map = new Map(parties.map((p) => [p.acronym.toUpperCase(), p.id]));
  const errors: string[] = [];
  const data = rows.flatMap((r, i) => {
    const partyId = map.get(String(r.sigla_partido ?? "").trim().toUpperCase());
    if (!partyId) { errors.push(`Fila ${i + 2}: el partido "${r.sigla_partido}" no existe.`); return []; }
    return [{
      ...normalizeCandidate({ party_id: partyId, full_name: r.nombre_completo, position: r.cargo, candidate_number: r.numero }),
      election_id: electionId,
    }];
  });
  if (errors.length) throw new Error(errors.slice(0, 5).join("\n"));
  unwrap(await db().from("candidates").insert(data));
  return data.length;
}
