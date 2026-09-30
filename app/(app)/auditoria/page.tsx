import { requireAccess } from "@/lib/auth";
import { AuditView } from "./AuditView";

export default async function Page() {
  await requireAccess("auditoria");
  return <AuditView />;
}
