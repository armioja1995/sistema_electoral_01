export type UserRole = "administrador" | "registrador" | "consulta";
export type ElectionStatus = "configuracion" | "en_proceso" | "finalizado";
export type TableStatus = "pendiente" | "en_registro" | "registrada" | "observada" | "validada";

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  active: boolean;
  created_at: string;
}

export interface Election {
  id: string;
  name: string;
  description: string | null;
  election_date: string;
  position: string;
  status: ElectionStatus;
  is_active: boolean;
  is_demo: boolean;
  created_at: string;
}

export interface PollingPlace {
  id: string;
  election_id: string;
  code: string;
  name: string;
  address: string | null;
  district: string;
  province: string;
  department: string;
  reference: string | null;
  active: boolean;
  table_count?: number;
  processed_count?: number;
  registered_voters?: number;
}

export interface PollingTable {
  id: string;
  election_id: string;
  polling_place_id: string;
  code: string;
  registered_voters: number;
  status: TableStatus;
  assigned_to: string | null;
  updated_at: string;
  // Campos de la vista v_polling_tables
  place_code?: string;
  place_name?: string;
  district?: string;
  province?: string;
  department?: string;
  assigned_name?: string | null;
  result_id?: string | null;
  votes_cast?: number | null;
  valid_votes?: number | null;
  null_votes?: number | null;
  blank_votes?: number | null;
  did_not_vote?: number | null;
  is_final?: boolean | null;
  observation?: string | null;
  registered_at?: string | null;
  result_updated_at?: string | null;
  finalized_at?: string | null;
  registered_by_name?: string | null;
  updated_by_name?: string | null;
}

export interface PoliticalParty {
  id: string;
  election_id: string;
  name: string;
  acronym: string;
  color: string;
  logo_url: string | null;
  list_number: number | null;
  active: boolean;
}

export interface Candidate {
  id: string;
  election_id: string;
  party_id: string;
  full_name: string;
  candidate_number: number | null;
  position: string;
  photo_url: string | null;
  active: boolean;
  political_parties?: Pick<PoliticalParty, "name" | "acronym" | "color" | "list_number"> | null;
}

export interface CandidateVote {
  candidate_id: string;
  votes: number;
}

export interface StatsCandidate {
  id: string;
  full_name: string;
  position: string;
  party_name: string;
  acronym: string;
  color: string;
  votes: number;
}

export interface ElectionStats {
  total_places: number;
  total_tables: number;
  status_counts: Partial<Record<TableStatus, number>>;
  registered_voters_total: number;
  processed_tables: number;
  registered_voters_counted: number;
  votes_cast: number;
  valid_votes: number;
  null_votes: number;
  blank_votes: number;
  did_not_vote: number;
  candidates: StatsCandidate[];
  timeline: { n: number; at: string; votes_cast: number; valid_votes: number }[];
  generated_at: string;
}

export interface ProjectionCandidate {
  id: string;
  full_name: string;
  acronym: string;
  party_name: string;
  color: string;
  votes: number;
  share: number | null;
  se: number | null;
  share_low: number | null;
  share_high: number | null;
}

export interface Projection {
  processed_tables: number;
  total_tables: number;
  registered_voters_counted: number;
  registered_voters_total: number;
  valid_votes_counted: number;
  votes_cast_counted: number;
  turnout_observed: number | null;
  projected_valid_votes: number | null;
  candidates: ProjectionCandidate[];
  generated_at: string;
}

export interface AuditLog {
  id: number;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  timestamp: string;
  details: Record<string, unknown>;
  user_email?: string | null;
  user_name?: string | null;
}

export interface Paged<T> {
  rows: T[];
  total: number;
}
