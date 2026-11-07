// Textos legibles a partir de lo que pone el Excel (que suele estar en mayúsculas).
import type { Exercise, Routine } from "./routine";
import { trainingDays } from "./schedule";
import { parseLog } from "./log-format";
import { parsePrescription } from "./prescription";

const isShouty = (text: string) => text === text.toUpperCase() && /\p{Lu}{3}/u.test(text);

/** Pasa a minúsculas lo que está todo en mayúsculas, dejando la primera letra en mayúscula. */
export function pretty(raw: string): string {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!isShouty(text)) return text;
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** "Día 1: PULL ( ISQUIOS, ESPALDA)" → { focus: "Pull", muscles: "Isquios, espalda" } */
export function dayParts(name: string): { focus: string; muscles?: string } {
  const text = name.replace(/^d[ií]a\s*\d+\s*:?\s*/i, "").trim();
  const m = /^([^(]*)\((.*?)\)?\s*$/.exec(text);
  const focus = pretty((m ? m[1] : text).replace(/\s*\+\s*/g, " + ")) || pretty(name);
  const muscles = m?.[2] ? pretty(m[2].replace(/\s*,\s*/g, ", ").replace(/,(?=\S)/g, ", ")) : undefined;
  return muscles ? { focus, muscles } : { focus };
}

export const microcycleLabel = (label: string) => pretty(label.replace(/\s+/g, " "));

/** Número del día contando solo los días de entreno (1, 2, 3…). */
export function dayNumber(routine: Routine, day: number): number {
  return trainingDays(routine).indexOf(day) + 1;
}

export function dayTitle(routine: Routine, day: number): string {
  return `Día ${dayNumber(routine, day)} · ${dayParts(routine.days[day].name).focus}`;
}

/** Series previstas por la pauta (al menos una). */
export function plannedCount(exercise: Exercise, microcycle: number): number {
  return Math.max(parsePrescription(exercise.slots[microcycle].pauta).length, 1);
}

export function loggedCount(exercise: Exercise, microcycle: number): number {
  return parseLog(exercise.slots[microcycle].log).sets.filter(Boolean).length;
}

export function exerciseComplete(exercise: Exercise, microcycle: number): boolean {
  const log = exercise.slots[microcycle].log;
  if (!log) return false;
  const parsed = parseLog(log);
  // Un texto que la app no entiende cuenta como hecho: alguien lo apuntó a mano.
  return !parsed.ok || loggedCount(exercise, microcycle) >= plannedCount(exercise, microcycle);
}

export function dayComplete(routine: Routine, microcycle: number, day: number): boolean {
  return routine.days[day].exercises.every((e) => !!e.slots[microcycle].log);
}
