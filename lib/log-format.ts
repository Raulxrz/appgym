// Formato de la columna "KGs x Reps": 82.5x7 / 60x8+DS45x6+P4 / 1min
export type LoggedSet = {
  kg?: string;
  reps?: string;
  minutes?: string;
  dsKg?: string;
  dsReps?: string;
  partials?: string;
  rp?: string;
};

export type ParsedLog = { sets: (LoggedSet | null)[]; ok: boolean };

const NUM = String.raw`\d+(?:[.,]\d+)?`;
const norm = (n: string) => n.replace(",", ".");

function parseSet(token: string): LoggedSet | null | undefined {
  const text = token.trim();
  if (text === "-") return null;
  const time = new RegExp(`^(${NUM})\\s*min$`, "i").exec(text);
  if (time) return { minutes: norm(time[1]) };

  const [head, ...extras] = text.split("+").map((part) => part.trim());
  const main = new RegExp(`^(${NUM})\\s*[x×]\\s*(\\d+)$`, "i").exec(head);
  if (!main) return undefined;
  const set: LoggedSet = { kg: norm(main[1]), reps: main[2] };
  for (const extra of extras) {
    const ds = new RegExp(`^DS\\s*(${NUM})\\s*[x×]\\s*(\\d+)$`, "i").exec(extra);
    const partials = /^P\s*(\d+)$/i.exec(extra);
    const rp = /^RP\s*(\d+)$/i.exec(extra);
    if (ds) {
      set.dsKg = norm(ds[1]);
      set.dsReps = ds[2];
    } else if (partials) set.partials = partials[1];
    else if (rp) set.rp = rp[1];
    else return undefined;
  }
  return set;
}

export function parseLog(raw: string | undefined): ParsedLog {
  const text = (raw ?? "").trim();
  if (!text) return { sets: [], ok: true };
  const sets: (LoggedSet | null)[] = [];
  for (const token of text.split("/")) {
    const set = parseSet(token);
    if (set === undefined) return { sets: [], ok: false };
    sets.push(set);
  }
  return { sets, ok: true };
}

function serializeSet(set: LoggedSet): string {
  if (set.minutes) return `${norm(set.minutes)}min`;
  let text = `${norm(set.kg || "0")}x${set.reps}`;
  if (set.dsReps) text += `+DS${norm(set.dsKg || "0")}x${set.dsReps}`;
  if (set.partials) text += `+P${set.partials}`;
  if (set.rp) text += `+RP${set.rp}`;
  return text;
}

/** Las series sin hacer previas a otra hecha se guardan como "-" para no desplazar posiciones. */
export function serializeLog(sets: (LoggedSet | null)[]): string {
  const list = [...sets];
  while (list.length && list[list.length - 1] === null) list.pop();
  return list.map((set) => (set ? serializeSet(set) : "-")).join(" / ");
}
