import { requireAccess } from "@/lib/auth";
import { RegistrationList } from "./RegistrationList";

export default async function Page() {
  await requireAccess("registro");
  return <RegistrationList />;
}
