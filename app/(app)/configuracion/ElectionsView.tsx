"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CheckCircle2, FlaskConical } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/DataTable";
import { EntityForm, type FieldDef } from "@/components/EntityForm";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ElectionStatusBadge, Pill } from "@/components/StatusBadge";
import { useAsync } from "@/hooks/useAsync";
import { deleteDemo, deleteElection, listElections, saveElection, seedDemo, setActiveElection } from "@/services/elections";
import type { Election, ElectionStatus } from "@/types";
import { fmtDate } from "@/utils/format";

const FIELDS: FieldDef[] = [
  { name: "name", label: "Nombre del proceso electoral", required: true, full: true, placeholder: "Elecciones Municipales 2026", maxLength: 150 },
  { name: "election_date", label: "Fecha de elección", type: "date", required: true },
  { name: "position", label: "Cargo en disputa", required: true, placeholder: "Alcalde", maxLength: 100,
    hint: "Cada proceso registra una contienda. Para otro cargo, cree otro proceso." },
  { name: "status", label: "Estado", type: "select", required: true, options: [
    { value: "configuracion", label: "Configuración" },
    { value: "en_proceso", label: "En proceso (habilita el registro de actas)" },
    { value: "finalizado", label: "Finalizado (bloquea cambios)" },
  ] },
  { name: "description", label: "Descripción", type: "textarea", maxLength: 1000 },
];

export function ElectionsView() {
  const router = useRouter();
  const { data, loading, error, reload } = useAsync(listElections, []);
  const [form, setForm] = useState<{ open: boolean; item?: Election }>({ open: false });
  const [toDelete, setToDelete] = useState<Election | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const hasDemo = data?.some((e) => e.is_demo);

  const refresh = () => { reload(); router.refresh(); };

  async function act(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try { await fn(); toast.success(ok); refresh(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }

  const columns: Column<Election>[] = [
    { key: "name", header: "Proceso electoral", cell: (e) => (
      <div className="min-w-[200px]">
        <div className="flex flex-wrap items-center gap-2 font-medium">
          {e.name}
          {e.is_active && <Pill tone="ok">Activa</Pill>}
          {e.is_demo && <Pill tone="demo">DATOS DEMO</Pill>}
        </div>
        {e.description && <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">{e.description}</p>}
      </div>
    ) },
    { key: "position", header: "Cargo", cell: (e) => e.position, hideSm: true },
    { key: "date", header: "Fecha", cell: (e) => <span className="tabular-nums">{fmtDate(e.election_date)}</span> },
    { key: "status", header: "Estado", cell: (e) => <ElectionStatusBadge status={e.status} /> },
    { key: "actions", header: <span className="sr-only">Acciones</span>, align: "right", cell: (e) => (
      <div className="flex justify-end gap-1">
        {!e.is_active && (
          <Button size="sm" variant="secondary" loading={busy === `act-${e.id}`}
            onClick={() => act(`act-${e.id}`, () => setActiveElection(e.id), "Elección activada.")}>
            <CheckCircle2 className="h-4 w-4" />Activar
          </Button>
        )}
        <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setForm({ open: true, item: e })}><Pencil className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" aria-label="Eliminar" onClick={() => setToDelete(e)}><Trash2 className="h-4 w-4 text-danger" /></Button>
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Configuración electoral"
        description="Defina el proceso electoral. Solo la elección activa se muestra en el resto del sistema."
        actions={<Button onClick={() => setForm({ open: true })}><Plus className="h-4 w-4" />Nuevo proceso</Button>} />

      <Card>
        <DataTable columns={columns} rows={data ?? []} loading={loading} error={error} onRetry={reload}
          emptyTitle="Aún no hay procesos electorales"
          emptyDescription="Cree un proceso nuevo o cargue los datos demo para probar el sistema." />
      </Card>

      <Card className="mt-4">
        <CardHeader title="Datos de demostración"
          description="Crea un proceso marcado como DATOS DEMO con 5 locales, 20 mesas, 3 partidos y 3 candidatos. Las mesas quedan asignadas a su usuario." />
        <div className="flex flex-wrap items-center gap-2 p-4">
          {!hasDemo ? (
            <>
              <Button variant="secondary" loading={busy === "demo"} onClick={() => act("demo", () => seedDemo(true), "Datos demo creados.")}>
                <FlaskConical className="h-4 w-4" />Crear datos demo con 8 actas registradas
              </Button>
              <Button variant="ghost" loading={busy === "demo0"} onClick={() => act("demo0", () => seedDemo(false), "Datos demo creados.")}>
                Crear sin actas
              </Button>
            </>
          ) : (
            <Button variant="danger" loading={busy === "deldemo"} onClick={() => act("deldemo", deleteDemo, "Datos demo eliminados.")}>
              <Trash2 className="h-4 w-4" />Eliminar datos demo
            </Button>
          )}
        </div>
      </Card>

      <EntityForm open={form.open} onClose={() => setForm({ open: false })}
        title={form.item ? "Editar proceso electoral" : "Nuevo proceso electoral"} fields={FIELDS}
        initial={form.item ? {
          name: form.item.name, election_date: form.item.election_date, position: form.item.position,
          status: form.item.status, description: form.item.description ?? "",
        } : { status: "configuracion", position: "Alcalde" }}
        onSubmit={async (v) => {
          await saveElection({ name: v.name, description: v.description, election_date: v.election_date,
            position: v.position, status: v.status as ElectionStatus }, form.item?.id);
          refresh();
        }} />

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} tone="danger" confirmLabel="Eliminar"
        title="Eliminar proceso electoral" loading={busy === "del"}
        onConfirm={() => toDelete && act("del", () => deleteElection(toDelete.id), "Proceso eliminado.").then(() => setToDelete(null))}>
        <p>Se eliminarán <strong>{toDelete?.name}</strong> y todos sus locales, mesas, partidos y candidatos.</p>
        <p>Si ya existen votos registrados la operación será rechazada para proteger los resultados.</p>
      </ConfirmDialog>
    </>
  );
}
