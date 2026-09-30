import { Suspense } from "react";
import { requireAccess } from "@/lib/auth";
import { DashboardView } from "./DashboardView";

export default async function Page() {
  await requireAccess("dashboard");
  return <Suspense><DashboardView /></Suspense>;
}
