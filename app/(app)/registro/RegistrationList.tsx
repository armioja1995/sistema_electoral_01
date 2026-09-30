"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useApp } from "@/hooks/useApp";
import { useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
import { useRealtimeRefresh } from "@/hooks/useRealtimeStats";
import { PageHeader } from "@/components/PageHeader";
import { NoElection } from "@/components/NoElection";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/DataTable";
import { FilterBar, SearchInput } from "@/components/FilterBar";
import { StatusBadge, TABLE_STATUS } from "@/components/StatusBadge";
import { LiveIndicator } from "@/components/LiveIndicator";
import { listTables } from "@/services/tables";
import { placeOptions } from "@/services/places";
import { PAGE_SIZE } from "@/services/base";
import type { PollingTable, TableStatus } from "@/types";
import { fmtNum } from "@/utils/format";

export function RegistrationList() {
  const { election, profile, isAdmin } = useApp();
  const router = useRouter();
  const eid = election?.id ?? "";
  const [search, setSearch] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [status, setStatus] = useState<TableStatus | "">("");
  const [page, setPage] = useState(1);
  const q = useDebounce(search, 250);
  const assignedTo = isAdmin ? undefined : profile.id;

  useEffect(() => setPage(1), [q, placeId, status]);
  const { data, loading, error, reload } = useAsync(
    () => (eid ? listTables(eid, { search: q, placeId, status, assignedTo }, page) : Promise.resolve({ rows: [], total: 0 })),
    [eid, q, placeId, status, page, assignedTo]);
  const places = useAsync(() => (eid ? placeOptions(eid) : Promise.resolve([])), [eid]);
  const live = useRealtimeRefresh(eid || undefined, reload, 600);

  if (!election) return <><PageHeader title="Registro de resultados" /><NoElection /></>;

  const columns: Column<PollingTable>[] = [
    { key: "code", header: "Mesa", cell: (t) => <span className="text-base font-semibold tabular-nums">{t.code}</span> },
    { key: "place", header: "Local", cell: (t) => (
      <div className="min-w-[150px]"><div>{t.place_name}</div><div className="text-xs text-ink-muted">{t.district}</div></div>
    ) },
    { key: "voters", header: "Electores", align: "right", hideSm: true, cell: (t) => <span className="tabular-nums">{fmtNum(t.registered_voters)}</span> },
    { key: "status", header: "Estado", cell: (t) => <StatusBadge status={t.status} /> },
    { key: "go", header: <span className="sr-only">Abrir</span>, align: "right", cell: () => <ChevronRight className="ml-auto h-4 w-4 text-ink-muted" /> },
  ];

  return (
    <>
      <PageHeader title="Registro de resultados"
        description={<>
          {isAdmin ? "Todas las mesas del proceso activo." : "Mesas asignadas a su usuario."}{" "}
          <LiveIndicator status={live.status} />
        </>} />
      {election.status !== "en_proceso" && (
        <p className="mb-4 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          El proceso está en estado «{election.status === "finalizado" ? "Finalizado" : "Configuración"}».
          {election.status === "finalizado" ? " No se admiten cambios." : " Los registradores podrán ingresar actas cuando pase a «En proceso»."}
        </p>
      )}
      <Card>
        <FilterBar>
          <div onKeyDown={(e) => {
            if (e.key === "Enter" && data?.rows.length === 1) router.push(`/registro/${data.rows[0].id}`);
          }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Código de mesa o nombre del local" />
          </div>
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
          onRowClick={(t) => router.push(`/registro/${t.id}`)}
          emptyTitle={isAdmin ? "No hay mesas que coincidan" : "No tiene mesas asignadas"}
          emptyDescription={isAdmin ? undefined : "Solicite a un administrador que le asigne mesas."} />
      </Card>
    </>
  );
}
