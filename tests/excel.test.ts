import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { patchCells, readCells } from "@/lib/xlsx";
import { nextPosition, parseExerciseName, parseRoutine, previousLog, writableCells } from "@/lib/routine";
import { parsePrescription } from "@/lib/prescription";
import { parseLog, serializeLog } from "@/lib/log-format";

const E7 = "templates/entreno-7.xlsx";
const E19 = "templates/entreno-19.xlsx";
const ORIGINALS = ["ENTRENO 7. 31-08-2026 (2).xlsx", "Copia de ENTRENO 19 ( 5 DIAS).xlsx"];

async function sheetXml(data: Uint8Array) {
  return (await JSZip.loadAsync(data)).file("xl/worksheets/sheet1.xml")!.async("string");
}

/** Convierte un libro de cadenas en línea al formato sharedStrings que usan Excel y Google. */
async function toSharedStrings(data: Uint8Array) {
  const zip = await JSZip.loadAsync(data);
  const xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  const strings: string[] = [];
  const converted = xml.replace(/ t="inlineStr"><is>(<t[^>]*>[\s\S]*?<\/t>)<\/is>/g, (_, t) => {
    strings.push(`<si>${t}</si>`);
    return ` t="s"><v>${strings.length - 1}</v>`;
  });
  zip.file("xl/worksheets/sheet1.xml", converted);
  zip.file("xl/sharedStrings.xml", `<sst>${strings.join("")}</sst>`);
  return zip.generateAsync({ type: "uint8array" });
}

describe("rutinas reales", () => {
  it("ENTRENO 7: días, descansos y columnas", async () => {
    const r = parseRoutine(await readCells(await readFile(E7)));
    expect(r.microcycles.map((m) => m.label)).toEqual(["MICROCICLO 1", "MICROCICLO 2", "MICROCICLO 3", "MICROCICLO 4", "MICROCICLO 5", "DESCARGA"]);
    expect(r.microcycles.map((m) => m.logColumn)).toEqual(["C", "E", "G", "I", "K", "M"]);
    expect(r.days.map((d) => d.rest)).toEqual([false, false, true, false, false, true, false]);
    expect(r.days[0].exercises).toHaveLength(9);
    expect(r.days[0].exercises[0].slots[1]).toMatchObject({ pauta: "3x?(fallo)+DS  ultima", logCell: "E2" });
  });

  it("ENTRENO 19: nombres, volumen y ejercicios sin pauta", async () => {
    const r = parseRoutine(await readCells(await readFile(E19)));
    expect(r.days.map((d) => d.name)).toEqual(["Día 1: PUSH + BRAZO", "Día 2: LEG 1", "Día 3: TIRON + BRAZO", "Día 5:TORSO", "Día 5: LEG 2", "Rest"]);
    expect(r.volume).toHaveLength(8);
    const triceps = r.days[2].exercises.find((e) => e.name.startsWith("TRICEPS DES DE POLEA"))!;
    expect(triceps.slots[1].pauta).toBeUndefined();
    expect(r.days[0].exercises[0].targets).toEqual(["8-11", "11-16"]);
  });

  it("todas las pautas reales se convierten en series", async () => {
    for (const path of [E7, E19]) {
      const r = parseRoutine(await readCells(await readFile(path)));
      for (const e of r.days.flatMap((d) => d.exercises)) {
        for (const s of e.slots) {
          if (s.pauta) expect(parsePrescription(s.pauta).length, `${e.name}: ${s.pauta}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("las plantillas no contienen registros y los originales conservan las pautas", async () => {
    const original = parseRoutine(await readCells(await readFile(ORIGINALS[1])));
    expect(original.days[0].exercises[0].slots[0].log).toBe("50x5 / 50x10 / 50x15");
    const template = parseRoutine(await readCells(await readFile(E19)));
    expect(template.days.flatMap((d) => d.exercises).flatMap((e) => e.slots).filter((s) => s.log)).toEqual([]);
    expect(template.days[0].exercises[0].slots[0].pauta).toBe(original.days[0].exercises[0].slots[0].pauta);
  });
});

describe("escritura en el Excel", () => {
  it("cambia solo las celdas pedidas y conserva el resto", async () => {
    const data = await readFile(ORIGINALS[0]);
    const before = await readCells(data);
    const after = await readCells(await patchCells(data, { C2: "60x8 / 60x7+DS45x6", M3: "40x10 & <ok>" }));
    expect(after.get("C2")).toBe("60x8 / 60x7+DS45x6");
    expect(after.get("M3")).toBe("40x10 & <ok>");
    const untouched = new Map([...after].filter(([k]) => k !== "C2" && k !== "M3"));
    expect(untouched).toEqual(before);
  });

  it("conserva los estilos y el resto de archivos del libro", async () => {
    const data = await readFile(ORIGINALS[1]);
    const out = await patchCells(data, { C3: "80x7" });
    const [a, b] = await Promise.all([JSZip.loadAsync(data), JSZip.loadAsync(out)]);
    expect(Object.keys(b.files).sort()).toEqual(Object.keys(a.files).sort());
    for (const f of ["xl/styles.xml", "xl/tables/table1.xml", "xl/workbook.xml"]) {
      expect(await b.file(f)!.async("string")).toBe(await a.file(f)!.async("string"));
    }
    const xml = await sheetXml(out);
    const original = await sheetXml(data);
    const style = (x: string, c: string) => new RegExp(`<c r="${c}"[^>]*? s="(\\d+)"`).exec(x)?.[1];
    expect(style(xml, "C3")).toBe(style(original, "C3"));
    expect(xml.indexOf('r="B3"')).toBeLessThan(xml.indexOf('r="C3"'));
    expect(xml.indexOf('r="C3"')).toBeLessThan(xml.indexOf('r="D3"'));
  });

  it("funciona con sharedStrings y al vaciar una celda", async () => {
    const shared = await toSharedStrings(await readFile(ORIGINALS[1]));
    const before = await readCells(shared);
    expect(before.get("A1")).toBe("Día 1: PUSH + BRAZO");
    expect(before.get("C2")).toBe("50x5 / 50x10 / 50x15");
    const after = await readCells(await patchCells(shared, { C2: "" , C3: "70x8" }));
    expect(after.has("C2")).toBe(false);
    expect(after.get("C3")).toBe("70x8");
    expect(after.get("A1")).toBe("Día 1: PUSH + BRAZO");
  });

  it("solo permite escribir celdas de registro", async () => {
    const r = parseRoutine(await readCells(await readFile(E7)));
    const w = writableCells(r);
    expect(w.has("C2")).toBe(true);
    expect(w.has("M47")).toBe(true);
    for (const c of ["A2", "B2", "C1", "N2", "C11", "C48"]) expect(w.has(c), c).toBe(false);
  });
});

describe("pautas", () => {
  it("top set y resto", () => {
    expect(parsePrescription("top set: 1x?(0)/ resto: 2x?(0)").map((s) => s.label)).toEqual(["Top set", "Resto 1", "Resto 2"]);
    expect(parsePrescription("top set: 1x?(1)/ resto 1: 1x?(1)").map((s) => s.label)).toEqual(["Top set", "Resto 1"]);
    expect(parsePrescription("top set: 2x?(0)/ resto: 2x?(0)")).toHaveLength(4);
  });
  it("técnicas por serie", () => {
    const last = (t: string) => parsePrescription(t).map((s) => [s.ds, s.partials, s.rp]);
    expect(last("3x?(fallo)+DS  ultima")).toEqual([[false, false, false], [false, false, false], [true, false, false]]);
    expect(last("2x(fallo) +DS en la ultima")).toEqual([[false, false, false], [true, false, false]]);
    expect(last("2x?(fallo) + DS EN TODAS")).toEqual([[true, false, false], [true, false, false]]);
    expect(last("2x?(fallo) + 1 DS en cada serie")).toEqual([[true, false, false], [true, false, false]]);
    expect(last("2x?(fallo) + 1 DS en la última serie")).toEqual([[false, false, false], [true, false, false]]);
    expect(last("3x(fallo) + parciales")[0]).toEqual([false, true, false]);
    expect(last("3x?(fallo) + 1 parciales al fallo en cada serie")[2]).toEqual([false, true, false]);
    expect(last("3x?(fallo)+RP ultima")).toEqual([[false, false, false], [false, false, false], [false, false, true]]);
  });
  it("tiempo y texto desconocido", () => {
    expect(parsePrescription("3x1min").map((s) => s.kind)).toEqual(["time", "time", "time"]);
    expect(parsePrescription("lo que salga")).toEqual([]);
    expect(parsePrescription(undefined)).toEqual([]);
  });
});

describe("registro kg x reps", () => {
  it("ida y vuelta", () => {
    for (const text of ["50x5 / 50x10 / 50x15", "82.5x7 / 70x11", "60x8+DS45x6+P4", "60x8+RP3 / 1min", "- / 70x11", "0x10"]) {
      const parsed = parseLog(text);
      expect(parsed.ok, text).toBe(true);
      expect(serializeLog(parsed.sets)).toBe(text);
    }
  });
  it("acepta coma decimal y marca texto libre sin romperlo", () => {
    expect(parseLog("82,5x7").sets[0]).toEqual({ kg: "82.5", reps: "7" });
    expect(parseLog("80 kg al fallo").ok).toBe(false);
  });
  it("no deja guiones sobrantes al final", () => {
    expect(serializeLog([{ kg: "50", reps: "5" }, null, null])).toBe("50x5");
    expect(serializeLog([null, null])).toBe("");
  });
});

describe("nombres", () => {
  it("separa nombre, objetivos y notas aunque falten paréntesis o espacios", () => {
    expect(parseExerciseName("CURL CON BARRAtop set: 6-8 reps) (resto: 10-12 reps)")).toEqual({ name: "CURL CON BARRA", targets: ["6-8", "10-12"] });
    expect(parseExerciseName("PRES 60 GRADOS EN MP top set: 6-8 reps) (resto: 10-12 reps)").name).toBe("PRES 60 GRADOS EN MP");
    expect(parseExerciseName("BENT OVER CON MANCUERNAS 8-10 REPS*(barra)")).toEqual({ name: "BENT OVER CON MANCUERNAS", targets: ["8-10"], note: "barra" });
    expect(parseExerciseName("PLANCHA ABDOMINAL ")).toEqual({ name: "PLANCHA ABDOMINAL", targets: [] });
  });
});

describe("posición y sesión anterior", () => {
  it("propone el primer hueco y encuentra el registro anterior", async () => {
    const r = parseRoutine(await readCells(await readFile(E19)));
    expect(nextPosition(r)).toEqual({ microcycle: 0, day: 0 });
    for (const e of r.days[0].exercises) e.slots[0].log = "50x5";
    expect(nextPosition(r)).toEqual({ microcycle: 0, day: 1 });
    const first = r.days[0].exercises[0];
    expect(previousLog(first, 2)).toEqual({ microcycle: 0, log: "50x5" });
    expect(previousLog(first, 0)).toBeUndefined();
  });
});
