// Calendario de la rutina: fecha de inicio y días de la semana de descanso.
// Los días de entreno del Excel se reparten en orden por los días que no son de descanso.
import type { Routine } from "./routine";

/** start: fecha AAAA-MM-DD. rest: días de la semana de descanso, 0 = lunes … 6 = domingo. */
export type Schedule = { start: string; rest: number[] };

export type PlannedSession = { date: string; microcycle: number; day: number };

export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const WEEKDAY_INITIALS = ["L", "M", "X", "J", "V", "S", "D"];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDate(value: string): Date | null {
  const m = ISO_DATE.exec(value);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return toISODate(date) === value ? date : null;
}

export function toISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** Día de la semana empezando en lunes (0) y terminando en domingo (6). */
export const weekday = (date: Date) => (date.getDay() + 6) % 7;

/** Índices de los días del Excel que tienen ejercicios, en orden. */
export function trainingDays(routine: Routine): number[] {
  return routine.days.flatMap((day, index) => (!day.rest && day.exercises.length ? [index] : []));
}

/** Descansos que propone el propio Excel, colocados a partir del día de inicio. */
export function defaultRest(routine: Routine, start: Date): number[] {
  const first = weekday(start);
  const rest = new Set<number>();
  const week = routine.days.slice(0, 7);
  week.forEach((day, i) => {
    if (day.rest || !day.exercises.length) rest.add((first + i) % 7);
  });
  // Si el Excel tiene menos de 7 días, el resto de la semana se descansa.
  for (let i = week.length; i < 7; i++) rest.add((first + i) % 7);
  return [...rest].sort((a, b) => a - b);
}

export function isValidSchedule(value: unknown): value is Schedule {
  if (!value || typeof value !== "object") return false;
  const { start, rest } = value as Schedule;
  return (
    typeof start === "string" &&
    parseDate(start) !== null &&
    Array.isArray(rest) &&
    rest.length < 7 &&
    new Set(rest).size === rest.length &&
    rest.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  );
}

/** Sesiones de toda la rutina con su fecha prevista. */
export function plannedSessions(routine: Routine, schedule: Schedule): PlannedSession[] {
  const training = trainingDays(routine);
  const start = parseDate(schedule.start);
  if (!training.length || !start || schedule.rest.length >= 7) return [];
  const total = training.length * routine.microcycles.length;
  const sessions: PlannedSession[] = [];
  for (let date = start; sessions.length < total; date = addDays(date, 1)) {
    if (schedule.rest.includes(weekday(date))) continue;
    const k = sessions.length;
    sessions.push({ date: toISODate(date), microcycle: Math.floor(k / training.length), day: training[k % training.length] });
  }
  return sessions;
}

export function plannedDate(routine: Routine, schedule: Schedule, microcycle: number, day: number): string | undefined {
  return plannedSessions(routine, schedule).find((s) => s.microcycle === microcycle && s.day === day)?.date;
}

export type TodayPlan =
  | { kind: "before"; start: string }
  | { kind: "rest" }
  | { kind: "train"; session: PlannedSession }
  | { kind: "finished" };

export function todayPlan(routine: Routine, schedule: Schedule, today = new Date()): TodayPlan {
  const date = toISODate(today);
  if (date < schedule.start) return { kind: "before", start: schedule.start };
  const sessions = plannedSessions(routine, schedule);
  const session = sessions.find((s) => s.date === date);
  if (session) return { kind: "train", session };
  if (!sessions.length || date > sessions[sessions.length - 1].date) return { kind: "finished" };
  return { kind: "rest" };
}

/** Lee el calendario guardado en las propiedades del archivo de Drive. */
export function scheduleFromProperties(props: Record<string, string> | undefined): Schedule | null {
  if (!props?.asymettryStart) return null;
  const rest = (props.asymettryRest ?? "").split(",").filter(Boolean).map(Number);
  const schedule = { start: props.asymettryStart, rest };
  return isValidSchedule(schedule) ? schedule : null;
}

export function scheduleToProperties(schedule: Schedule): Record<string, string> {
  return { asymettryStart: schedule.start, asymettryRest: [...schedule.rest].sort((a, b) => a - b).join(",") };
}

export function formatDate(iso: string, options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) {
  const date = parseDate(iso);
  return date ? date.toLocaleDateString("es-ES", options) : iso;
}
