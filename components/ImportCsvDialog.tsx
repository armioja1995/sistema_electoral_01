"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./ui/button";
import { parseCsv, downloadCsv } from "@/utils/csv";

/** Importación CSV genérica: valida columnas y delega el guardado. */
export function ImportCsvDialog({ label, columns, example, onImport, onDone }: {
  label: string; columns: string[]; example: Record<string, string>;
  onImport: (rows: Record<string, string>[]) => Promise<number>; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("El archivo supera 5 MB.");
      const rows = await parseCsv(file);
      if (rows.length === 0) throw new Error("El archivo no tiene filas.");
      const missing = columns.filter((c) => !(c in rows[0]));
      if (missing.length) throw new Error(`Faltan columnas: ${missing.join(", ")}.`);
      const n = await onImport(rows);
      toast.success(`${n} registros importados.`);
      setOpen(false); setFile(null); onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}><Upload className="h-4 w-4" />Importar CSV</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Importar ${label}`}
        description="Archivo CSV con encabezados en la primera fila, separado por comas."
        footer={<>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={run} loading={busy} disabled={!file}>Importar</Button>
        </>}>
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium text-ink">Columnas requeridas</p>
            <p className="mt-1 break-words rounded bg-paper-sunken px-2 py-1.5 font-medium text-ink-soft">{columns.join(", ")}</p>
            <button type="button" className="mt-2 text-brand underline-offset-2 hover:underline"
              onClick={() => downloadCsv(`plantilla_${label.toLowerCase().replace(/\s+/g, "_")}.csv`, [example])}>
              Descargar plantilla de ejemplo
            </button>
          </div>
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-medium file:text-brand" />
          {error && <p className="whitespace-pre-line rounded-md bg-danger-soft px-3 py-2 text-danger" role="alert">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
