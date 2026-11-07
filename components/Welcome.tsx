"use client";
import type { DriveFile } from "@/lib/google";
import { dayComplete, dayTitle, microcycleLabel } from "@/lib/labels";
import { pickerConfigured } from "@/lib/picker";
import { nextPosition, type Routine } from "@/lib/routine";
import { formatDate, scheduleFromProperties, todayPlan } from "@/lib/schedule";
import { TEMPLATES, templateOf } from "@/lib/templates";

export type Detail = { routine: Routine; file: DriveFile };

type Props = {
  name?: string;
  files: DriveFile[];
  details: Record<string, Detail | undefined>;
  busy: string | null;
  error: string | null;
  onOpen: (fileId: string) => void;
  onCreate: (templateId: string) => void;
  onPick: () => void;
};

function progressText(detail: Detail | undefined): { status: string; when?: string } {
  if (!detail) return { status: "Cargando tu progreso…" };
  const { routine, file } = detail;
  const schedule = scheduleFromProperties(file.appProperties);
  const next = nextPosition(routine);
  if (dayComplete(routine, next.microcycle, next.day)) return { status: "Rutina completada" };
  const status = `${microcycleLabel(routine.microcycles[next.microcycle].label)} · ${dayTitle(routine, next.day)}`;
  if (!schedule) return { status, when: "Falta elegir tu calendario" };
  const today = todayPlan(routine, schedule);
  if (today.kind === "before") return { status, when: `Empieza el ${formatDate(today.start)}` };
  if (today.kind === "rest") return { status, when: "Hoy toca descanso" };
  return { status, when: "Hoy toca entrenar" };
}

export default function Welcome({ name, files, details, busy, error, onOpen, onCreate, onPick }: Props) {
  const firstName = name?.split(" ")[0];
  const byTemplate = new Map<string, DriveFile>();
  for (const file of files) {
    const template = templateOf(file);
    if (template && !byTemplate.has(template.id)) byTemplate.set(template.id, file);
  }
  const others = files.filter((f) => ![...byTemplate.values()].includes(f));

  return (
    <main className="welcome">
      <header className="welcome-head">
        <p className="eyebrow eyebrow-accent">Bienvenida</p>
        <h1>{firstName ? `Hola, ${firstName}.` : "Hola."} ¿Qué entrenamos?</h1>
        <p className="muted welcome-lead">
          Elige tu entreno. Empezarás por el microciclo 1 y apuntarás tus series una a una; todo se guarda en tu Excel de Google Drive.
        </p>
      </header>

      <div className="programs">
        {TEMPLATES.map((t, i) => {
          const file = byTemplate.get(t.id);
          const progress = file ? progressText(details[file.id]) : null;
          return (
            <article key={t.id} className={`program${file ? " program-started" : ""}`}>
              <div className="program-top">
                <span className="program-index numbers">0{i + 1}</span>
                <p className="eyebrow">{t.number}</p>
              </div>
              <h2>{t.title}</h2>
              <p className="muted">{t.detail}</p>
              <ol className="program-days">
                {t.days.map((d, n) => (
                  <li key={d}><span className="numbers">D{n + 1}</span>{d}</li>
                ))}
              </ol>
              <p className="program-facts">5 días de entreno por semana · 5 microciclos + descarga</p>
              {progress && (
                <div className="program-progress">
                  <span className="eyebrow">Vas por</span>
                  <strong>{progress.status}</strong>
                  {progress.when && <span className="muted">{progress.when}</span>}
                </div>
              )}
              <div className="program-actions">
                {file ? (
                  <button className="button button-primary button-large" onClick={() => onOpen(file.id)} disabled={!!busy}>
                    {busy === file.id ? "Abriendo…" : "Continuar"}
                  </button>
                ) : (
                  <button className="button button-primary button-large" onClick={() => onCreate(t.id)} disabled={!!busy}>
                    {busy === t.id ? "Preparando tu Excel…" : `Empezar ${t.number}`}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {error && <p className="notice notice-error" role="alert">{error}</p>}

      <section className="welcome-more" aria-labelledby="own-title">
        <div>
          <h2 id="own-title">¿Ya tienes tu propio Excel?</h2>
          <p className="muted">Ábrelo desde tu Drive. Debe tener el mismo formato: días, microciclos y descarga en columnas.</p>
        </div>
        <button className="button" onClick={onPick} disabled={!!busy || !pickerConfigured}>
          {busy === "picker" ? "Abriendo Drive…" : "Elegir de Drive"}
        </button>
        {!pickerConfigured && <p className="fineprint">El selector de Drive aún no está configurado en esta instalación.</p>}
        {others.length > 0 && (
          <ul className="other-files">
            {others.map((f) => (
              <li key={f.id}>
                <span>{f.name.replace(/\.xlsx$/i, "")}</span>
                <button className="link-button" onClick={() => onOpen(f.id)} disabled={!!busy}>
                  {busy === f.id ? "Abriendo…" : "Abrir"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
