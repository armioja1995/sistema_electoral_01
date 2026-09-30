import { db, range, unwrap, PAGE_SIZE } from "./base";
import type { AuditLog, Paged } from "@/types";

export interface AuditFilters { entity?: string; action?: string; userId?: string; entityId?: string }

export async function listAudit(f: AuditFilters, page: number): Promise<Paged<AuditLog>> {
  let q = db().from("v_audit_logs").select("*", { count: "exact" });
  if (f.entity) q = q.eq("entity", f.entity);
  if (f.action) q = q.eq("action", f.action);
  if (f.userId) q = q.eq("user_id", f.userId);
  if (f.entityId) q = q.eq("entity_id", f.entityId);
  const [a, b] = range(page, PAGE_SIZE);
  const res = await q.order("timestamp", { ascending: false }).range(a, b);
  return { rows: unwrap(res) ?? [], total: res.count ?? 0 };
}

/** Historial de una mesa (acta + cambios de estado). */
export async function tableHistory(tableId: string, resultId?: string | null): Promise<AuditLog[]> {
  const ids = [tableId, resultId].filter(Boolean).join(",");
  return unwrap(
    await db().from("v_audit_logs").select("*").in("entity", ["table_results", "polling_tables"])
      .or(`entity_id.in.(${ids})`).order("timestamp", { ascending: false }).limit(50),
  );
}
