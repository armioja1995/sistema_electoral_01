import Papa from "papaparse";

/** Evita inyección de fórmulas al abrir el CSV en Excel/Sheets. */
function safeCell(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const clean = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safeCell(v)])));
  // Unión de columnas: filas sin votos (mesas pendientes) no deben ocultar columnas de candidatos
  const fields: string[] = [];
  for (const r of clean) for (const k of Object.keys(r)) if (!fields.includes(k)) fields.push(k);
  const csv = Papa.unparse({ fields, data: clean.map((r) => fields.map((f) => r[f] ?? "")) });
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseCsv(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => resolve(res.data),
      error: reject,
    });
  });
}
