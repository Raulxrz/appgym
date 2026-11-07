"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DriveFile } from "@/lib/google";
import { XLSX_MIME_TYPE, openDrivePicker } from "@/lib/picker";
import type { Routine } from "@/lib/routine";
import { scheduleFromProperties, type Schedule } from "@/lib/schedule";
import { templateOf } from "@/lib/templates";
import { readPending, useSaver, type SaveStatus } from "@/lib/use-saver";
import Logo from "./Logo";
import ScheduleSetup from "./ScheduleSetup";
import Session from "./Session";
import Welcome, { type Detail } from "./Welcome";

type View = { name: "welcome" } | { name: "setup"; fileId: string; editing: boolean } | { name: "session"; fileId: string };

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
    case "saved": return savedAt ? `Guardado a las ${savedAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}` : "Guardado en Drive";
    case "retrying": return `${message ? `${message.replace(/\.?$/, ".")} ` : "Sin conexión con Drive. "}Tus series siguen en este navegador.`;
    case "expired": return "Tu sesión ha caducado";
    default: return "";
  }
}

const displayName = (file: DriveFile) => {
  const template = templateOf(file);
  return template ? `${template.number} · ${template.title}` : file.name.replace(/\.xlsx$/i, "");
};

export default function App({ email, name }: { email: string; name?: string }) {
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [details, setDetails] = useState<Record<string, Detail | undefined>>({});
  const [view, setView] = useState<View>({ name: "welcome" });
  // La última rutina abierta sigue guardando en segundo plano aunque se vuelva a la bienvenida.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const saverPending = useRef<() => Record<string, string>>(() => ({}));
  const saver = useSaver(activeId, useCallback((saved: Routine) => {
    setActiveDetail((d) => ({ ...d, routine: applyChanges(saved, saverPending.current()) }));
  }, [])); // eslint-disable-line react-hooks/exhaustive-deps
  saverPending.current = saver.pendingCells;
  const activeRef = useRef(activeId);
  activeRef.current = activeId;

  function setActiveDetail(update: (d: Detail) => Detail) {
    const id = activeRef.current;
    if (!id) return;
    setDetails((all) => (all[id] ? { ...all, [id]: update(all[id]!) } : all));
  }

  const loadDetail = useCallback(async (id: string): Promise<Detail | null> => {
    const res = await fetch(`/api/routines/${id}`);
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) { setExpired(true); return null; }
    if (!res.ok) throw new Error(body.error ?? "No se ha podido abrir la rutina");
    const detail: Detail = { file: body.file, routine: applyChanges(body.routine, readPending(id)) };
    setDetails((all) => ({ ...all, [id]: detail }));
    return detail;
  }, []);

  const loadFiles = useCallback(async () => {
    const res = await fetch("/api/routines");
    if (res.status === 401) { setExpired(true); return null; }
    const body = await res.json();
    if (!res.ok) { setError(body.error); return null; }
    setFiles(body.files);
    return body.files as DriveFile[];
  }, []);

  // Al entrar se carga el progreso de cada entreno para mostrarlo en la bienvenida.
  useEffect(() => {
    loadFiles().then((list) => {
      if (!list) return;
      const seen = new Set<string>();
      for (const file of list) {
        const template = templateOf(file);
        if (!template || seen.has(template.id)) continue;
        seen.add(template.id);
        loadDetail(file.id).catch(() => undefined);
      }
    });
  }, [loadFiles, loadDetail]);

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Algo ha fallado. Vuelve a intentarlo.");
    } finally {
      setBusy(null);
    }
  };

  const enter = (id: string, detail: Detail) => {
    setActiveId(id);
    const schedule = scheduleFromProperties(detail.file.appProperties);
    setView(schedule ? { name: "session", fileId: id } : { name: "setup", fileId: id, editing: false });
    window.scrollTo({ top: 0 });
  };

  const openFile = (id: string) => run(id, async () => {
    const detail = details[id] ?? (await loadDetail(id));
    if (detail) enter(id, detail);
  });

  const create = (templateId: string) => run(templateId, async () => {
    const res = await fetch("/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: templateId }),
    });
    const body = await res.json();
    if (res.status === 401) return setExpired(true);
    if (!res.ok) throw new Error(body.error ?? "No se ha podido crear tu Excel");
    setFiles((list) => [body.file, ...(list ?? [])]);
    const detail = await loadDetail(body.file.id);
    if (detail) enter(body.file.id, detail);
  });

  const pick = () => run("picker", async () => {
    const id = await openDrivePicker(XLSX_MIME_TYPE);
    if (!id) return;
    await loadFiles();
    const detail = await loadDetail(id);
    if (detail) enter(id, detail);
  });

  const saveSchedule = async (id: string, schedule: Schedule) => {
    const res = await fetch(`/api/routines/${id}/schedule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule }),
    });
    const body = await res.json();
    if (res.status === 401) { setExpired(true); return; }
    if (!res.ok) throw new Error(body.error ?? "No se ha podido guardar el calendario");
    const appProperties = { ...details[id]?.file.appProperties, ...body.file.appProperties };
    setDetails((all) => (all[id] ? { ...all, [id]: { ...all[id]!, file: { ...all[id]!.file, appProperties } } } : all));
    setFiles((list) => list?.map((f) => (f.id === id ? { ...f, appProperties } : f)) ?? list);
    setView({ name: "session", fileId: id });
    window.scrollTo({ top: 0 });
  };

  const onCellChange = useCallback((cell: string, value: string) => {
    setActiveDetail((d) => ({ ...d, routine: applyChanges(d.routine, { [cell]: value }) }));
    saver.queue(cell, value);
  }, [saver.queue]); // eslint-disable-line react-hooks/exhaustive-deps

  const goHome = () => {
    saver.flush();
    setView({ name: "welcome" });
    window.scrollTo({ top: 0 });
  };

  const logout = async () => {
    await saver.flush();
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  const currentId = view.name === "welcome" ? null : view.fileId;
  const current = currentId ? details[currentId] : undefined;
  const schedule = current ? scheduleFromProperties(current.file.appProperties) : null;
  const sessionExpired = expired || saver.status === "expired";
  const template = current ? templateOf(current.file) : undefined;
  const title = current ? displayName(current.file) : "";

  return (
    <div className="shell">
      <header className="topbar">
        <button className="brand" onClick={goHome} aria-label="Asymettry, volver al inicio"><Logo size={26} /></button>
        {current && <span className="topbar-routine">{title}</span>}
        <p className={`save-status status-${saver.status}`} role="status">{statusText(saver.status, saver.savedAt, saver.message)}</p>
        {view.name === "session" && (
          <button className="button button-quiet button-small" onClick={() => setView({ name: "setup", fileId: view.fileId, editing: true })}>Calendario</button>
        )}
        {view.name !== "welcome" && <button className="button button-quiet button-small topbar-wide" onClick={goHome}>Cambiar de entreno</button>}
        {current && <a className="link topbar-wide" href={`https://drive.google.com/file/d/${current.file.id}/view`} target="_blank" rel="noreferrer">Abrir Excel</a>}
        <span className="muted user">{email}</span>
        <button className="button button-quiet button-small" onClick={logout}>Salir</button>
      </header>

      {sessionExpired && (
        <p className="banner" role="alert">
          Tu sesión de Google ha caducado. Lo que has apuntado sigue en este navegador. <a href="/api/auth/login">Vuelve a entrar</a> para subirlo.
        </p>
      )}

      {view.name === "welcome" && (files ? (
        <Welcome name={name} files={files} details={details} busy={busy} error={error} onOpen={openFile} onCreate={create} onPick={pick} />
      ) : (
        !sessionExpired && (error ? <p className="notice notice-error page-notice" role="alert">{error}</p> : <p className="loading">Cargando tus entrenos…</p>)
      ))}

      {view.name === "setup" && current && (
        <ScheduleSetup
          key={view.fileId}
          routine={current.routine}
          title={template ? `${template.number} · ${template.title}` : title}
          initial={schedule}
          onSave={(s) => saveSchedule(view.fileId, s)}
          onCancel={view.editing ? () => setView({ name: "session", fileId: view.fileId }) : goHome}
        />
      )}

      {view.name === "session" && current && (
        <Session key={view.fileId} routine={current.routine} schedule={schedule} onChange={onCellChange} onHome={goHome} />
      )}
    </div>
  );
}


