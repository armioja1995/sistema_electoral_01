"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Power } from "lucide-react";
import { useApp } from "@/hooks/useApp";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader } from "@/components/PageHeader";
import { NoElection } from "@/components/NoElection";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/DataTable";
import { EntityForm, type FieldDef } from "@/components/EntityForm";
import { ImportCsvDialog } from "@/components/ImportCsvDialog";
import { Pill } from "@/components/StatusBadge";
import { importParties, listParties, saveParty, setPartyActive } from "@/services/parties";
import type { PoliticalParty } from "@/types";

const FIELDS: FieldDef[] = [
  { name: "name", label: "Nombre", required: true, full: true, maxLength: 150 },
  { name: "acronym", label: "Sigla", required: true, maxLength: 20 },
  { name: "list_number", label: "Número de lista", type: "number" },
  { name: "color", label: "Color de identificación", type: "color", pattern: /^#[0-9a-fA-F]{6}$/, patternMessage: "Use formato #RRGGBB." },
  { name: "logo_url", label: "Logo (URL https, opcional)", pattern: /^https:\/\/\S+$/, patternMessage: "Debe ser una URL que empiece con https://", maxLength: 500 },
];

export function PartiesView() {
  const { election } = useApp();
  const eid = election?.id ?? "";
  const { data, loading, error, reload } = useAsync(() => (eid ? listParties(eid) : Promise.resolve([])), [eid]);
  const [form, setForm] = useState<{ open: boolean; item?: PoliticalParty }>({ open: false });

  if (!election) return <><PageHeader title="Partidos políticos" /><NoElection /></>;

  async function toggle(p: PoliticalParty) {
    try { await setPartyActive(p.id, !p.active); toast.success(p.active ? "Partido desactivado." : "Partido activado."); reload(); }
    catch (e) { toast.error((e as Error).message); }
  }

  const columns: Column<PoliticalParty>[] = [
    { key: "num", header: "N.º", cell: (p) => <span className="tabular-nums">{p.list_number ?? "—"}</span> },
    { key: "name", header: "Partido", cell: (p) => (
      <div className="flex items-center gap-3">
        {p.logo_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={p.logo_url} alt="" className="h-8 w-8 rounded object-contain" referrerPolicy="no-referrer" />
          : <span className="h-8 w-8 shrink-0 rounded" style={{ background: p.color }} aria-hidden />}
        <div><div className="font-medium">{p.name}</div><div className="text-xs text-ink-muted">{p.acronym}</div></div>
      </div>
    ) },
    { key: "color", header: "Color", hideSm: true, cell: (p) => <span className="tabular-nums text-xs text-ink-muted">{p.color}</span> },
    { key: "active", header: "Estado", cell: (p) => <Pill tone={p.active ? "ok" : "off"}>{p.active ? "Activo" : "Inactivo"}</Pill> },
    { key: "actions", header: <span className="sr-only">Acciones</span>, align: "right", cell: (p) => (
      <div className="flex justify-end gap-1">
        <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setForm({ open: true, item: p })}><Pencil className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" aria-label={p.active ? "Desactivar" : "Activar"} onClick={() => toggle(p)}>
          <Power className={p.active ? "h-4 w-4 text-danger" : "h-4 w-4 text-ok"} />
        </Button>
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Partidos políticos" description="Organizaciones que participan en el proceso activo."
        actions={<>
          <ImportCsvDialog label="partidos" columns={["nombre", "sigla", "color", "numero_lista"]}
            example={{ nombre: "Movimiento Regional ABC", sigla: "MRA", color: "#2F6DB5", numero_lista: "1" }}
            onImport={(rows) => importParties(election.id, rows)} onDone={reload} />
          <Button onClick={() => setForm({ open: true })}><Plus className="h-4 w-4" />Nuevo partido</Button>
        </>} />
      <Card>
        <DataTable columns={columns} rows={data ?? []} loading={loading} error={error} onRetry={reload}
          emptyTitle="No hay partidos registrados" emptyDescription="Registre los partidos antes de crear candidatos." />
      </Card>
      <EntityForm open={form.open} onClose={() => setForm({ open: false })} fields={FIELDS}
        title={form.item ? "Editar partido" : "Nuevo partido"}
        initial={form.item ? {
          name: form.item.name, acronym: form.item.acronym, color: form.item.color,
          list_number: form.item.list_number?.toString() ?? "", logo_url: form.item.logo_url ?? "",
        } : undefined}
        onSubmit={async (v) => { await saveParty(election.id, v, form.item?.id); reload(); }} />
    </>
  );
}
