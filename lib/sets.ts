// Series de un ejercicio: lo que pide la pauta combinado con lo ya apuntado en el Excel.
import { parseLog, type LoggedSet } from "./log-format";
import { parsePrescription, type PlannedSet } from "./prescription";

export type SetRow = PlannedSet & {
  id: number;
  done: boolean;
  kg: string;
  reps: string;
  minutes: string;
  dsKg: string;
  dsReps: string;
  partialsCount: string;
  rpCount: string;
};

export const cleanNumber = (n: string) => n.replace(",", ".").replace(/\.$/, "");
export const hasData = (r: SetRow) => (r.kind === "time" ? !!cleanNumber(r.minutes) : !!r.reps);

export function buildRows(pauta: string | undefined, log: string | undefined): SetRow[] {
  const planned = parsePrescription(pauta);
  const logged = parseLog(log);
  const count = Math.max(planned.length, logged.sets.length, 1);
  return Array.from({ length: count }, (_, i) => {
    const plan: PlannedSet = planned[i] ?? {
      label: `Serie ${i + 1}`,
      kind: logged.sets[i]?.minutes ? "time" : "work",
      ds: false,
      partials: false,
      rp: false,
    };
    const set = logged.sets[i] ?? null;
    return {
      ...plan,
      id: i,
      done: !!set,
      kg: set?.kg ?? "",
      reps: set?.reps ?? "",
      minutes: set?.minutes ?? "",
      dsKg: set?.dsKg ?? "",
      dsReps: set?.dsReps ?? "",
      partialsCount: set?.partials ?? "",
      rpCount: set?.rp ?? "",
    };
  });
}

export function toLogged(r: SetRow): LoggedSet | null {
  if (!r.done || !hasData(r)) return null;
  if (r.kind === "time") return { minutes: cleanNumber(r.minutes) };
  return {
    kg: cleanNumber(r.kg),
    reps: r.reps,
    ...(r.dsReps ? { dsKg: cleanNumber(r.dsKg), dsReps: r.dsReps } : {}),
    ...(r.partialsCount ? { partials: r.partialsCount } : {}),
    ...(r.rpCount ? { rp: r.rpCount } : {}),
  };
}

export function extraRow(rows: SetRow[]): SetRow {
  const last = rows[rows.length - 1];
  const kind = last.kind === "time" ? "time" : "work";
  const base = last.kind === "top" ? "Resto" : last.label.replace(/\s*\d+$/, "");
  const number = rows.filter((r) => r.label.startsWith(base)).length + 1;
  return {
    ...last,
    id: last.id + 1,
    kind,
    label: `${base} ${number}`,
    done: false,
    kg: "",
    reps: "",
    minutes: "",
    dsKg: "",
    dsReps: "",
    partialsCount: "",
    rpCount: "",
    ds: false,
    partials: false,
    rp: false,
  };
}
