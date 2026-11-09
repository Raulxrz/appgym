"use client";
import { useState } from "react";
import { dayComplete, dayParts, dayTitle, exerciseComplete, microcycleLabel, pretty } from "@/lib/labels";
import { loggedCells, nextPosition, previousLog, type Routine } from "@/lib/routine";
import { formatDate, plannedDate, toISODate, todayPlan, trainingDays, type Schedule } from "@/lib/schedule";
import ConfirmDialog from "./ConfirmDialog";
import ExerciseLogger from "./ExerciseLogger";

type Position = { microcycle: number; day: number };

type Props = {
  routine: Routine;
  schedule: Schedule | null;
  onChange: (cell: string, value: string) => void;
  onHome: () => void;
  onReset: () => Promise<void>;
};

const firstOpen = (routine: Routine, pos: Position) =>
  routine.days[pos.day].exercises.findIndex((e) => !exerciseComplete(e, pos.microcycle));

function whenText(routine: Routine, schedule: Schedule | null, pos: Position): string | null {
  if (!schedule) return null;
  const date = plannedDate(routine, schedule, pos.microcycle, pos.day);
  const today = toISODate(new Date());
  const plan = todayPlan(routine, schedule);
  if (!date) return null;
  if (date === today) return "Programado para hoy";
  if (date < today) return `Pendiente desde el ${formatDate(date)}`;
  return plan.kind === "rest"
    ? `Hoy toca descanso · programado para el ${formatDate(date)}`
    : `Programado para el ${formatDate(date)}`;
}

export default function Session({ routine, schedule, onChange, onHome, onReset }: Props) {
  const [pos, setPos] = useState<Position>(() => nextPosition(routine));
  const [index, setIndex] = useState(() => Math.max(firstOpen(routine, nextPosition(routine)), 0));
  const [summary, setSummary] = useState(() => firstOpen(routine, nextPosition(routine)) < 0);

  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const confirmReset = async () => {
    setResetting(true);
    setResetError(null);
    try {
      await onReset();
      setConfirming(false);
    } catch (e) {
      setResetError(e instanceof Error && e.message ? e.message : "No se ha podido reiniciar el progreso");
    } finally {
      setResetting(false);
    }
  };

  const day = routine.days[pos.day];
  const exercises = day.exercises;
  const exercise = exercises[index];
  const parts = dayParts(day.name);
  const when = whenText(routine, schedule, pos);

  const open = (next: Position) => {
    const first = firstOpen(routine, next);
    setPos(next);
    setIndex(Math.max(first, 0));
    setSummary(first < 0);
    window.scrollTo({ top: 0 });
  };

  const goNext = () => {
    window.scrollTo({ top: 0 });
    if (index < exercises.length - 1) return setIndex(index + 1);
    // Tras el último ejercicio, el resumen muestra lo que falte por apuntar.
    setSummary(true);
  };

  const previous = exercise ? (() => {
    const found = previousLog(exercise, pos.microcycle);
    return found && { log: found.log, label: microcycleLabel(routine.microcycles[found.microcycle].label).toLowerCase() };
  })() : undefined;

  const next = nextPosition(routine);
  const finished = dayComplete(routine, next.microcycle, next.day);
  const nextWhen = schedule && !finished ? plannedDate(routine, schedule, next.microcycle, next.day) : undefined;

  return (
    <main className="session">
      <header className="session-head">
        <div className="session-title">
          <p className="eyebrow eyebrow-accent">{microcycleLabel(routine.microcycles[pos.microcycle].label)}</p>
          <h1>{dayTitle(routine, pos.day)}</h1>
          {parts.muscles && <p className="muted">{parts.muscles}</p>}
          {when && <p className="session-when">{when}</p>}
        </div>
        <label className="day-switch">
          <span className="eyebrow">Cambiar de día</span>
          <select
            value={`${pos.microcycle}:${pos.day}`}
            onChange={(e) => {
              const [m, d] = e.target.value.split(":").map(Number);
              open({ microcycle: m, day: d });
            }}
          >
            {routine.microcycles.map((m, mi) => (
              <optgroup key={m.pautaColumn} label={microcycleLabel(m.label)}>
                {trainingDays(routine).map((d) => (
                  <option key={d} value={`${mi}:${d}`}>
                    {dayTitle(routine, d)}{dayComplete(routine, mi, d) ? " ✓" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </header>

      <ol className="progress" aria-label="Ejercicios del día">
        {exercises.map((e, i) => (
          <li key={e.row}>
            <button
              className={`progress-step${exerciseComplete(e, pos.microcycle) ? " progress-done" : ""}${!summary && i === index ? " progress-current" : ""}`}
              onClick={() => { setIndex(i); setSummary(false); }}
              aria-label={`${pretty(e.name)}${exerciseComplete(e, pos.microcycle) ? ", hecho" : ""}`}
              aria-current={!summary && i === index ? "step" : undefined}
              title={pretty(e.name)}
            />
          </li>
        ))}
      </ol>

      {!summary && exercise ? (
        <ExerciseLogger
          key={`${pos.microcycle}-${pos.day}-${exercise.row}`}
          exercise={exercise}
          microcycle={pos.microcycle}
          index={index}
          total={exercises.length}
          previous={previous}
          onChange={onChange}
          onPrev={index > 0 ? () => setIndex(index - 1) : undefined}
          onNext={goNext}
        />
      ) : (
        <section className="day-done" aria-labelledby="done-title">
          <div className="day-done-head">
            {dayComplete(routine, pos.microcycle, pos.day) ? (
              <>
                <span className="complete-check" aria-hidden>✓</span>
                <div>
                  <p className="eyebrow">Buen trabajo</p>
                  <h2 id="done-title">Día completado</h2>
                </div>
              </>
            ) : (
              <div>
                <p className="eyebrow">Resumen</p>
                <h2 id="done-title">Te quedan ejercicios por apuntar</h2>
              </div>
            )}
          </div>
          <ul className="done-list">
            {exercises.map((e, i) => (
              <li key={e.row}>
                <span className="done-name">{pretty(e.name)}</span>
                <span className={`numbers ${e.slots[pos.microcycle].log ? "done-log" : "muted"}`}>{e.slots[pos.microcycle].log ?? "Sin apuntar"}</span>
                <button className="link-button" onClick={() => { setIndex(i); setSummary(false); }}>{e.slots[pos.microcycle].log ? "Editar" : "Apuntar"}</button>
              </li>
            ))}
          </ul>

          {finished ? (
            <div className="next-card">
              <p className="eyebrow">Rutina terminada</p>
              <h3>Has completado todos los microciclos y la descarga.</h3>
              <button className="button button-large" onClick={onHome}>Volver al inicio</button>
            </div>
          ) : (next.microcycle !== pos.microcycle || next.day !== pos.day) && (
            <div className="next-card">
              <p className="eyebrow">Siguiente sesión</p>
              <h3>{microcycleLabel(routine.microcycles[next.microcycle].label)} · {dayTitle(routine, next.day)}</h3>
              {nextWhen && <p className="muted">Programada para el {formatDate(nextWhen)}</p>}
              <div className="set-actions">
                <button className="button button-primary button-large" onClick={() => open(next)}>Empezar ahora</button>
                <button className="button button-large button-quiet" onClick={onHome}>Volver al inicio</button>
              </div>
            </div>
          )}
        </section>
      )}

      {loggedCells(routine).length > 0 && (
        <div className="session-danger">
          <button className="button button-danger" onClick={() => { setResetError(null); setConfirming(true); }}>Reiniciar progreso</button>
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          title="¿Reiniciar tu progreso?"
          confirmLabel="Sí, reiniciar"
          busyLabel="Reiniciando…"
          busy={resetting}
          error={resetError}
          onConfirm={confirmReset}
          onCancel={() => setConfirming(false)}
        >
          <p>Se borrarán todas las series apuntadas en este entreno, también las del Excel de Drive, y volverás al primer día.</p>
          <p><strong>Esta acción no se puede deshacer.</strong></p>
        </ConfirmDialog>
      )}
    </main>
  );
}
