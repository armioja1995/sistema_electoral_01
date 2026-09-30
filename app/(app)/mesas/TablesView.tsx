"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ClipboardPen } from "lucide-react";
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
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge, TABLE_STATUS } from "@/components/StatusBadge";
import { deleteTable, importTables, listTables, saveTable } from "@/services/tables";
import { placeOptions } from "@/services/places";
import { listRegistrars } from "@/services/users";
import { PAGE_SIZE } from "@/services/base";
import type { PollingTable, TableStatus } from "@/types";
import { fmtNum, fmtDateTime, fullName } from "@/utils/format";

export function TablesView() {
  const { election } = useApp();
  const eid = election?.id ?? "";
  const [search, setSearch] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [status, setStatus] = useState<TableStatus | "">("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ open: boolean; item?: PollingTable }>({ open: false });
  const [toDelete, setToDelete] = useState<PollingTable | null>(null);
  const [deleting, setDeleting] = useState(false);
  const q = useDebounce(search);

  useEffect(() => setPage(1), [q, placeId, status]);
  const { data, loading, error, reload } = useAsync(
    () => (eid ? listTables(eid, { search: q, placeId, status }, page) : Promise.resolve({ rows: [], total: 0 })),
    [eid, q, placeId, status, page]);
  const places = useAsync(() => (eid ? placeOptions(eid) : Promise.resolve([])), [eid]);
  const users = useAsync(listRegistrars, []);

  const fields: FieldDef[] = useMemo(() => [
    { name: "code", label: "Código / número de mesa", required: true, pattern: /^[A-Za-z0-9_-]{1,20}$/,
      patternMessage: "Solo letras, números, guion y guion bajo (máx. 20).", maxLength: 20, placeholder: "001" },
    { name: "polling_place_id", label: "Local de votación", type: "select", required: true,
      options: (places.data ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })) },
    { name: "registered_voters", label: "Electores habilitados", type: "number", required: true,
      hint: "Población electoral de la mesa. No puede cambiarse con el acta cerrada." },
    { name: "assigned_to", label: "Registrador asignado", type: "select",
      options: (users.data ?? []).map((u) => ({ value: u.id, label: fullName(u) || u.email })) },
  ], [places.data, users.data]);

  if (!election) return <><PageHeader title="Mesas" /><NoElection /></>;

  const columns: Column<PollingTable>[] = [
    { key: "code", header: "Mesa", cell: (t) => <span className="font-semibold tabular-nums">{t.code}</span> },
    { key: "place", header: "Local", cell: (t) => (
      <div className="min-w-[160px]"><div>{t.place_name}</div><div className="text-xs text-ink-muted">{t.place_code} · {t.district}</div></div>
    ) },
    { key: "voters", header: "Electores", align: "right", cell: (t) => <span className="tabular-nums">{fmtNum(t.registered_voters)}</span> },
    { key: "status", header: "Estado", cell: (t) => <StatusBadge status={t.status} /> },
    { key: "assigned", header: "Registrador", hideSm: true, cell: (t) => t.assigned_name ?? <span className="text-ink-muted">Sin asignar</span> },
    { key: "reg", header: "Último registro", hideSm: true, cell: (t) => t.registered_at ? (
      <div className="text-xs"><div className="tabular-nums">{fmtDateTime(t.result_updated_at ?? t.registered_at)}</div>
        <div className="text-ink-muted">{t.updated_by_name ?? t.registered_by_name}</div></div>
    ) : <span className="text-ink-muted">—</span> },
    { key: "actions", header: <span className="sr-only">Acciones</span>, align: "right", cell: (t) => (
      <div className="flex justify-end gap-1">
        <Link href={`/registro/${t.id}`}><Button size="icon" variant="ghost" aria-label={`Registrar mesa ${t.code}`}><ClipboardPen className="h-4 w-4" /></Button></Link>
        <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setForm({ open: true, item: t })}><Pencil className="h-4 w-4" /></Button>
        {!t.result_id && <Button size="icon" variant="ghost" aria-label="Eliminar" onClick={() => setToDelete(t)}><Trash2 className="h-4 w-4 text-danger" /></Button>}
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Mesas de votación" description="Registre las mesas, su población electoral y el registrador responsable."
        actions={<>
          <ImportCsvDialog label="mesas" columns={["codigo_mesa", "codigo_local", "electores_habilitados"]}
            example={{ codigo_mesa: "000123", codigo_local: "L001", electores_habilitados: "300" }}
            onImport={(rows) => importTables(election.id, rows)} onDone={reload} />
          <Button onClick={() => setForm({ open: true })} disabled={!places.data?.length}><Plus className="h-4 w-4" />Nueva mesa</Button>
        </>} />
      <Card>
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por código de mesa o local" />
          <Select aria-label="Local" className="sm:w-64" value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
            <option value="">Todos los locales</option>
            {places.data?.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </Select>
          <Select aria-label="Estado" className="sm:w-44" value={status} onChange={(e) => setStatus(e.target.value as TableStatus | "")}>
            <option value="">Todos los estados</option>
            {Object.entries(TABLE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </FilterBar>
        <DataTable columns={columns} rows={data?.rows ?? []} loading={loading} error={error} onRetry={reload}
          page={page} total={data?.total ?? 0} pageSize={PAGE_SIZE} onPage={setPage}
          emptyTitle={places.data?.length ? "No hay mesas que coincidan" : "Primero registre un local de votación"}
          emptyDescription="Cree mesas individualmente o impórtelas desde un CSV." />
      </Card>

      <EntityForm open={form.open} onClose={() => setForm({ open: false })} fields={fields}
        title={form.item ? `Editar mesa ${form.item.code}` : "Nueva mesa"}
        initial={form.item ? {
          code: form.item.code, polling_place_id: form.item.polling_place_id,
          registered_voters: String(form.item.registered_voters), assigned_to: form.item.assigned_to ?? "",
        } : placeId ? { polling_place_id: placeId } : undefined}
        onSubmit={async (v) => {
          await saveTable({ code: v.code, polling_place_id: v.polling_place_id, registered_voters: v.registered_voters, assigned_to: v.assigned_to }, form.item?.id);
          reload();
        }} />

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} tone="danger" confirmLabel="Eliminar" loading={deleting}
        title={`Eliminar mesa ${toDelete?.code ?? ""}`}
        onConfirm={async () => {
          if (!toDelete) return;
          setDeleting(true);
          try { await deleteTable(toDelete.id); toast.success("Mesa eliminada."); setToDelete(null); reload(); }
          catch (e) { toast.error((e as Error).message); }
          finally { setDeleting(false); }
        }}>
        <p>La mesa no tiene acta registrada. Esta acción no se puede deshacer.</p>
      </ConfirmDialog>
    </>
  );
}
