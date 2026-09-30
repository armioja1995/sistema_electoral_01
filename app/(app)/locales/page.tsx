import { requireAccess } from "@/lib/auth";
import { PlacesView } from "./PlacesView";

export default async function Page() {
  await requireAccess("locales");
  return <PlacesView />;
}
