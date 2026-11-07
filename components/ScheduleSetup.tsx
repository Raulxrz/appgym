"use client";
import { useMemo, useState } from "react";
import { dayTitle } from "@/lib/labels";
import type { Routine } from "@/lib/routine";
import {
  WEEKDAYS,
  WEEKDAY_INITIALS,
  addDays,
  defaultRest,
  formatDate,
  parseDate,
  plannedSessions,
  toISODate,
  trainingDays,
  weekday,
  type Schedule,
} from "@/lib/schedule";

type Props = {
  routine: Routine;
  title: string;
  initial: Schedule | null;
  onSave: (schedule: Schedule) => Promise<void>;
  onCancel?: () => void;
};

const nextMonday = (from: Date) => addDays(from, ((7 - weekday(from)) % 7) || 7);

export default function ScheduleSetup({ routine, title, initial, onSave, onCancel }: Props) {
  const today = new Date();
  const [start, setStart] = useState(initial?.start ?? toISODate(today));
  const [rest, setRest] = useState<number[]>(initial?.rest ?? defaultRest(routine, today));
  const [touched, setTouched] = useState(!!initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDate = parseDate(start);
  const schedule = { start, rest };
  const trainingCount = trainingDays(routine).length;
  const sessions = useMemo(() => (startDate ? plannedSessions(routine, schedule) : []), [routine, start, rest]); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = startDate
    ? Array.from({ length: 14 }, (_, i) => {
        const date = toISODate(addDays(startDate, i));
        return { date, session: sessions.find((s) => s.date === date) };
      })
    : [];
  const firstMicroEnd = sessions.filter((s) => s.microcycle === 0).at(-1)?.date;

  const changeStart = (value: string) => {
    setStart(value);
    const date = parseDate(value);
    // Mientras no se toquen los descansos, se recolocan según el día de inicio.
    if (date && !touched) setRest(defaultRest(routine, date));
  };

  const toggle = (day: number) => {
    setTouched(true);
    setRest((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort((a, b) => a - b)));
  };

  const save = async () => {
    if (!startDate || rest.length >= 7) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(schedule);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido guardar el calendario");
      setSaving(false);
    }
  };

  const quick = [
    { label: "Hoy", date: toISODate(today) },
    { label: "Mañana", date: toISODate(addDays(today, 1)) },
    { label: "El lunes", date: toISODate(nextMonday(today)) },
  ];
  const trainingPerWeek = 7 - rest.length;

  return (
    <main className="setup">
      <header className="setup-head">
        <p className="eyebrow eyebrow-accent">{title}</p>
        <h1>{initial ? "Tu calendario" : "Prepara tu microciclo 1"}</h1>
        <p className="muted welcome-lead">
          Elige qué día empiezas y qué días de la semana descansas. Los {trainingCount} días de entreno se repartirán en orden por el resto de días.
        </p>
      </header>

      <div className="setup-grid">
        <div className="setup-form">
          <fieldset className="setup-block">
            <legend><span className="step-badge numbers">1</span>¿Qué día empiezas?</legend>
            <div className="chips">
              {quick.map((q) => (
                <button key={q.label} type="button" className={`chip${start === q.date ? " chip-on" : ""}`} onClick={() => changeStart(q.date)} aria-pressed={start === q.date}>
                  {q.label}
                </button>
              ))}
            </div>
            <label className="date-field">
              <span>Fecha de inicio</span>
              <input type="date" value={start} onChange={(e) => changeStart(e.target.value)} required />
            </label>
            {startDate && <p className="muted">Empiezas el {formatDate(start)}.</p>}
          </fieldset>

          <fieldset className="setup-block">
            <legend><span className="step-badge numbers">2</span>¿Qué días descansas?</legend>
            <div className="weekdays" role="group" aria-label="Días de descanso">
              {WEEKDAYS.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  className={`weekday${rest.includes(i) ? " weekday-rest" : ""}`}
                  aria-pressed={rest.includes(i)}
                  aria-label={`${name}: ${rest.includes(i) ? "descanso" : "entreno"}`}
                  onClick={() => toggle(i)}
                >
                  <b>{WEEKDAY_INITIALS[i]}</b>
                  <small>{rest.includes(i) ? "Descanso" : "Entreno"}</small>
                </button>
              ))}
            </div>
            <p className={trainingPerWeek === trainingCount ? "muted" : "setup-hint"}>
              {rest.length >= 7
                ? "Deja al menos un día para entrenar."
                : trainingPerWeek === trainingCount
                  ? `${trainingPerWeek} días de entreno y ${rest.length} de descanso: cada microciclo dura una semana.`
                  : `Entrenas ${trainingPerWeek} días por semana y la rutina tiene ${trainingCount}: los microciclos no coincidirán con semanas.`}
            </p>
          </fieldset>

          {error && <p className="notice notice-error" role="alert">{error}</p>}
          <div className="setup-actions">
            <button className="button button-primary button-large" onClick={save} disabled={saving || !startDate || rest.length >= 7}>
              {saving ? "Guardando…" : initial ? "Guardar calendario" : "Guardar y empezar"}
            </button>
            {onCancel && <button className="button button-large button-quiet" onClick={onCancel}>Cancelar</button>}
          </div>
        </div>

        <aside className="calendar" aria-label="Vista previa de las dos primeras semanas">
          <p className="eyebrow">Tus dos primeras semanas</p>
          <ol className="calendar-list">
            {preview.map(({ date, session }) => (
              <li key={date} className={session ? "cal-train" : "cal-rest"}>
                <span className="cal-date">
                  <b>{formatDate(date, { weekday: "short" })}</b>
                  <span className="numbers">{formatDate(date, { day: "numeric", month: "short" })}</span>
                </span>
                <span className="cal-what">
                  {session ? (
                    <>
                      {dayTitle(routine, session.day)}
                      {session.microcycle > 0 && <small> · Micro {session.microcycle + 1}</small>}
                    </>
                  ) : (
                    "Descanso"
                  )}
                </span>
              </li>
            ))}
          </ol>
          {firstMicroEnd && <p className="fineprint">El microciclo 1 termina el {formatDate(firstMicroEnd)}.</p>}
        </aside>
      </div>
    </main>
  );
}
