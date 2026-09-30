"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "./Modal";
import { Button } from "./ui/button";
import { Field, Input, Select, Textarea } from "./ui/field";
import { cn } from "@/utils/cn";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea" | "color" | "date" | "email" | "password";
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  pattern?: RegExp;
  patternMessage?: string;
  maxLength?: number;
  full?: boolean;
  disabled?: boolean;
}

type Values = Record<string, string>;

/** Formulario modal genérico con validación en cliente (el servidor valida de nuevo). */
export function EntityForm({ open, onClose, title, description, fields, initial, onSubmit, submitLabel = "Guardar" }: {
  open: boolean; onClose: () => void; title: string; description?: string;
  fields: FieldDef[]; initial?: Values; onSubmit: (v: Values) => Promise<void>; submitLabel?: string;
}) {
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(Object.fromEntries(fields.map((f) => [f.name, initial?.[f.name] ?? (f.type === "color" ? "#64748B" : "")])));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    for (const f of fields) {
      const v = (values[f.name] ?? "").trim();
      if (f.required && !v) e[f.name] = "Campo obligatorio.";
      else if (v && f.type === "number" && !/^\d+$/.test(v)) e[f.name] = "Ingrese un número entero no negativo.";
      else if (v && f.pattern && !f.pattern.test(v)) e[f.name] = f.patternMessage ?? "Formato inválido.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSubmit(values);
      toast.success("Cambios guardados.");
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title={title} description={description}
      footer={<>
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" form="entity-form" loading={saving}>{submitLabel}</Button>
      </>}>
      <form id="entity-form" onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => {
          const id = `f-${f.name}`;
          const common = {
            id, name: f.name, value: values[f.name] ?? "", disabled: f.disabled,
            "aria-invalid": !!errors[f.name] || undefined,
          };
          return (
            <Field key={f.name} label={f.label} htmlFor={id} required={f.required} hint={f.hint} error={errors[f.name]}
              className={cn((f.full || f.type === "textarea") && "sm:col-span-2")}>
              {f.type === "select" ? (
                <Select {...common} onChange={(e) => set(f.name, e.target.value)}>
                  <option value="">Seleccione…</option>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              ) : f.type === "textarea" ? (
                <Textarea {...common} maxLength={f.maxLength ?? 1000} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} />
              ) : f.type === "color" ? (
                <div className="flex gap-2">
                  <input type="color" aria-label={f.label} value={values[f.name] || "#64748B"} onChange={(e) => set(f.name, e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded border border-line bg-paper-raised p-1" />
                  <Input {...common} maxLength={7} onChange={(e) => set(f.name, e.target.value)} />
                </div>
              ) : (
                <Input {...common}
                  type={f.type === "number" ? "text" : f.type ?? "text"}
                  inputMode={f.type === "number" ? "numeric" : undefined}
                  maxLength={f.maxLength ?? 200} placeholder={f.placeholder}
                  onChange={(e) => set(f.name, e.target.value)} />
              )}
            </Field>
          );
        })}
      </form>
    </Modal>
  );
}
