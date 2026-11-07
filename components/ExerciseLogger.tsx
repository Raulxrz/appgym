"use client";
import { useEffect, useRef, useState } from "react";
import { pretty } from "@/lib/labels";
import { parseLog, serializeLog, type LoggedSet } from "@/lib/log-format";
import type { Exercise } from "@/lib/routine";
import { buildRows, extraRow, hasData, toLogged, type SetRow } from "@/lib/sets";

type Props = {
  exercise: Exercise;
  microcycle: number;
  index: number;
  total: number;
  previous?: { label: string; log: string };
  onChange: (cell: string, value: string) => void;
  onPrev?: () => void;
  onNext: () => void;
};

const DECIMAL = /^\d{0,4}(?:[.,]\d{0,2})?$/;
const INTEGER = /^\d{0,3}$/;

type Key = "kg" | "reps" | "minutes" | "dsKg" | "dsReps" | "partialsCount" | "rpCount";

function bump(value: string, step: number, decimal: boolean): string {
  const n = Math.max(0, (parseFloat(value.replace(",", ".")) || 0) + step);
  return decimal ? String(Math.round(n * 100) / 100) : String(Math.round(n));
}

const setText = (r: SetRow) => (r.kind === "time" ? `${r.minutes} min` : `${r.kg || 0} × ${r.reps}`);
const loggedText = (s: LoggedSet | null | undefined) => (s ? (s.minutes ? `${s.minutes} min` : `${s.kg} × ${s.reps}`) : null);

export default function ExerciseLogger({ exercise, microcycle, index, total, previous, onChange, onPrev, onNext }: Props) {
  const slot = exercise.slots[microcycle];
  const rawUnreadable = !parseLog(slot.log).ok ? slot.log : undefined;
  const previousSets = previous ? parseLog(previous.log).sets : [];

  // El peso de partida es el de la serie anterior de hoy o, si no hay, el de la sesión anterior.
  const prefill = (rows: SetRow[], i: number): SetRow[] =>
    rows.map((r, n) => {
      if (n !== i || r.done || r.kind === "time" || r.kg) return r;
      const before = [...rows.slice(0, i)].reverse().find((x) => x.done && x.kg)?.kg;
      return { ...r, kg: before ?? previousSets[i]?.kg ?? "" };
    });

  const [rows, setRows] = useState<SetRow[]>(() => {
    const built = buildRows(slot.pauta, slot.log);
    const first = built.findIndex((r) => !r.done);
    return first >= 0 ? prefill(built, first) : built;
  });
  const [cursor, setCursor] = useState(() => {
    const first = rows.findIndex((r) => !r.done);
    return first >= 0 ? first : rows.length;
  });
  const [extrasOpen, setExtrasOpen] = useState(false);
  const latest = useRef(rows);
  latest.current = rows;
  const lastSent = useRef(rawUnreadable ? null : serializeLog(parseLog(slot.log).sets));
  const repsInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) repsInput.current?.focus();
  }, [cursor]);

  const commit = (next: SetRow[]) => {
    latest.current = next;
    setRows(next);
    if (rawUnreadable && !next.some((r) => r.done)) return;
    const text = serializeLog(next.map(toLogged));
    if (text === lastSent.current) return;
    lastSent.current = text;
    onChange(slot.logCell, text);
  };

  const goTo = (i: number) => {
    setExtrasOpen(false);
    setCursor(i);
    if (i < latest.current.length) {
      const next = prefill(latest.current, i);
      latest.current = next;
      setRows(next);
    }
  };

  const nextOpen = (from: number, list: SetRow[]) => {
    const after = list.findIndex((r, n) => n > from && !r.done);
    return after >= 0 ? after : list.length;
  };

  const edit = (key: Key, value: string) => {
    const decimal = key === "kg" || key === "dsKg" || key === "minutes";
    if (!(decimal ? DECIMAL : INTEGER).test(value)) return;
    const next = latest.current.map((r, n) => (n === cursor ? { ...r, [key]: value } : r));
    latest.current = next;
    setRows(next);
    // Una serie ya guardada se actualiza al momento.
    if (next[cursor].done && hasData(next[cursor])) commit(next);
  };

  const save = () => {
    const row = latest.current[cursor];
    if (!row || !hasData(row)) return;
    const next = latest.current.map((r, n) => (n === cursor ? { ...r, done: true } : r));
    commit(next);
    goTo(nextOpen(cursor, next));
  };

  const unmark = () => {
    commit(latest.current.map((r, n) => (n === cursor ? { ...r, done: false } : r)));
  };

  const addSet = () => {
    const next = [...latest.current, extraRow(latest.current)];
    latest.current = next;
    setRows(next);
    goTo(next.length - 1);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
  };

  const field = (key: Key, label: string, opts: { step?: number; hint?: string; big?: boolean; inputRef?: React.Ref<HTMLInputElement> } = {}) => {
    const row = rows[cursor];
    const decimal = key === "kg" || key === "dsKg" || key === "minutes";
    return (
      <div className={`num-field${opts.big ? " num-field-big" : ""}`}>
        <label htmlFor={`f-${key}`} className="num-label">{label}</label>
        <div className="num-control">
          {opts.step && (
            <button type="button" tabIndex={-1} aria-label={`Restar ${opts.step} ${label}`} onClick={() => edit(key, bump(row[key], -opts.step!, decimal))}>−</button>
          )}
          <input
            id={`f-${key}`}
            ref={opts.inputRef}
            inputMode={decimal ? "decimal" : "numeric"}
            autoComplete="off"
            value={row[key]}
            placeholder={opts.hint}
            onChange={(e) => edit(key, e.target.value)}
            onKeyDown={onKey}
          />
          {opts.step && (
            <button type="button" tabIndex={-1} aria-label={`Sumar ${opts.step} ${label}`} onClick={() => edit(key, bump(row[key], opts.step!, decimal))}>+</button>
          )}
        </div>
      </div>
    );
  };

  const current = rows[cursor];
  const complete = cursor >= rows.length;
  const hint = previousSets[cursor] ?? undefined;
  const showExtras = current && current.kind !== "time" && (extrasOpen || current.ds || current.partials || current.rp || !!(current.dsReps || current.partialsCount || current.rpCount));
  const isLast = index === total - 1;

  return (
    <section className="logger" aria-labelledby="exercise-title">
      <header className="logger-head">
        <p className="eyebrow">Ejercicio {index + 1} de {total}</p>
        <h2 id="exercise-title">{pretty(exercise.name)}</h2>
        <div className="logger-meta">
          {slot.pauta && <span className="tag tag-strong">{slot.pauta}</span>}
          {exercise.targets.length > 0 && <span className="tag">Objetivo {exercise.targets.join(" · resto ")} reps</span>}
          {exercise.rest && <span className="tag">Descanso: {exercise.rest.toLowerCase()}</span>}
        </div>
        {exercise.note && <p className="logger-note">{exercise.note}</p>}
      </header>

      <div className="previous">
        <span className="eyebrow">Sesión anterior</span>
        {previous ? (
          <p><strong className="numbers">{previous.log.replaceAll(" / ", "  /  ")}</strong> <span className="muted">{previous.label}</span></p>
        ) : (
          <p className="muted">Es la primera vez que haces este ejercicio en la rutina.</p>
        )}
      </div>

      {rawUnreadable && (
        <p className="notice" role="status">
          El Excel tiene en esta celda un texto que la app no reconoce: <strong>{rawUnreadable}</strong>. Se sustituirá cuando guardes una serie.
        </p>
      )}

      <ol className="set-pills" aria-label="Series">
        {rows.map((r, n) => (
          <li key={r.id}>
            <button
              className={`set-pill${r.done ? " set-pill-done" : ""}${n === cursor ? " set-pill-current" : ""}${!r.done && n < cursor ? " set-pill-skipped" : ""}`}
              onClick={() => goTo(n)}
              aria-current={n === cursor ? "step" : undefined}
            >
              <span className="set-pill-label">{r.label}</span>
              <span className="numbers">{r.done ? setText(r) : n < cursor ? "Saltada" : "—"}</span>
            </button>
          </li>
        ))}
      </ol>

      {!complete && current ? (
        <div className={`set-card${current.done ? " set-card-done" : ""}`}>
          <div className="set-card-head">
            <div>
              <p className="eyebrow">Serie {cursor + 1} de {rows.length}</p>
              <h3>{current.label}</h3>
            </div>
            {loggedText(hint) && <p className="set-card-hint">La última vez <b className="numbers">{loggedText(hint)}</b></p>}
          </div>

          <div className="set-inputs">
            {current.kind === "time" ? (
              field("minutes", "Minutos", { step: 0.5, hint: hint?.minutes, big: true, inputRef: repsInput })
            ) : (
              <>
                {field("kg", "Kg", { step: 2.5, hint: hint?.kg, big: true })}
                <span className="set-times" aria-hidden>×</span>
                {field("reps", "Reps", { step: 1, hint: hint?.reps, big: true, inputRef: repsInput })}
              </>
            )}
          </div>

          {current.kind !== "time" && (showExtras ? (
            <div className="set-extras">
              <div className="extra"><span className="extra-name">Drop set</span>{field("dsKg", "Kg")}<span className="set-times" aria-hidden>×</span>{field("dsReps", "Reps")}</div>
              <div className="extra"><span className="extra-name">Parciales</span>{field("partialsCount", "Reps")}</div>
              <div className="extra"><span className="extra-name">Rest-pause</span>{field("rpCount", "Reps")}</div>
            </div>
          ) : (
            <button className="link-button" onClick={() => setExtrasOpen(true)}>Añadir técnica: drop set, parciales o rest-pause</button>
          ))}

          <div className="set-actions">
            {current.done ? (
              <>
                <button className="button button-primary button-large" onClick={() => goTo(nextOpen(cursor, rows))}>Hecho</button>
                <button className="button button-large button-quiet" onClick={unmark}>Quitar serie</button>
              </>
            ) : (
              <>
                <button className="button button-primary button-large" onClick={save} disabled={!hasData(current)}>Guardar serie</button>
                <button className="button button-large button-quiet" onClick={() => goTo(nextOpen(cursor, rows))}>Saltar</button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="set-card set-card-complete">
          <span className="complete-check" aria-hidden>✓</span>
          <div>
            <h3>Ejercicio completado</h3>
            <p className="numbers muted">{rows.filter((r) => r.done).map(setText).join("  /  ") || "Sin series apuntadas"}</p>
          </div>
          <div className="set-actions">
            <button className="button button-primary button-large" onClick={onNext}>{isLast ? "Terminar el día" : "Siguiente ejercicio"}</button>
            <button className="button button-large button-quiet" onClick={addSet}>Añadir serie</button>
          </div>
        </div>
      )}

      <nav className="logger-nav" aria-label="Ejercicios">
        {onPrev ? <button className="button button-quiet" onClick={onPrev}>← Anterior</button> : <span />}
        {!complete && <button className="button button-quiet" onClick={onNext}>{isLast ? "Ir al resumen →" : "Siguiente ejercicio →"}</button>}
      </nav>
    </section>
  );
}
