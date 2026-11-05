"use client";
import { useState } from "react";
import { TEMPLATES } from "@/lib/templates";
import { XLSX_MIME_TYPE, openDrivePicker, pickerConfigured } from "@/lib/picker";

type Props = {
  onAdded: (fileId: string) => void;
  onExpired: () => void;
};

export default function AddRoutine({ onAdded, onExpired }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = async (template: string) => {
    setBusy(template);
    setError(null);
    try {
      const res = await fetch("/api/routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      const body = await res.json();
      if (res.status === 401) return onExpired();
      if (!res.ok) throw new Error(body.error);
      onAdded(body.file.id);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "No se ha podido crear la rutina");
    } finally {
      setBusy(null);
    }
  };

  const pick = async () => {
    setBusy("picker");
    setError(null);
    try {
      const fileId = await openDrivePicker(XLSX_MIME_TYPE);
      if (fileId) onAdded(fileId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido abrir Google Drive");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="add-routine">
      <section>
        <h3>Usar un Excel de tu Drive</h3>
        <p className="muted">Debe tener el mismo formato: días, microciclos y descarga en columnas.</p>
        <button className="button" onClick={pick} disabled={!!busy || !pickerConfigured}>
          {busy === "picker" ? "Abriendo…" : "Elegir de Drive"}
        </button>
        {!pickerConfigured && <p className="fineprint">El selector de Drive aún no está configurado en esta instalación.</p>}
      </section>
      <section>
        <h3>Crear una copia vacía</h3>
        <p className="muted">Se crea un Excel nuevo en tu Drive a partir de una de estas rutinas.</p>
        <div className="template-list">
          {TEMPLATES.map((t) => (
            <button key={t.id} className="template" onClick={() => create(t.id)} disabled={!!busy}>
              <strong>{busy === t.id ? "Creando…" : t.title}</strong>
              <span className="muted">{t.detail}</span>
            </button>
          ))}
        </div>
      </section>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
    </div>
  );
}
