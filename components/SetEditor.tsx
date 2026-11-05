"use client";
import { useEffect, useRef, useState } from "react";
import { parseLog, serializeLog, type LoggedSet } from "@/lib/log-format";
import { parsePrescription, type PlannedSet } from "@/lib/prescription";
import type { Exercise } from "@/lib/routine";

type Row = PlannedSet & {
  id: number;
  done: boolean;
  /** Desmarcada a propósito: no se guarda al salir aunque tenga datos. */
  skipped: boolean;
  kg: string;
  reps: string;
  minutes: string;
  dsKg: string;
  dsReps: string;
  partialsCount: string;
  rpCount: string;
  showExtras: boolean;
};

const clean = (n: string) => n.replace(",", ".").replace(/\.$/, "");
const hasData = (r: Row) => (r.kind === "time" ? !!clean(r.minutes) : !!r.reps);

function buildRows(pauta: string | undefined, log: string | undefined): Row[] {
  const planned = parsePrescription(pauta);
  const logged = parseLog(log);
  const count = Math.max(planned.length, logged.sets.length, 1);
  return Array.from({ length: count }, (_, i) => {
    const plan: PlannedSet = planned[i] ?? { label: `Serie ${i + 1}`, kind: logged.sets[i]?.minutes ? "time" : "work", ds: false, partials: false, rp: false };
    const set = logged.sets[i] ?? null;
    return {
      ...plan,
      id: i,
      done: !!set,
      skipped: false,
      kg: set?.kg ?? "",
      reps: set?.reps ?? "",
      minutes: set?.minutes ?? "",
      dsKg: set?.dsKg ?? "",
      dsReps: set?.dsReps ?? "",
      partialsCount: set?.partials ?? "",
      rpCount: set?.rp ?? "",
      showExtras: plan.ds || plan.partials || plan.rp || !!(set?.dsReps || set?.partials || set?.rp),
    };
  });
}

function toLogged(r: Row): LoggedSet | null {
  if (!r.done || !hasData(r)) return null;
  if (r.kind === "time") return { minutes: clean(r.minutes) };
  return {
    kg: clean(r.kg),
    reps: r.reps,
    ...(r.dsReps ? { dsKg: clean(r.dsKg), dsReps: r.dsReps } : {}),
    ...(r.partialsCount ? { partials: r.partialsCount } : {}),
    ...(r.rpCount ? { rp: r.rpCount } : {}),
  };
}

const DECIMAL = /^\d{0,4}(?:[.,]\d{0,2})?$/;
const INTEGER = /^\d{0,3}$/;

type Props = {
  exercise: Exercise;
  microcycleLabel: string;
  microcycle: number;
  previous?: { label: string; log: string };
  onChange: (cell: string, value: string) => void;
  onClose: () => void;
  onNext?: () => void;
};

export default function SetEditor({ exercise, microcycleLabel, microcycle, previous, onChange, onClose, onNext }: Props) {
  const slot = exercise.slots[microcycle];
  const [rows, setRows] = useState<Row[]>(() => buildRows(slot.pauta, slot.log));
  const rawUnreadable = !parseLog(slot.log).ok ? slot.log : undefined;
  const previousSets = previous ? parseLog(previous.log).sets : [];
  const panel = useRef<HTMLElement>(null);
  const lastSent = useRef(rawUnreadable ? null : serializeLog(parseLog(slot.log).sets));
  const latest = useRef(rows);
  latest.current = rows;

  const send = (next: Row[]) => {
    if (rawUnreadable && !next.some((r) => r.done)) return;
    const text = serializeLog(next.map(toLogged));
    if (text === lastSent.current) return;
    lastSent.current = text;
    onChange(slot.logCell, text);
  };

  const update = (id: number, patch: Partial<Row>) => {
    const next = latest.current.map((r) => {
      if (r.id !== id) return r;
      const merged = { ...r, ...patch };
      return merged.done && !hasData(merged) ? { ...merged, done: false } : merged;
    });
    latest.current = next;
    setRows(next);
    send(next);
  };

  // Al salir del ejercicio se guardan también las series rellenadas sin marcar.
  useEffect(() => {
    const sendRef = send;
    return () => {
      const completed = latest.current.map((r) => (hasData(r) && !r.skipped ? { ...r, done: true } : r));
      sendRef(completed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    panel.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, []);

  const focusNextRow = (id: number) => {
    const next = latest.current.findIndex((r) => r.id === id) + 1;
    const target = panel.current?.querySelector<HTMLInputElement>(`[data-row="${next}"] input`);
    target?.focus();
  };

  const onEnter = (event: React.KeyboardEvent, row: Row) => {
    if (event.key !== "Enter" || !hasData(row)) return;
    event.preventDefault();
    update(row.id, { done: true, skipped: false });
    focusNextRow(row.id);
  };

  const addRow = () => {
    const last = latest.current[latest.current.length - 1];
    const id = last.id + 1;
    const number = latest.current.filter((r) => r.label.startsWith(last.kind === "top" ? "Top" : last.label.split(" ")[0])).length + 1;
    const row: Row = {
      ...last, id, done: false, skipped: false, kg: "", reps: "", minutes: "", dsKg: "", dsReps: "", partialsCount: "", rpCount: "",
      ds: false, partials: false, rp: false, showExtras: false, kind: last.kind === "time" ? "time" : "work",
      label: `${last.kind === "top" ? "Resto" : last.label.split(" ")[0]} ${last.kind === "top" ? 1 : number}`,
    };
    const next = [...latest.current, row];
    latest.current = next;
    setRows(next);
  };

  const field = (r: Row, key: "kg" | "reps" | "minutes" | "dsKg" | "dsReps" | "partialsCount" | "rpCount", label: string, hint?: string) => {
    const pattern = key === "kg" || key === "dsKg" || key === "minutes" ? DECIMAL : INTEGER;
    return (
      <label className="field">
        <span>{label}</span>
        <input
          inputMode={pattern === DECIMAL ? "decimal" : "numeric"}
          autoComplete="off"
          value={r[key]}
          placeholder={hint}
          aria-label={`${r.label}: ${label}`}
          onChange={(e) => pattern.test(e.target.value) && update(r.id, { [key]: e.target.value, skipped: false })}
          onKeyDown={(e) => onEnter(e, r)}
        />
      </label>
    );
  };

  return (
    <aside className="editor" ref={panel} aria-label={`Registrar ${exercise.name}`}>
      <header className="editor-head">
        <div>
          <p className="eyebrow">{microcycleLabel}</p>
          <h2>{exercise.name}</h2>
        </div>
        <button className="button button-quiet" onClick={onClose}>Cerrar</button>
      </header>

      <dl className="facts">
        {slot.pauta && <div><dt>Pauta</dt><dd>{slot.pauta}</dd></div>}
        {exercise.targets.length > 0 && <div><dt>Reps objetivo</dt><dd>{exercise.targets.join(" · resto ")}</dd></div>}
        {exercise.note && <div><dt>Nota</dt><dd>{exercise.note}</dd></div>}
      </dl>

      <div className="previous">
        <span className="eyebrow">Sesión anterior</span>
        {previous ? (
          <p><strong className="numbers">{previous.log.replaceAll(" / ", "  /  ")}</strong> <span className="muted">{previous.label}</span></p>
        ) : (
          <p className="muted">Sin registros anteriores de este ejercicio.</p>
        )}
      </div>

      {rawUnreadable && (
        <p className="notice" role="status">
          Esta celda contiene texto que la app no reconoce: <strong>{rawUnreadable}</strong>. Se mantendrá hasta que marques una serie, y entonces se sustituirá.
        </p>
      )}

      <div className="sets">
        {rows.map((r, index) => {
          const hint = previousSets[index] ?? undefined;
          return (
            <div className={`set${r.done ? " set-done" : ""}`} key={r.id} data-row={index}>
              <div className="set-main">
                <span className="set-label">{r.label}</span>
                {r.kind === "time" ? (
                  field(r, "minutes", "min", hint?.minutes)
                ) : (
                  <>
                    {field(r, "kg", "kg", hint?.kg)}
                    <span className="times" aria-hidden>×</span>
                    {field(r, "reps", "reps", hint?.reps)}
                  </>
                )}
                <button
                  className="check"
                  aria-pressed={r.done}
                  aria-label={`${r.label}: ${r.done ? "desmarcar" : "marcar como hecha"}`}
                  disabled={!hasData(r)}
                  onClick={() => update(r.id, { done: !r.done, skipped: r.done })}
                >
                  ✓
                </button>
              </div>
              {r.kind !== "time" && (
                r.showExtras ? (
                  <div className="set-extras">
                    <div className="extra">
                      <span className="extra-name">DS</span>
                      {field(r, "dsKg", "kg")}
                      <span className="times" aria-hidden>×</span>
                      {field(r, "dsReps", "reps")}
                    </div>
                    <div className="extra"><span className="extra-name">Parciales</span>{field(r, "partialsCount", "reps")}</div>
                    <div className="extra"><span className="extra-name">RP</span>{field(r, "rpCount", "reps")}</div>
                  </div>
                ) : (
                  <button className="link-button" onClick={() => update(r.id, { showExtras: true })}>Añadir técnica</button>
                )
              )}
            </div>
          );
        })}
      </div>

      <footer className="editor-foot">
        <button className="button" onClick={addRow}>Añadir serie</button>
        {onNext && <button className="button button-primary" onClick={onNext}>Siguiente ejercicio</button>}
      </footer>
      {exercise.rest && <p className="fineprint">Descanso: {exercise.rest.toLowerCase()}</p>}
    </aside>
  );
}
