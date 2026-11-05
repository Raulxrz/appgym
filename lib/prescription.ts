// Interpreta el texto de la pauta del Excel y lo convierte en series a rellenar.
export type SetKind = "top" | "work" | "time";

export type PlannedSet = {
  label: string;
  kind: SetKind;
  /** Técnicas previstas para esta serie. */
  ds: boolean;
  partials: boolean;
  rp: boolean;
};

const plain = (label: string, kind: SetKind): PlannedSet => ({ label, kind, ds: false, partials: false, rp: false });

export function parsePrescription(raw: string | undefined): PlannedSet[] {
  const text = (raw ?? "").trim().toLowerCase();
  if (!text) return [];

  const time = /^(\d+)\s*x\s*\d+(?:[.,]\d+)?\s*min/.exec(text);
  if (time) return Array.from({ length: Number(time[1]) }, (_, i) => plain(`Serie ${i + 1}`, "time"));

  const topSet = /top set:\s*(\d+)\s*x[^/]*\/\s*resto(?:\s*\d+)?:\s*(\d+)\s*x/.exec(text);
  if (topSet) {
    const tops = Number(topSet[1]);
    const rest = Number(topSet[2]);
    return [
      ...Array.from({ length: tops }, (_, i) => plain(tops > 1 ? `Top set ${i + 1}` : "Top set", "top")),
      ...Array.from({ length: rest }, (_, i) => plain(`Resto ${i + 1}`, "work")),
    ];
  }

  const series = /^(\d+)\s*x/.exec(text);
  if (!series) return [];
  const sets = Array.from({ length: Number(series[1]) }, (_, i) => plain(`Serie ${i + 1}`, "work"));
  const extras = text.slice(text.indexOf("+") + 1);
  if (!text.includes("+")) return sets;

  const onlyLast = /[uú]ltima/.test(extras);
  const apply = (key: "ds" | "partials" | "rp", lastOnly: boolean) => {
    (lastOnly ? sets.slice(-1) : sets).forEach((s) => (s[key] = true));
  };
  if (/\bds\b/.test(extras)) apply("ds", onlyLast);
  if (/parcial/.test(extras)) apply("partials", onlyLast);
  if (/\brp\b/.test(extras)) apply("rp", onlyLast);
  return sets;
}
