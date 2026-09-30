import { requireAccess } from "@/lib/auth";
import { TallyForm } from "./TallyForm";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAccess("registro");
  const { id } = await params;
  const valid = /^[0-9a-f-]{36}$/i.test(id);
  return <TallyForm tableId={valid ? id : null} />;
}
