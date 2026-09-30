import { db, unwrap } from "./base";
import type { Election } from "@/types";
import { cleanText } from "@/utils/sanitize";

export async function listElections(): Promise<Election[]> {
  return unwrap(await db().from("elections").select("*").order("created_at", { ascending: false }));
}

export type ElectionInput = Pick<Election, "name" | "description" | "election_date" | "position" | "status">;

export async function saveElection(input: ElectionInput, id?: string) {
  const row = {
    name: cleanText(input.name, 150),
    description: cleanText(input.description, 1000) || null,
    election_date: input.election_date,
    position: cleanText(input.position, 100),
    status: input.status,
  };
  const q = id ? db().from("elections").update(row).eq("id", id) : db().from("elections").insert(row);
  return unwrap(await q.select().single<Election>());
}

export async function setActiveElection(id: string) {
  unwrap(await db().rpc("set_active_election", { p_election_id: id }));
}

export async function deleteElection(id: string) {
  unwrap(await db().from("elections").delete().eq("id", id));
}

export async function seedDemo(withResults: boolean) {
  return unwrap(await db().rpc("seed_demo_data", { p_with_results: withResults }));
}

export async function deleteDemo() {
  return unwrap(await db().rpc("delete_demo_data"));
}
