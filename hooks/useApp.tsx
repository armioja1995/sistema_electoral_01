"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Election, Profile } from "@/types";

interface AppCtx { profile: Profile; election: Election | null }
const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ value, children }: { value: AppCtx; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp debe usarse dentro de AppProvider");
  return { ...v, isAdmin: v.profile.role === "administrador" };
}
