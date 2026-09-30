"use client";
import { useState } from "react";
import { Eye } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/DataTable";
import { FilterBar } from "@/components/FilterBar";
import { Modal } from "@/components/Modal";
import { listAudit } from "@/services/audit";
import { PAGE_SIZE } from "@/services/base";
import { fmtDateTime } from "@/utils/format";
import type { AuditLog } from "@/types";

export const ENTITY_LABELS: Record<string, string> = {
  table_results: "Acta de mesa",
  polling_tables: "Mesa",
  polling_places: "Local de votación",
  political_parties: "Partido político",
  candidates: "Candidato",
  elections: "Proceso electoral",
  profiles: "Usuario",
};

export const ACTION_LABELS: Record<string, string> = {
  crear: "Creación",
  modificar: "Modificación",
  eliminar: "Eliminación",
  guardar_borrador: "Borrador de acta",
  registrar_acta: "Registro de acta",
  registrar_acta_observada: "Acta registrada como observada",
  modificar_acta: "Modificación de acta",
  cambiar_estado: "Cambio de estado",
  crear_datos_demo: "Creación de datos demo",
  eliminar_datos_demo: "Eliminación de datos demo",
  crear_usuario: "Creación de usuario",
  restablecer_contrasena: "Restablecimiento de contraseña",
};

/** Resumen legible de los detalles más relevantes. */
function summary(l: AuditLog): string {
  const d = l.details ?? {};
  const g = (k: string) => (d as Record<string, unknown>)[k];
  if (l.entity === "table_results" && g("mesa")) {
    const parts = [`Mesa ${g("mesa")}`];
    const nuevo = g("nuevo") as Record<string, unknown> | undefined;
    if (nuevo?.votos_emitidos != null) parts.push(`${nuevo.votos_emitidos} emitidos`);
    if (g("estado")) parts.push(`estado: ${g("estado")}`);
    return parts.join(" · ");
  }
  if (l.action === "cambiar_estado") {
    return [g("mesa") && `Mesa ${g("mesa")}`, g("antes") && `${g("antes")} → ${g("despues")}`, g("nota") && `“${g("nota")}”`]
      .filter(Boolean).join(" · ");
  }
  const cambios = g("cambios");
  if (cambios && typeof cambios === "object") return `Campos: ${Object.keys(cambios).join(", ")}`;
  const datos = g("datos") as Record<string, unknown> | undefined;
  if (datos) return String(datos.name ?? datos.full_name ?? datos.code ?? datos.email ?? "");
  if (g("email")) return String(g("email"));
  return "";
}

export function AuditView() {
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AuditLog | null>(null);
  const { data, loading, error, reload } = useAsync(() => listAudit({ entity, action }, page), [entity, action, page]);

  const columns: Column<AuditLog>[] = [
    { key: "ts", header: "Fecha y hora", cell: (l) => <span className="whitespace-nowrap tabular-nums">{fmtDateTime(l.timestamp)}</span> },
    { key: "user", header: "Usuario", cell: (l) => (
      <div><div>{l.user_name || l.user_email || "Sistema"}</div>
        {l.user_name && <div className="text-xs text-ink-muted">{l.user_email}</div>}</div>
    ) },
    { key: "action", header: "Acción", cell: (l) => ACTION_LABELS[l.action] ?? l.action },
    { key: "entity", header: "Entidad", hideSm: true, cell: (l) => ENTITY_LABELS[l.entity] ?? l.entity },
    { key: "sum", header: "Detalle", hideSm: true, cell: (l) => <span className="line-clamp-1 text-ink-soft">{summary(l)}</span> },
    { key: "view", header: <span className="sr-only">Ver</span>, align: "right", cell: (l) => (
      <Button size="icon" variant="ghost" aria-label="Ver detalle" onClick={(e) => { e.stopPropagation(); setDetail(l); }}>
        <Eye className="h-4 w-4" />
      </Button>
    ) },
  ];

  return (
    <>
      <PageHeader title="Auditoría" description="Registro inalterable de quién creó, registró o modificó información." />
      <Card>
        <FilterBar>
          <Select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} className="sm:w-56" aria-label="Filtrar por entidad">
            <option value="">Todas las entidades</option>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="sm:w-64" aria-label="Filtrar por acción">
            <option value="">Todas las acciones</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </FilterBar>
        <DataTable columns={columns} rows={data?.rows ?? []} loading={loading} error={error} onRetry={reload}
          emptyTitle="Sin eventos registrados" emptyDescription="Aquí aparecerán las operaciones realizadas en el sistema."
          page={page} total={data?.total ?? 0} pageSize={PAGE_SIZE} onPage={setPage} onRowClick={setDetail} />
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} size="lg"
        title={detail ? ACTION_LABELS[detail.action] ?? detail.action : ""}
        description={detail ? `${ENTITY_LABELS[detail.entity] ?? detail.entity} · ${fmtDateTime(detail.timestamp)}` : undefined}>
        {detail && (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1">
              <dt className="text-ink-muted">Usuario</dt><dd>{detail.user_name || "—"} {detail.user_email && `(${detail.user_email})`}</dd>
              <dt className="text-ink-muted">ID de entidad</dt><dd className="break-all font-mono text-xs">{detail.entity_id ?? "—"}</dd>
              <dt className="text-ink-muted">N.º de evento</dt><dd className="tabular-nums">{detail.id}</dd>
            </dl>
            <pre className="max-h-[50vh] overflow-auto rounded-md border border-line bg-paper p-3 text-xs leading-relaxed">
              {JSON.stringify(detail.details, null, 2)}
            </pre>
          </div>
        )}
      </Modal>
    </>
  );
}
