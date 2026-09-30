"use client";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "./ui/button";
import { EmptyState, ErrorState, LoadingState } from "./States";
import { fmtNum } from "@/utils/format";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Oculta la columna en pantallas pequeñas */
  hideSm?: boolean;
  align?: "left" | "right" | "center";
}

export function DataTable<T extends { id: string | number }>({
  columns, rows, loading, error, onRetry, emptyTitle = "Sin registros", emptyDescription, emptyAction,
  page, total, pageSize, onPage, onRowClick,
}: {
  columns: Column<T>[]; rows: T[]; loading?: boolean; error?: string | null; onRetry?: () => void;
  emptyTitle?: string; emptyDescription?: string; emptyAction?: ReactNode;
  page?: number; total?: number; pageSize?: number; onPage?: (p: number) => void; onRowClick?: (row: T) => void;
}) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading && rows.length === 0) return <LoadingState />;
  if (!loading && rows.length === 0)
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;

  const pages = total && pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const alignCls = (a?: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");

  return (
    <div className={cn(loading && "opacity-60 transition-opacity")}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-xs text-ink-muted">
              {columns.map((c) => (
                <th key={c.key} scope="col"
                  className={cn("whitespace-nowrap px-4 py-2.5 font-medium", alignCls(c.align), c.hideSm && "hidden md:table-cell", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cn("border-b border-line/70 last:border-0", onRowClick && "cursor-pointer hover:bg-brand-soft/40")}>
                {columns.map((c) => (
                  <td key={c.key}
                    className={cn("px-4 py-2.5 align-middle text-ink", alignCls(c.align), c.hideSm && "hidden md:table-cell", c.className)}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {onPage && total !== undefined && pageSize && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-sm text-ink-muted">
          <span className="tabular-nums">
            {fmtNum(Math.min(total, ((page ?? 1) - 1) * pageSize + 1))}–{fmtNum(Math.min(total, (page ?? 1) * pageSize))} de {fmtNum(total)}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Página anterior" disabled={(page ?? 1) <= 1} onClick={() => onPage((page ?? 1) - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="tabular-nums">{page} / {pages}</span>
            <Button variant="ghost" size="icon" aria-label="Página siguiente" disabled={(page ?? 1) >= pages} onClick={() => onPage((page ?? 1) + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
