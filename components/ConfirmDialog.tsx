"use client";
import type { ReactNode } from "react";
import { Modal } from "./Modal";
import { Button } from "./ui/button";

export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel = "Confirmar", tone = "primary", loading }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; children?: ReactNode;
  confirmLabel?: string; tone?: "primary" | "danger" | "success"; loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button variant={tone} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </>}>
      <div className="space-y-2 text-sm text-ink-soft">{children}</div>
    </Modal>
  );
}
