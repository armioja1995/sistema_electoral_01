const nf = new Intl.NumberFormat("es-PE");
const pf = new Intl.NumberFormat("es-PE", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pf2 = new Intl.NumberFormat("es-PE", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtNum = (n: number | null | undefined) => (n == null ? "—" : nf.format(n));
export const fmtPct = (ratio: number | null | undefined, precise = false) =>
  ratio == null || !isFinite(ratio) ? "—" : (precise ? pf2 : pf).format(ratio);
export const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}
export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
export const fullName = (p?: { first_name?: string; last_name?: string } | null) =>
  p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() : "";
