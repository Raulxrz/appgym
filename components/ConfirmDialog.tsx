"use client";
import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Confirmación de una acción destructiva. El foco empieza en Cancelar para evitar confirmar sin querer. */
export default function ConfirmDialog({ title, children, confirmLabel, busyLabel, busy, error, onConfirm, onCancel }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="confirm"
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id="confirm-title">{title}</h2>
      <div className="confirm-body">{children}</div>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <div className="confirm-actions">
        <button className="button button-large" onClick={onCancel} disabled={busy} autoFocus>Cancelar</button>
        <button className="button button-large button-danger" onClick={onConfirm} disabled={busy}>{busy ? busyLabel : confirmLabel}</button>
      </div>
    </dialog>
  );
}
