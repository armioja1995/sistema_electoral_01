import { requireAccess } from "@/lib/auth";
import { TablesView } from "./TablesView";

export default async function Page() {
  await requireAccess("mesas");
  return <TablesView />;
}
