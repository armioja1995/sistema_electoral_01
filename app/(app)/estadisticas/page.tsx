import { requireAccess } from "@/lib/auth";
import { StatsView } from "./StatsView";

export default async function Page() {
  await requireAccess("estadisticas");
  return <StatsView />;
}
