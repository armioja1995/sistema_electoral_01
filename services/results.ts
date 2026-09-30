import { db, unwrap } from "./base";
import type { Candidate, CandidateVote, ElectionStats, Projection, TableStatus } from "@/types";

/** Candidatos del acta: activos + los que ya tengan votos en esta mesa. */
export async function getTallyCandidates(electionId: string, resultId: string | null | undefined) {
  const candidates = unwrap(
    await db().from("candidates").select("*, political_parties(name, acronym, color, list_number)")
      .eq("election_id", electionId),
  ) as Candidate[];
  let votes: CandidateVote[] = [];
  if (resultId) {
    votes = unwrap(await db().from("candidate_votes").select("candidate_id, votes").eq("table_result_id", resultId));
  }
  const withVotes = new Set(votes.map((v) => v.candidate_id));
  const list = candidates
    .filter((c) => c.active || withVotes.has(c.id))
    .sort((a, b) =>
      (a.political_parties?.list_number ?? 999) - (b.political_parties?.list_number ?? 999) ||
      (a.candidate_number ?? 999) - (b.candidate_number ?? 999) ||
      a.full_name.localeCompare(b.full_name));
  return { candidates: list, votes };
}

export interface SaveResultInput {
  tableId: string;
  votes: CandidateVote[];
  nullVotes: number;
  blankVotes: number;
  votesCast: number;
  finalize: boolean;
  observation?: string | null;
}

export async function saveResult(i: SaveResultInput) {
  return unwrap(
    await db().rpc("save_table_result", {
      p_table_id: i.tableId,
      p_votes: i.votes,
      p_null_votes: i.nullVotes,
      p_blank_votes: i.blankVotes,
      p_votes_cast: i.votesCast,
      p_finalize: i.finalize,
      p_observation: i.observation ?? null,
    }),
  ) as { result_id: string; status: TableStatus };
}

export async function adminSetStatus(tableId: string, status: TableStatus, note?: string) {
  unwrap(await db().rpc("admin_set_table_status", { p_table_id: tableId, p_status: status, p_note: note ?? null }));
}

export async function getStats(electionId: string): Promise<ElectionStats> {
  return unwrap(await db().rpc("get_election_stats", { p_election_id: electionId })) as ElectionStats;
}

export async function getProjection(electionId: string): Promise<Projection> {
  return unwrap(await db().rpc("get_projection", { p_election_id: electionId })) as Projection;
}

/** Exporta resultados por mesa en bloques de 1000 filas. */
export async function exportResults(electionId: string) {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = unwrap(
      await db().from("v_results_export").select("*").eq("election_id", electionId)
        .order("local_codigo").order("mesa").range(from, from + 999),
    ) as Record<string, unknown>[];
    for (const r of rows) {
      const { votos_candidatos, election_id: _e, ...rest } = r;
      out.push({ ...rest, ...((votos_candidatos as Record<string, number>) ?? {}) });
    }
    if (rows.length < 1000) break;
  }
  return out;
}
