import { requireAccess } from "@/lib/auth";
import { CandidatesView } from "./CandidatesView";

export default async function Page() {
  await requireAccess("candidatos");
  return <CandidatesView />;
}
