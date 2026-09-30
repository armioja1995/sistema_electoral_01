"use client";
import { forwardRef } from "react";
import { cn } from "@/utils/cn";

/**
 * Campo numérico para votos: solo dígitos, teclado numérico en móvil,
 * selección completa al enfocar y Enter para pasar al siguiente campo.
 */
export const CandidateVoteInput = forwardRef<HTMLInputElement, {
  id: string; value: string; onChange: (v: string) => void; label: string;
  invalid?: boolean; disabled?: boolean; onEnter?: () => void; className?: string;
}>(({ id, value, onChange, label, invalid, disabled, onEnter, className }, ref) => (
  <input
    ref={ref}
    id={id}
    aria-label={label}
    aria-invalid={invalid || undefined}
    inputMode="numeric"
    pattern="[0-9]*"
    autoComplete="off"
    maxLength={6}
    disabled={disabled}
    value={value}
    placeholder="0"
    onFocus={(e) => e.currentTarget.select()}
    onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter?.(); } }}
    className={cn(
      "h-11 w-full rounded-md border border-line bg-paper-raised px-3 text-right text-lg font-semibold tabular-nums text-ink",
      "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25",
      "disabled:bg-paper-sunken disabled:text-ink-muted",
      invalid && "border-danger ring-2 ring-danger/15",
      className,
    )}
  />
));
CandidateVoteInput.displayName = "CandidateVoteInput";
