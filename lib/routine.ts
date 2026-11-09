// Convierte las celdas de la hoja en el modelo de la app: días, ejercicios y microciclos.
import { columnIndex, columnName, type Cells } from "./xlsx";

export type Microcycle = { label: string; pautaColumn: string; logColumn: string };

export type Exercise = {
  row: number;
  name: string;
  note?: string;
  targets: string[];
  rest?: string;
  /** Una entrada por microciclo, en el mismo orden que Routine.microcycles. */
  slots: { pauta?: string; logCell: string; log?: string }[];
};

export type Day = { name: string; rest: boolean; exercises: Exercise[] };

export type Routine = { microcycles: Microcycle[]; days: Day[]; volume: string[] };

export class RoutineFormatError extends Error {}

const DAY_RE = /^d[ií]a\s*\d+/i;
const REST_RE = /\b(rest|descanso)\b/i;

function splitCells(cells: Cells) {
  const rows = new Map<number, Map<string, string>>();
  for (const [coord, value] of cells) {
    const m = /^([A-Z]+)(\d+)$/.exec(coord);
    if (!m) continue;
    const row = Number(m[2]);
    if (!rows.has(row)) rows.set(row, new Map());
    rows.get(row)!.set(m[1], value);
  }
  return rows;
}

export function parseExerciseName(raw: string): { name: string; note?: string; targets: string[] } {
  const text = raw.trim().replace(/\s+/g, " ");
  const targets = [...text.matchAll(/(\d+\s*-\s*\d+)\s*reps/gi)].map((m) => m[1].replace(/\s/g, ""));
  const cut = text.search(/\(?\s*top set\s*:|\b\d+\s*-\s*\d+\s*reps/i);
  if (cut < 0) return { name: text, targets };
  const name = text.slice(0, cut).trim();
  const after = text.slice(cut).replace(/\(?\s*(top set|resto)\s*:\s*\d+\s*-\s*\d+\s*reps\s*\)?/gi, "").replace(/\d+\s*-\s*\d+\s*reps/gi, "");
  const note = after.replace(/^[\s*]+|[\s*()]+$/g, "").replace(/\(/g, "").trim();
  return { name, targets, ...(note ? { note } : {}) };
}

function findHeader(rows: Map<number, Map<string, string>>) {
  for (const row of [...rows.keys()].sort((a, b) => a - b)) {
    const columns = [...rows.get(row)!].filter(([, v]) => /^\s*(microciclo|descarga)/i.test(v));
    if (columns.length) return { row, columns, values: rows.get(row)! };
  }
  throw new RoutineFormatError("No se encuentra la fila de cabecera con los microciclos");
}

export function parseRoutine(cells: Cells): Routine {
  const rows = splitCells(cells);
  const header = findHeader(rows);
  const microcycles: Microcycle[] = header.columns
    .sort(([a], [b]) => columnIndex(a) - columnIndex(b))
    .map(([column, label]) => ({
      label: label.trim(),
      pautaColumn: column,
      // El registro va siempre en la columna de la derecha de la pauta, aunque no tenga título.
      logColumn: columnName(columnIndex(column) + 1),
    }));
  const restColumn = [...header.values].find(([, v]) => /descansos?/i.test(v))?.[0];

  const days: Day[] = [];
  const volume: string[] = [];
  let inVolume = false;
  for (const number of [...rows.keys()].sort((a, b) => a - b)) {
    const values = rows.get(number)!;
    const title = values.get("A")?.trim();
    if (!title) continue;
    if (/^volumen/i.test(title)) {
      inVolume = true;
      continue;
    }
    if (inVolume) {
      volume.push(title);
      continue;
    }
    if (DAY_RE.test(title) || REST_RE.test(title)) {
      days.push({ name: title, rest: REST_RE.test(title), exercises: [] });
      continue;
    }
    const day = days[days.length - 1];
    if (!day) continue;
    day.exercises.push({
      row: number,
      ...parseExerciseName(title),
      ...(restColumn && values.get(restColumn) ? { rest: values.get(restColumn)!.trim() } : {}),
      slots: microcycles.map((mc) => ({
        pauta: values.get(mc.pautaColumn)?.trim() || undefined,
        logCell: `${mc.logColumn}${number}`,
        log: values.get(mc.logColumn)?.trim() || undefined,
      })),
    });
  }
  if (!days.some((day) => day.exercises.length)) {
    throw new RoutineFormatError("No se han encontrado días con ejercicios");
  }
  return { microcycles, days, volume };
}

/** Celdas que la app tiene permitido escribir: solo el registro de ejercicios existentes. */
export function writableCells(routine: Routine): Set<string> {
  return new Set(routine.days.flatMap((d) => d.exercises.flatMap((e) => e.slots.map((s) => s.logCell))));
}

/** Celdas de registro que ya tienen algo apuntado. */
export function loggedCells(routine: Routine): string[] {
  return routine.days.flatMap((d) => d.exercises.flatMap((e) => e.slots.filter((s) => s.log).map((s) => s.logCell)));
}

/** Primer microciclo y día con algún ejercicio pautado sin registrar. */
export function nextPosition(routine: Routine): { microcycle: number; day: number } {
  for (let microcycle = 0; microcycle < routine.microcycles.length; microcycle++) {
    for (let day = 0; day < routine.days.length; day++) {
      const pending = routine.days[day].exercises.some((e) => e.slots[microcycle].pauta && !e.slots[microcycle].log);
      if (pending) return { microcycle, day };
    }
  }
  return { microcycle: routine.microcycles.length - 1, day: Math.max(0, routine.days.findIndex((d) => d.exercises.length)) };
}

/** Último registro anterior al microciclo indicado. */
export function previousLog(exercise: Exercise, microcycle: number): { microcycle: number; log: string } | undefined {
  for (let i = microcycle - 1; i >= 0; i--) {
    const log = exercise.slots[i].log;
    if (log) return { microcycle: i, log };
  }
  return undefined;
}
