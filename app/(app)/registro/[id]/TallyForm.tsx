"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, AlertCircle, Lock, Save, ShieldCheck, RotateCcw, Flag } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { useApp } from "@/hooks/useApp";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { CandidateVoteInput } from "@/components/CandidateVoteInput";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { ErrorState, LoadingState } from "@/components/States";
import { getTable } from "@/services/tables";
import { adminSetStatus, getTallyCandidates, saveResult } from "@/services/results";
import { tableHistory } from "@/services/audit";
import type { AuditLog, Candidate, PollingTable, TableStatus } from "@/types";
import { checkTally } from "@/utils/validation";
import { toNonNegInt } from "@/utils/sanitize";
import { fmtDateTime, fmtNum, fmtPct } from "@/utils/format";
import { cn } from "@/utils/cn";

type Vals = Record<string, string>;
const CLOSED: TableStatus[] = ["registrada", "observada", "validada"];

export function TallyForm({ tableId }: { tableId: string | null }) {
  const { profile, election, isAdmin } = useApp();
  const [table, setTable] = useState<PollingTable | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [vals, setVals] = useState<Vals>({});
  const [history, setHistory] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"draft" | "final" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [observation, setObservation] = useState("");
  const [adminAction, setAdminAction] = useState<null | "validada" | "registrada" | "observada" | "en_registro">(null);
  const [adminNote, setAdminNote] = useState("");
  const [staleNotice, setStaleNotice] = useState(false);
  const [dirty, setDirty] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const ignoreUntil = useRef(0);

  const load = useCallback(async () => {
    if (!tableId) { setError("La mesa indicada no existe."); setLoading(false); return; }
    setLoading(true); setError(null); setStaleNotice(false);
    try {
      const t = await getTable(tableId);
      if (!t || (election && t.election_id !== election.id)) throw new Error("La mesa indicada no existe en el proceso activo.");
      const { candidates, votes } = await getTallyCandidates(t.election_id, t.result_id);
      const map = new Map(votes.map((v) => [v.candidate_id, String(v.votes)]));
      const has = !!t.result_id;
      setTable(t);
      setCandidates(candidates);
      setVals({
        ...Object.fromEntries(candidates.map((c) => [c.id, map.get(c.id) ?? (has ? "0" : "")])),
        __null: has ? String(t.null_votes ?? 0) : "",
        __blank: has ? String(t.blank_votes ?? 0) : "",
        __cast: has ? String(t.votes_cast ?? 0) : "",
      });
      setObservation(t.observation ?? "");
      setDirty(false);
      if (isAdmin) tableHistory(t.id, t.result_id).then(setHistory).catch(() => setHistory([]));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tableId, election, isAdmin]);

  useEffect(() => { load(); }, [load]);

  // Aviso si otro usuario modifica esta mesa mientras está abierta
  useEffect(() => {
    if (!tableId) return;
    const sb = getSupabase();
    const ch = sb.channel(`table-${tableId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "polling_tables", filter: `id=eq.${tableId}` }, () => {
        if (Date.now() > ignoreUntil.current) setStaleNotice(true);
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [tableId]);

  // Advertir antes de salir con cambios sin guardar
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const num = (k: string) => (vals[k] === "" || vals[k] == null ? null : toNonNegInt(vals[k]));
  const check = useMemo(() => checkTally({
    registeredVoters: table?.registered_voters ?? 0,
    candidateVotes: candidates.map((c) => num(c.id)),
    nullVotes: num("__null"), blankVotes: num("__blank"), votesCast: num("__cast"),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [vals, candidates, table]);

  if (loading && !table) return <Card><LoadingState rows={8} label="Cargando acta" /></Card>;
  if (error || !table) return (
    <Card><ErrorState message={error ?? "La mesa no existe."} onRetry={tableId ? load : undefined} />
      <div className="pb-6 text-center"><Link href="/registro" className="text-sm text-brand hover:underline">Volver a la lista de mesas</Link></div>
    </Card>
  );

  const closed = CLOSED.includes(table.status);
  const lockReason =
    election?.status === "finalizado" ? "El proceso electoral está finalizado. El acta es de solo lectura." :
    !isAdmin && table.assigned_to !== profile.id ? "Esta mesa no está asignada a su usuario." :
    !isAdmin && election?.status !== "en_proceso" ? "El registro se habilita cuando el proceso pasa a «En proceso»." :
    !isAdmin && closed ? "El acta ya fue cerrada. Solo un administrador puede modificarla." :
    null;
  const readOnly = !!lockReason;
  const needsObservation = isAdmin && check.complete && !check.consistent;

  const set = (k: string, v: string) => { setVals((s) => ({ ...s, [k]: v })); setDirty(true); };
  const focusNext = (i: number) => inputs.current[i + 1]?.focus();
  const order = [...candidates.map((c) => c.id), "__null", "__blank", "__cast"];

  async function submit(finalize: boolean) {
    if (!table) return;
    if (!finalize && check.errors.some((e) => e.includes("superan"))) { toast.error(check.errors[0]); return; }
    setSaving(finalize ? "final" : "draft");
    ignoreUntil.current = Date.now() + 4000;
    try {
      const r = await saveResult({
        tableId: table.id,
        votes: candidates.map((c) => ({ candidate_id: c.id, votes: num(c.id) ?? 0 })),
        nullVotes: num("__null") ?? 0, blankVotes: num("__blank") ?? 0, votesCast: num("__cast") ?? 0,
        finalize, observation: isAdmin ? observation : null,
      });
      toast.success(r.status === "en_registro" ? "Borrador guardado." :
        r.status === "observada" ? "Acta cerrada con observación." : `Mesa ${table.code} registrada.`);
      setConfirm(false);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  async function runAdmin() {
    if (!table || !adminAction) return;
    ignoreUntil.current = Date.now() + 4000;
    try {
      await adminSetStatus(table.id, adminAction, adminNote);
      toast.success("Estado actualizado.");
      setAdminAction(null); setAdminNote("");
      await load();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="pb-28 lg:pb-0">
      <Link href="/registro" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />Mesas
      </Link>

      {/* Cabecera del acta */}
      <Card className="mb-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">{table.place_code} · {table.place_name}</p>
            <h1 className="mt-0.5 flex flex-wrap items-center gap-3 text-2xl font-semibold text-ink sm:text-3xl">
              Mesa <span className="tabular-nums">{table.code}</span>
              <StatusBadge status={table.status} className="text-sm" />
            </h1>
            <p className="mt-1 text-xs text-ink-muted">{table.district}, {table.province}, {table.department}</p>
          </div>
          <div className="rounded-md bg-brand-soft px-4 py-2 text-right">
            <p className="text-xs text-brand">Electores habilitados</p>
            <p className="text-2xl font-semibold tabular-nums text-brand-dark">{fmtNum(table.registered_voters)}</p>
          </div>
        </div>
        {table.registered_at && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-line bg-paper px-4 py-2 text-xs text-ink-muted sm:px-5">
            <span>Registrada: <strong className="font-medium text-ink-soft">{fmtDateTime(table.registered_at)}</strong> por {table.registered_by_name ?? "—"}</span>
            {table.result_updated_at && <span>Modificada: <strong className="font-medium text-ink-soft">{fmtDateTime(table.result_updated_at)}</strong> por {table.updated_by_name ?? "—"}</span>}
          </div>
        )}
      </Card>

      {staleNotice && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800" role="status">
          Otro usuario actualizó esta mesa.
          <Button size="sm" variant="secondary" onClick={load}>Cargar la versión actual</Button>
        </div>
      )}
      {lockReason && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-line bg-paper-sunken px-4 py-2.5 text-sm text-ink-soft">
          <Lock className="h-4 w-4 shrink-0" />{lockReason}
        </div>
      )}
      {table.observation && table.status === "observada" && (
        <div className="mb-4 rounded-md border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm text-orange-800">
          <strong>Observación:</strong> {table.observation}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Votos por candidato" description="Transcriba los votos del acta. Enter pasa al siguiente campo." />
            {candidates.length === 0 ? (
              <p className="p-5 text-sm text-ink-muted">No hay candidatos activos. Un administrador debe registrarlos.</p>
            ) : (
              <ul className="divide-y divide-line">
                {candidates.map((c, i) => (
                  <li key={c.id} className="grid grid-cols-[4px_1fr_110px] items-center gap-3 px-4 py-2.5 sm:grid-cols-[4px_1fr_140px] sm:px-5">
                    <span className="h-10 rounded-full" style={{ background: c.political_parties?.color }} aria-hidden />
                    <label htmlFor={`v-${c.id}`} className="min-w-0">
                      <span className="block truncate font-medium text-ink">{c.full_name}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        {c.political_parties?.acronym} · {c.political_parties?.name}{!c.active && " (inactivo)"}
                      </span>
                    </label>
                    <CandidateVoteInput id={`v-${c.id}`} label={`Votos de ${c.full_name}`}
                      ref={(el) => { inputs.current[i] = el; }}
                      value={vals[c.id] ?? ""} onChange={(v) => set(c.id, v)} disabled={readOnly}
                      onEnter={() => focusNext(i)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Totales del acta" />
            <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
              {([["__null", "Votos nulos"], ["__blank", "Votos en blanco"], ["__cast", "Total de votos emitidos"]] as const).map(([k, label], j) => (
                <Field key={k} label={label} htmlFor={`v-${k}`}
                  hint={k === "__cast" ? "Total de ciudadanos que votaron, según el acta." : undefined}>
                  <CandidateVoteInput id={`v-${k}`} label={label}
                    ref={(el) => { inputs.current[candidates.length + j] = el; }}
                    value={vals[k] ?? ""} onChange={(v) => set(k, v)} disabled={readOnly}
                    invalid={k === "__cast" && check.complete && !check.consistent}
                    onEnter={() => (candidates.length + j === order.length - 1 ? undefined : focusNext(candidates.length + j))} />
                </Field>
              ))}
            </div>
          </Card>

          {isAdmin && !readOnly && (
            <Card>
              <CardHeader title="Observación administrativa" description="Solo si el acta presenta inconsistencias y debe cerrarse como Observada." />
              <div className="p-4 sm:p-5">
                <Textarea value={observation} onChange={(e) => { setObservation(e.target.value); setDirty(true); }} maxLength={1000}
                  placeholder="Ej.: el acta física presenta una diferencia de 2 votos entre la suma y el total de votantes." aria-label="Observación" />
              </div>
            </Card>
          )}

          {isAdmin && table.result_id && (
            <Card>
              <CardHeader title="Acciones administrativas" />
              <div className="flex flex-wrap gap-2 p-4 sm:p-5">
                {table.status === "registrada" && <Button variant="success" onClick={() => setAdminAction("validada")}><ShieldCheck className="h-4 w-4" />Validar acta</Button>}
                {table.status === "validada" && <Button variant="secondary" onClick={() => setAdminAction("registrada")}>Quitar validación</Button>}
                {(table.status === "registrada" || table.status === "validada") && <Button variant="secondary" onClick={() => setAdminAction("observada")}><Flag className="h-4 w-4" />Marcar como observada</Button>}
                {closed && <Button variant="secondary" onClick={() => setAdminAction("en_registro")}><RotateCcw className="h-4 w-4" />Reabrir acta</Button>}
                {!closed && <p className="text-sm text-ink-muted">El acta está en borrador; ciérrela para validarla.</p>}
              </div>
            </Card>
          )}

          {isAdmin && history.length > 0 && (
            <Card>
              <CardHeader title="Historial de la mesa" />
              <ol className="divide-y divide-line text-sm">
                {history.map((h) => (
                  <li key={h.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5 sm:px-5">
                    <span><strong className="font-medium">{h.action.replace(/_/g, " ")}</strong> · {h.user_name ?? h.user_email ?? "Sistema"}</span>
                    <span className="tabular-nums text-ink-muted">{fmtDateTime(h.timestamp)}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>

        {/* Resumen con validación en vivo */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader title="Resumen del acta" />
            <dl className="space-y-2 p-4 text-sm sm:p-5">
              <Row label="Votos válidos (suma candidatos)" value={fmtNum(check.valid)} />
              <Row label="+ Nulos" value={fmtNum(num("__null") ?? 0)} />
              <Row label="+ En blanco" value={fmtNum(num("__blank") ?? 0)} />
              <div className="border-t border-line pt-2">
                <Row label="= Suma registrada" value={fmtNum(check.sumCast)} strong />
                <Row label="Emitidos según acta" value={num("__cast") == null ? "—" : fmtNum(num("__cast"))} strong />
              </div>
              <div className={cn("flex items-center gap-2 rounded-md px-3 py-2 font-medium",
                !check.complete ? "bg-paper-sunken text-ink-muted" : check.consistent ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger")}>
                {!check.complete ? "Complete todos los campos" : check.consistent
                  ? <><CheckCircle2 className="h-4 w-4" />El acta cuadra</>
                  : <><AlertCircle className="h-4 w-4" />El acta no cuadra</>}
              </div>
              <div className="space-y-2 border-t border-line pt-2">
                <Row label="No votaron (calculado)" value={check.didNotVote == null ? "—" : fmtNum(check.didNotVote)} />
                <Row label="Participación" value={fmtPct(check.turnout)} />
                <Row label="Abstención" value={fmtPct(check.abstention)} />
              </div>
            </dl>
            {check.errors.length > 0 && (
              <ul className="space-y-1 border-t border-line px-4 py-3 text-sm text-danger sm:px-5" role="alert">
                {check.errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            )}
            {!readOnly && (
              <div className="hidden gap-2 border-t border-line p-4 lg:flex lg:flex-col">
                {actions()}
              </div>
            )}
          </Card>
        </aside>
      </div>

      {/* Barra de acciones fija en móvil */}
      {!readOnly && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-line bg-paper-raised p-3 shadow-[0_-4px_12px_rgba(27,42,58,0.06)] lg:hidden">
          {actions()}
        </div>
      )}

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => submit(true)} loading={saving === "final"}
        title={needsObservation ? `Cerrar mesa ${table.code} con observación` : `Cerrar acta de la mesa ${table.code}`}
        tone={needsObservation ? "primary" : "success"} confirmLabel={needsObservation ? "Cerrar como observada" : "Cerrar acta"}>
        <p>Votos emitidos: <strong className="tabular-nums">{fmtNum(num("__cast"))}</strong> · válidos: <strong className="tabular-nums">{fmtNum(check.valid)}</strong> · participación: <strong>{fmtPct(check.turnout)}</strong></p>
        {needsObservation
          ? <p className="text-orange-700">El acta no cuadra. Quedará como «Observada» y no se sumará a los resultados hasta resolverla.</p>
          : <p>Al cerrar, la mesa pasa a «Registrada» y se suma a los resultados. {!isAdmin && "Después solo un administrador podrá modificarla."}</p>}
      </ConfirmDialog>

      <ConfirmDialog open={!!adminAction} onClose={() => setAdminAction(null)} onConfirm={runAdmin}
        title={{ validada: "Validar acta", registrada: "Quitar validación", observada: "Marcar como observada", en_registro: "Reabrir acta" }[adminAction ?? "validada"]}
        confirmLabel="Confirmar" tone={adminAction === "validada" ? "success" : "primary"}>
        {adminAction === "en_registro" && <p>El acta volverá a borrador y dejará de sumarse a los resultados hasta cerrarse nuevamente.</p>}
        {adminAction === "validada" && <p>Confirma que el acta fue verificada contra el documento físico.</p>}
        {adminAction === "observada" && (
          <Field label="Motivo de la observación" required>
            <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} maxLength={1000} />
          </Field>
        )}
      </ConfirmDialog>
    </div>
  );

  function actions() {
    const blockFinal = !check.complete || (!check.consistent && !(isAdmin && observation.trim())) || candidates.length === 0;
    return (
      <>
        {!closed && (
          <Button variant="secondary" className="flex-1" onClick={() => submit(false)} loading={saving === "draft"} disabled={!!saving}>
            <Save className="h-4 w-4" />Guardar borrador
          </Button>
        )}
        <Button variant={needsObservation ? "primary" : "success"} className="flex-1" onClick={() => setConfirm(true)} disabled={blockFinal || !!saving}>
          <CheckCircle2 className="h-4 w-4" />{needsObservation ? "Cerrar con observación" : closed ? "Guardar cambios" : "Cerrar acta"}
        </Button>
      </>
    );
  }
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={cn("tabular-nums text-ink", strong && "text-base font-semibold")}>{value}</dd>
    </div>
  );
}
