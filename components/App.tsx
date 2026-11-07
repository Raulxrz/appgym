"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DriveFile } from "@/lib/google";
import { nextPosition, previousLog, type Routine } from "@/lib/routine";
import { readPending, useSaver, type SaveStatus } from "@/lib/use-saver";
import AddRoutine from "./AddRoutine";
import Logo from "./Logo";
import SetEditor from "./SetEditor";

const ACTIVE_KEY = "asymettry.activeFile";
// Clave anterior al cambio de nombre, para recordar la rutina abierta.
const LEGACY_ACTIVE_KEY = "appgym.activeFile";
const store = {
  get: () => { try { return localStorage.getItem(ACTIVE_KEY) ?? localStorage.getItem(LEGACY_ACTIVE_KEY); } catch { return null; } },
  set: (id: string) => { try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* preferencia opcional */ } },
};

function applyChanges(routine: Routine, changes: Record<string, string>): Routine {
  if (!Object.keys(changes).length) return routine;
  return {
    ...routine,
    days: routine.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((exercise) => ({
        ...exercise,
        slots: exercise.slots.map((slot) => (slot.logCell in changes ? { ...slot, log: changes[slot.logCell] || undefined } : slot)),
      })),
    })),
  };
}

function statusText(status: SaveStatus, savedAt: Date | null, message: string | null) {
  switch (status) {
    case "pending": return "Cambios sin guardar…";
    case "saving": return "Guardando en Drive…";
    case "saved": return savedAt ? `Guardado en Drive a las ${savedAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}` : "Guardado en Drive";
    case "retrying": return `${message ? `${message.replace(/\.?$/, ".")} ` : "Sin conexión con Drive. "}Tus cambios siguen en este navegador.`;
    case "expired": return "Tu sesión ha caducado";
    default: return "";
  }
}

const shortDay = (name: string) => name.replace(/\s*\(.*$/, "").replace(/^(d[ií]a\s*\d+)\s*:\s*/i, "$1 · ");

export default function App({ email }: { email: string }) {
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [dayIndex, setDayIndex] = useState(0);
  const [microcycle, setMicrocycle] = useState(0);
  const [selected, setSelected] = useState<{ row: number; microcycle: number } | null>(null);
  const addDialog = useRef<HTMLDialogElement>(null);

  const saver = useSaver(fileId, useCallback((saved: Routine) => {
    setRoutine(applyChanges(saved, saverPending.current()));
  }, []));
  const saverPending = useRef(saver.pendingCells);
  saverPending.current = saver.pendingCells;

  const loadFiles = useCallback(async () => {
    const res = await fetch("/api/routines");
    if (res.status === 401) return setExpired(true);
    const body = await res.json();
    if (!res.ok) return setLoadError(body.error);
    setFiles(body.files);
    return body.files as DriveFile[];
  }, []);

  useEffect(() => {
    loadFiles().then((list) => {
      if (!list?.length) return;
      const saved = store.get();
      setFileId(list.some((f) => f.id === saved) ? saved : list[0].id);
    });
  }, [loadFiles]);

  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;
    setRoutine(null);
    setSelected(null);
    setLoadError(null);
    store.set(fileId);
    fetch(`/api/routines/${fileId}`).then(async (res) => {
      if (cancelled) return;
      const body = await res.json();
      if (res.status === 401) return setExpired(true);
      if (!res.ok) return setLoadError(body.error);
      const merged = applyChanges(body.routine, readPending(fileId));
      const position = nextPosition(merged);
      setRoutine(merged);
      setDayIndex(position.day);
      setMicrocycle(position.microcycle);
    }).catch(() => !cancelled && setLoadError("No se ha podido abrir la rutina. Comprueba tu conexión."));
    return () => { cancelled = true; };
  }, [fileId]);

  const onCellChange = useCallback((cell: string, value: string) => {
    setRoutine((current) => current && applyChanges(current, { [cell]: value }));
    saver.queue(cell, value);
  }, [saver.queue]); // eslint-disable-line react-hooks/exhaustive-deps

  const onAdded = async (id: string) => {
    addDialog.current?.close();
    await loadFiles();
    setFileId(id);
  };

  const logout = async () => {
    await saver.flush();
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  const suggested = useMemo(() => (routine ? nextPosition(routine) : null), [routine]);
  const day = routine?.days[dayIndex];
  const selectedIndex = selected && day ? day.exercises.findIndex((e) => e.row === selected.row) : -1;
  const exercise = selectedIndex >= 0 ? day!.exercises[selectedIndex] : undefined;
  const sessionExpired = expired || saver.status === "expired";
  const activeFile = files?.find((f) => f.id === fileId);

  const previous = exercise && selected && routine ? (() => {
    const found = previousLog(exercise, selected.microcycle);
    return found && { log: found.log, label: routine.microcycles[found.microcycle].label.toLowerCase() };
  })() : undefined;

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand"><Logo size={26} /></span>
        {files && files.length > 0 && (
          <label className="routine-picker">
            <span className="sr-only">Rutina</span>
            <select value={fileId ?? ""} onChange={(e) => setFileId(e.target.value)}>
              {files.map((f) => <option key={f.id} value={f.id}>{f.name.replace(/\.xlsx$/i, "")}</option>)}
            </select>
          </label>
        )}
        {files && files.length > 0 && <button className="button button-quiet" onClick={() => addDialog.current?.showModal()}>Añadir rutina</button>}
        <p className={`save-status status-${saver.status}`} role="status">{statusText(saver.status, saver.savedAt, saver.message)}</p>
        {activeFile && <a className="link" href={`https://drive.google.com/file/d/${activeFile.id}/view`} target="_blank" rel="noreferrer">Abrir Excel</a>}
        <span className="muted user">{email}</span>
        <button className="button button-quiet" onClick={logout}>Salir</button>
      </header>

      {sessionExpired && (
        <p className="banner" role="alert">
          Tu sesión de Google ha caducado. Lo que has apuntado sigue en este navegador. <a href="/api/auth/login">Vuelve a entrar</a> para subirlo.
        </p>
      )}

      {files && files.length === 0 && (
        <main className="welcome">
          <p className="eyebrow eyebrow-accent">Primer paso</p>
          <h1>Elige con qué rutina empezar</h1>
          <p className="muted welcome-lead">Usa un Excel que ya tengas en Drive o crea una copia vacía de una de nuestras rutinas.</p>
          <AddRoutine onAdded={onAdded} onExpired={() => setExpired(true)} />
        </main>
      )}

      {loadError && <p className="notice notice-error page-notice" role="alert">{loadError}</p>}
      {((!files && !loadError && !sessionExpired) || (fileId && !routine && !loadError && !sessionExpired)) && <p className="loading">Cargando tu rutina…</p>}

      {routine && day && (
        <div className={`workspace${exercise ? " workspace-open" : ""}`}>
          <main className="board">
            <div className="board-head">
              <nav className="days" aria-label="Días">
                {routine.days.map((d, i) => (
                  <button
                    key={i}
                    className={`day${i === dayIndex ? " day-active" : ""}`}
                    disabled={d.rest}
                    aria-current={i === dayIndex ? "true" : undefined}
                    onClick={() => { setDayIndex(i); setSelected(null); }}
                  >
                    {shortDay(d.name)}
                  </button>
                ))}
              </nav>
              {suggested && (suggested.day !== dayIndex || suggested.microcycle !== microcycle) && (
                <button className="link-button" onClick={() => { setDayIndex(suggested.day); setMicrocycle(suggested.microcycle); setSelected(null); }}>
                  Ir a lo siguiente: {shortDay(routine.days[suggested.day].name)}, {routine.microcycles[suggested.microcycle].label.toLowerCase()}
                </button>
              )}
            </div>

            <div className="table-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th scope="col" className="col-name">Ejercicio</th>
                    {routine.microcycles.map((m, i) => (
                      <th scope="col" key={m.pautaColumn} className={i === microcycle ? "col-current" : undefined}>
                        <button className="col-button" onClick={() => setMicrocycle(i)} aria-pressed={i === microcycle}>
                          {m.label.replace(/^MICROCICLO\s*/i, "Micro ").replace(/^DESCARGA/i, "Descarga")}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {day.exercises.map((e) => (
                    <tr key={e.row} className={selected?.row === e.row ? "row-selected" : undefined}>
                      <th scope="row" className="col-name">
                        <span className="exercise-name">{e.name}</span>
                        {e.targets.length > 0 && <span className="targets">{e.targets.join(" · ")} reps</span>}
                      </th>
                      {e.slots.map((slot, i) => (
                        <td key={slot.logCell} className={i === microcycle ? "col-current" : undefined}>
                          <button
                            className={`slot${slot.log ? " slot-filled" : ""}${selected?.row === e.row && selected.microcycle === i ? " slot-selected" : ""}`}
                            aria-label={`${e.name}, ${routine.microcycles[i].label}: ${slot.log ?? "sin registrar"}`}
                            onClick={() => { setMicrocycle(i); setSelected({ row: e.row, microcycle: i }); }}
                          >
                            {slot.log ? <span className="numbers slot-log">{slot.log}</span> : <span className="slot-empty">Apuntar</span>}
                            <span className="slot-pauta">{slot.pauta ?? "Sin pauta"}</span>
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {routine.volume.length > 0 && (
              <details className="volume">
                <summary>Volumen semanal</summary>
                <ul>{routine.volume.map((v) => <li key={v}>{v}</li>)}</ul>
              </details>
            )}
          </main>

          {exercise && selected && (
            <SetEditor
              key={`${fileId}-${exercise.row}-${selected.microcycle}`}
              exercise={exercise}
              microcycle={selected.microcycle}
              microcycleLabel={routine.microcycles[selected.microcycle].label}
              previous={previous}
              onChange={onCellChange}
              onClose={() => setSelected(null)}
              onNext={selectedIndex < day.exercises.length - 1
                ? () => setSelected({ row: day.exercises[selectedIndex + 1].row, microcycle: selected.microcycle })
                : undefined}
            />
          )}
        </div>
      )}

      <dialog ref={addDialog} className="dialog" aria-labelledby="add-title">
        <header>
          <h2 id="add-title">Añadir rutina</h2>
          <button className="button button-quiet" onClick={() => addDialog.current?.close()}>Cerrar</button>
        </header>
        <AddRoutine onAdded={onAdded} onExpired={() => { addDialog.current?.close(); setExpired(true); }} />
      </dialog>
    </div>
  );
}
