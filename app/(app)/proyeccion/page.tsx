import { requireAccess } from "@/lib/auth";
import { ProjectionView } from "./ProjectionView";

export default async function Page() {
  await requireAccess("proyeccion");
  return <ProjectionView />;
}
