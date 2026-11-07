"use client";
// Guardado automático: agrupa los cambios, reintenta si falla y los conserva en el navegador hasta subirlos.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Routine } from "./routine";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "retrying" | "expired";

const DEBOUNCE_MS = 1500;
const storageKey = (fileId: string) => `asymettry.pending.${fileId}`;
// Clave anterior al cambio de nombre: se lee una vez para no perder cambios sin subir.
const legacyKey = (fileId: string) => `appgym.pending.${fileId}`;

export function readPending(fileId: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(storageKey(fileId)) ?? localStorage.getItem(legacyKey(fileId)) ?? "{}");
  } catch {
    return {};
  }
}

function writePending(fileId: string, pending: Record<string, string>) {
  try {
    localStorage.removeItem(legacyKey(fileId));
    if (Object.keys(pending).length) localStorage.setItem(storageKey(fileId), JSON.stringify(pending));
    else localStorage.removeItem(storageKey(fileId));
  } catch {
    // Sin almacenamiento local se sigue guardando en Drive; solo se pierde la copia de seguridad.
  }
}

export function useSaver(fileId: string | null, onSaved: (routine: Routine) => void) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const pending = useRef<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const busy = useRef(false);
  const failures = useRef(0);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const activeFile = useRef(fileId);
  activeFile.current = fileId;

  const flush = useCallback(async () => {
    if (!fileId || busy.current || !Object.keys(pending.current).length) return;
    clearTimeout(timer.current);
    busy.current = true;
    const sending = pending.current;
    pending.current = {};
    setStatus("saving");
    let retryIn: number | null = null;
    // Si se cambia de rutina con la subida en curso, el resultado no debe tocar la pantalla actual.
    const stillActive = () => activeFile.current === fileId;
    const keepForLater = () => {
      if (stillActive()) pending.current = { ...sending, ...pending.current };
      else writePending(fileId, { ...readPending(fileId), ...sending });
    };
    try {
      const res = await fetch(`/api/routines/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: sending }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        keepForLater();
        if (stillActive()) {
          if (res.status === 401) setStatus("expired");
          else {
            setMessage(body.error ?? null);
            // Un error definitivo no se arregla reintentando: se avisa y se espera a la siguiente acción.
            if ([409, 429, 500, 502, 503, 504].includes(res.status)) retryIn = Math.min(5000 * 2 ** failures.current++, 60000);
            setStatus("retrying");
          }
        }
      } else if (stillActive()) {
        failures.current = 0;
        setMessage(null);
        setSavedAt(new Date());
        setStatus(Object.keys(pending.current).length ? "pending" : "saved");
        onSavedRef.current(body.routine);
      } else {
        const left = readPending(fileId);
        for (const [cell, value] of Object.entries(sending)) if (left[cell] === value) delete left[cell];
        writePending(fileId, left);
      }
    } catch {
      keepForLater();
      if (stillActive()) {
        retryIn = Math.min(5000 * 2 ** failures.current++, 60000);
        setStatus("retrying");
      }
    } finally {
      busy.current = false;
    }
    if (!stillActive()) {
      // Lo de la rutina nueva pudo quedar esperando a que terminara esta subida.
      if (Object.keys(pending.current).length) timer.current = setTimeout(() => flushRef.current(), DEBOUNCE_MS);
      return;
    }
    writePending(fileId, pending.current);
    if (retryIn !== null) timer.current = setTimeout(flush, retryIn);
    else if (Object.keys(pending.current).length && failures.current === 0) timer.current = setTimeout(flush, DEBOUNCE_MS);
  }, [fileId]);
  const flushRef = useRef(flush);
  flushRef.current = flush;

  const queue = useCallback(
    (cell: string, value: string) => {
      if (!fileId) return;
      pending.current[cell] = value;
      writePending(fileId, pending.current);
      setStatus("pending");
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, DEBOUNCE_MS);
    },
    [fileId, flush],
  );

  // Recupera lo que quedó sin subir en una visita anterior.
  useEffect(() => {
    pending.current = fileId ? readPending(fileId) : {};
    failures.current = 0;
    setSavedAt(null);
    setMessage(null);
    setStatus(Object.keys(pending.current).length ? "pending" : "idle");
    if (Object.keys(pending.current).length) timer.current = setTimeout(flush, 500);
    return () => clearTimeout(timer.current);
  }, [fileId, flush]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length || busy.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return { status, savedAt, message, queue, flush, pendingCells: () => pending.current };
}
