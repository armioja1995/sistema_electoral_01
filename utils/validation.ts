/**
 * Validación del acta (compartida por el formulario; el servidor repite
 * las mismas reglas en save_table_result()).
 */
export interface TallyInput {
  registeredVoters: number;
  candidateVotes: (number | null)[];
  nullVotes: number | null;
  blankVotes: number | null;
  votesCast: number | null;
}

export interface TallyCheck {
  valid: number;
  sumCast: number;           // válidos + nulos + blancos
  didNotVote: number | null; // habilitados - emitidos
  turnout: number | null;
  abstention: number | null;
  errors: string[];
  complete: boolean;
  consistent: boolean;
}

export function checkTally(t: TallyInput): TallyCheck {
  const errors: string[] = [];
  const valid = t.candidateVotes.reduce<number>((a, v) => a + (v ?? 0), 0);
  const sumCast = valid + (t.nullVotes ?? 0) + (t.blankVotes ?? 0);
  const complete =
    t.candidateVotes.every((v) => v !== null) && t.nullVotes !== null && t.blankVotes !== null && t.votesCast !== null;

  if (t.registeredVoters <= 0) errors.push("La mesa no tiene electores habilitados registrados.");
  if (t.votesCast !== null && t.votesCast > t.registeredVoters)
    errors.push(`Los votos emitidos (${t.votesCast}) superan el número de electores habilitados (${t.registeredVoters}).`);
  if (sumCast > t.registeredVoters)
    errors.push(`Los votos registrados (${sumCast}) superan el número de electores habilitados (${t.registeredVoters}).`);
  if (t.votesCast !== null && complete && sumCast !== t.votesCast)
    errors.push(`La suma de votos válidos, nulos y blancos (${sumCast}) no coincide con el total de votos emitidos (${t.votesCast}).`);

  const didNotVote = t.votesCast !== null ? t.registeredVoters - t.votesCast : null;
  const turnout = t.votesCast !== null && t.registeredVoters > 0 ? t.votesCast / t.registeredVoters : null;
  return {
    valid,
    sumCast,
    didNotVote,
    turnout,
    abstention: turnout !== null ? 1 - turnout : null,
    errors,
    complete,
    consistent: complete && errors.length === 0,
  };
}
