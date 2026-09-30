import { requireAccess } from "@/lib/auth";
import { PartiesView } from "./PartiesView";

export default async function Page() {
  await requireAccess("partidos");
  return <PartiesView />;
}
