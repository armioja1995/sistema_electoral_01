"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Power, UserRound } from "lucide-react";
import { useApp } from "@/hooks/useApp";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader } from "@/components/PageHeader";
import { NoElection } from "@/components/NoElection";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/DataTable";
import { FilterBar, SearchInput } from "@/components/FilterBar";
import { EntityForm, type FieldDef } from "@/components/EntityForm";
import { ImportCsvDialog } from "@/components/ImportCsvDialog";
import { Pill } from "@/components/StatusBadge";
import { importCandidates, listCandidates, listParties, saveCandidate, setCandidateActive } from "@/services/parties";
import type { Candidate } from "@/types";

export function CandidatesView() {
  const { election } = useApp();
  const eid = election?.id ?? "";
  const { data, loading, error, reload } = useAsync(() => (eid ? listCandidates(eid) : Promise.resolve([])), [eid]);
  const parties = useAsync(() => (eid ? listParties(eid) : Promise.resolve([])), [eid]);
  const [form, setForm] = useState<{ open: boolean; item?: Candidate }>({ open: false });
  const [search, setSearch] = useState("");
  const [partyId, setPartyId] = useState("");

  const fields: FieldDef[] = useMemo(() => [
    { name: "full_name", label: "Nombre completo", required: true, full: true, maxLength: 200 },
    { name: "party_id", label: "Partido", type: "select", required: true,
      options: (parties.data ?? []).filter((p) => p.active).map((p) => ({ value: p.id, label: `${p.acronym} · ${p.name}` })) },
    { name: "position", label: "Cargo", required: true, maxLength: 100 },
    { name: "candidate_number", label: "Número de candidatura", type: "number" },
    { name: "photo_url", label: "Fotografía (URL https, opcional)", pattern: /^https:\/\/\S+$/, patternMessage: "Debe ser una URL que empiece con https://", maxLength: 500 },
  ], [parties.data]);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (data ?? []).filter((c) =>
      (!partyId || c.party_id === partyId) &&
      (!s || c.full_name.toLowerCase().includes(s) || c.political_parties?.acronym.toLowerCase().includes(s)));
  }, [data, search, partyId]);

  if (!election) return <><PageHeader title="Candidatos" /><NoElection /></>;

  async function toggle(c: Candidate) {
    try { await setCandidateActive(c.id, !c.active); toast.success(c.active ? "Candidato desactivado." : "Candidato activado."); reload(); }
    catch (e) { toast.error((e as Error).message); }
  }

  const columns: Column<Candidate>[] = [
    { key: "name", header: "Candidato", cell: (c) => (
      <div className="flex items-center gap-3">
        {c.photo_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={c.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" referrerPolicy="no-referrer" />
          : <span className="grid h-9 w-9 place-items-center rounded-full bg-paper-sunken"><UserRound className="h-4 w-4 text-ink-muted" /></span>}
        <div><div className="font-medium">{c.full_name}</div>
          <div className="text-xs text-ink-muted">{c.candidate_number ? `N.º ${c.candidate_number}` : "Sin número"}</div></div>
      </div>
    ) },
    { key: "party", header: "Partido", cell: (c) => (
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-3 rounded-sm" style={{ background: c.political_parties?.color }} aria-hidden />
        {c.political_parties?.acronym}
      </span>
    ) },
    { key: "position", header: "Cargo", hideSm: true, cell: (c) => c.position },
    { key: "active", header: "Estado", cell: (c) => <Pill tone={c.active ? "ok" : "off"}>{c.active ? "Activo" : "Inactivo"}</Pill> },
    { key: "actions", header: <span className="sr-only">Acciones</span>, align: "right", cell: (c) => (
      <div className="flex justify-end gap-1">
        <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setForm({ open: true, item: c })}><Pencil className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" aria-label={c.active ? "Desactivar" : "Activar"} onClick={() => toggle(c)}>
          <Power className={c.active ? "h-4 w-4 text-danger" : "h-4 w-4 text-ok"} />
        </Button>
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Candidatos"
        description={`Los candidatos activos aparecen en el acta de cada mesa. Cargo en disputa: ${election.position}.`}
        actions={<>
          <ImportCsvDialog label="candidatos" columns={["nombre_completo", "sigla_partido", "cargo", "numero"]}
            example={{ nombre_completo: "Juan Pérez", sigla_partido: "MRA", cargo: election.position, numero: "1" }}
            onImport={(r) => importCandidates(election.id, r)} onDone={reload} />
          <Button onClick={() => setForm({ open: true })} disabled={!parties.data?.length}><Plus className="h-4 w-4" />Nuevo candidato</Button>
        </>} />
      <Card>
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar candidato o sigla" />
          <Select aria-label="Partido" className="sm:w-64" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">Todos los partidos</option>
            {parties.data?.map((p) => <option key={p.id} value={p.id}>{p.acronym} · {p.name}</option>)}
          </Select>
        </FilterBar>
        <DataTable columns={columns} rows={rows} loading={loading} error={error} onRetry={reload}
          emptyTitle={parties.data?.length ? "No hay candidatos que coincidan" : "Primero registre los partidos políticos"} />
      </Card>
      <EntityForm open={form.open} onClose={() => setForm({ open: false })} fields={fields}
        title={form.item ? "Editar candidato" : "Nuevo candidato"}
        initial={form.item ? {
          full_name: form.item.full_name, party_id: form.item.party_id, position: form.item.position,
          candidate_number: form.item.candidate_number?.toString() ?? "", photo_url: form.item.photo_url ?? "",
        } : { position: election.position }}
        onSubmit={async (v) => { await saveCandidate(v, form.item?.id); reload(); }} />
    </>
  );
}
