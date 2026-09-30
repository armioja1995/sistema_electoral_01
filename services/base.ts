import { getSupabase } from "@/lib/supabase/client";
import { friendlyError } from "@/utils/errors";

export const db = () => getSupabase();

export const PAGE_SIZE = 25;
export const range = (page: number, size = PAGE_SIZE) => [(page - 1) * size, page * size - 1] as const;

/** Lanza un Error con mensaje amigable si la respuesta de Supabase trae error. */
export function unwrap<T>(res: { data: T | null; error: unknown; count?: number | null }): T {
  if (res.error) throw new Error(friendlyError(res.error));
  return res.data as T;
}
