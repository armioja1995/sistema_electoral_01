import { requireAccess } from "@/lib/auth";
import { UsersView } from "./UsersView";

export default async function Page() {
  const me = await requireAccess("usuarios");
  return <UsersView canCreate={!!process.env.SUPABASE_SERVICE_ROLE_KEY} meId={me.id} />;
}
