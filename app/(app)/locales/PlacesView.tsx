"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Power } from "lucide-react";
import { useApp } from "@/hooks/useApp";
import { useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
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
import { importPlaces, listPlaces, placeLocations, savePlace, setPlaceActive } from "@/services/places";
import { PAGE_SIZE } from "@/services/base";
import type { PollingPlace } from "@/types";
import { fmtNum } from "@/utils/format";

const FIELDS: FieldDef[] = [
  { name: "code", label: "Código del local", required: true, pattern: /^[A-Za-z0-9_-]{1,20}$/,
    patternMessage: "Solo letras, números, guion y guion bajo (máx. 20).", maxLength: 20 },
  { name: "name", label: "Nombre del local", required: true, maxLength: 200 },
  { name: "address", label: "Dirección", full: true, maxLength: 300 },
  { name: "department", label: "Departamento", required: true, maxLength: 100 },
  { name: "province", label: "Provincia", required: true, maxLength: 100 },
  { name: "district", label: "Distrito", required: true, maxLength: 100 },
  { name: "reference", label: "Referencia", maxLength: 300 },
];

export function PlacesView() {
  const { election } = useApp();
  const [search, setSearch] = useState("");
  const [f, setF] = useState({ department: "", province: "", district: "", active: "all" as "all" | "true" | "false" });
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ open: boolean; item?: PollingPlace }>({ open: false });
  const q = useDebounce(search);
  const eid = election?.id ?? "";

  useEffect(() => setPage(1), [q, f]);
  const { data, loading, error, reload } = useAsync(
    () => (eid ? listPlaces(eid, { ...f, search: q }, page) : Promise.resolve({ rows: [], total: 0 })), [eid, q, f, page]);
  const locs = useAsync(() => (eid ? placeLocations(eid) : Promise.resolve(null)), [eid]);

  if (!election) return <><PageHeader title="Locales de votación" /><NoElection /></>;

  async function toggle(p: PollingPlace) {
    try { await setPlaceActive(p.id, !p.active); toast.success(p.active ? "Local desactivado." : "Local activado."); reload(); }
    catch (e) { toast.error((e as Error).message); }
  }

  const columns: Column<PollingPlace>[] = [
    { key: "code", header: "Código", cell: (p) => <span className="font-medium tabular-nums">{p.code}</span> },
    { key: "name", header: "Local", cell: (p) => (
      <div className="min-w-[180px]"><div className="font-medium">{p.name}</div>
        {p.address && <div className="text-xs text-ink-muted">{p.address}</div>}</div>
    ) },
    { key: "loc", header: "Ubicación", hideSm: true, cell: (p) => (
      <div className="text-xs"><div>{p.district}</div><div className="text-ink-muted">{p.province}, {p.department}</div></div>
    ) },
    { key: "tables", header: "Mesas", align: "right", cell: (p) => <span className="tabular-nums">{fmtNum(p.processed_count)} / {fmtNum(p.table_count)}</span> },
    { key: "voters", header: "Electores", align: "right", hideSm: true, cell: (p) => <span className="tabular-nums">{fmtNum(p.registered_voters)}</span> },
    { key: "active", header: "Estado", cell: (p) => <Pill tone={p.active ? "ok" : "off"}>{p.active ? "Activo" : "Inactivo"}</Pill> },
    { key: "actions", header: <span className="sr-only">Acciones</span>, align: "right", cell: (p) => (
      <div className="flex justify-end gap-1">
        <Button size="icon" variant="ghost" aria-label={`Editar ${p.name}`} onClick={() => setForm({ open: true, item: p })}><Pencil className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" aria-label={p.active ? "Desactivar" : "Activar"} onClick={() => toggle(p)}>
          <Power className={p.active ? "h-4 w-4 text-danger" : "h-4 w-4 text-ok"} />
        </Button>
      </div>
    ) },
  ];

  const opt = (arr?: string[]) => arr?.map((x) => <option key={x} value={x}>{x}</option>);

  return (
    <>
      <PageHeader title="Locales de votación" description="La cantidad de mesas se calcula a partir de las mesas registradas en cada local."
        actions={<>
          <ImportCsvDialog label="locales" columns={["code", "name", "address", "department", "province", "district", "reference"]}
            example={{ code: "L001", name: "I.E. San Martín", address: "Av. Principal 123", department: "Lima", province: "Lima", district: "Lince", reference: "Frente al parque" }}
            onImport={(rows) => importPlaces(election.id, rows)} onDone={() => { reload(); locs.reload(); }} />
          <Button onClick={() => setForm({ open: true })}><Plus className="h-4 w-4" />Nuevo local</Button>
        </>} />
      <Card>
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre, código o dirección" />
          <Select aria-label="Departamento" className="sm:w-44" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}>
            <option value="">Todos los departamentos</option>{opt(locs.data?.departments)}
          </Select>
          <Select aria-label="Provincia" className="sm:w-44" value={f.province} onChange={(e) => setF({ ...f, province: e.target.value })}>
            <option value="">Todas las provincias</option>{opt(locs.data?.provinces)}
          </Select>
          <Select aria-label="Distrito" className="sm:w-44" value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })}>
            <option value="">Todos los distritos</option>{opt(locs.data?.districts)}
          </Select>
          <Select aria-label="Estado" className="sm:w-36" value={f.active} onChange={(e) => setF({ ...f, active: e.target.value as typeof f.active })}>
            <option value="all">Todos</option><option value="true">Activos</option><option value="false">Inactivos</option>
          </Select>
        </FilterBar>
        <DataTable columns={columns} rows={data?.rows ?? []} loading={loading} error={error} onRetry={reload}
          page={page} total={data?.total ?? 0} pageSize={PAGE_SIZE} onPage={setPage}
          emptyTitle="No hay locales que coincidan" emptyDescription="Cree un local o ajuste los filtros de búsqueda." />
      </Card>

      <EntityForm open={form.open} onClose={() => setForm({ open: false })} fields={FIELDS}
        title={form.item ? "Editar local de votación" : "Nuevo local de votación"}
        initial={form.item ? Object.fromEntries(FIELDS.map((x) => [x.name, String((form.item as unknown as Record<string, unknown>)[x.name] ?? "")])) : undefined}
        onSubmit={async (v) => { await savePlace(election.id, v, form.item?.id); reload(); locs.reload(); }} />
    </>
  );
}
