import { requireAccess } from "@/lib/auth";
import { ElectionsView } from "./ElectionsView";

export default async function Page() {
  await requireAccess("configuracion");
  return <ElectionsView />;
}
