import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dayParts, dayTitle, microcycleLabel, pretty } from "../lib/labels";
import { parseRoutine, type Routine } from "../lib/routine";
import {
  defaultRest,
  isValidSchedule,
  parseDate,
  plannedSessions,
  scheduleFromProperties,
  scheduleToProperties,
  todayPlan,
  trainingDays,
} from "../lib/schedule";
import { TEMPLATES, templateOf } from "../lib/templates";
import { readCells } from "../lib/xlsx";

const load = async (id: string): Promise<Routine> =>
  parseRoutine(await readCells(new Uint8Array(await readFile(path.join(__dirname, "..", "templates", `${id}.xlsx`)))));

describe("calendario", () => {
  it("propone los descansos del Excel a partir del día de inicio", async () => {
    const seven = await load("entreno-7");
    const nineteen = await load("entreno-19");
    const monday = parseDate("2026-11-09")!;
    // Entreno 7: entreno, entreno, descanso, entreno, entreno, descanso, entreno.
    expect(defaultRest(seven, monday)).toEqual([2, 5]);
    // Entreno 19: cinco días seguidos y descanso el fin de semana.
    expect(defaultRest(nineteen, monday)).toEqual([5, 6]);
    // Empezando en miércoles, los descansos se desplazan con el inicio.
    expect(defaultRest(seven, parseDate("2026-11-11")!)).toEqual([0, 4]);
  });

  it("reparte los días de entreno en orden saltando los descansos", async () => {
    const routine = await load("entreno-7");
    const training = trainingDays(routine);
    expect(training).toHaveLength(5);
    const sessions = plannedSessions(routine, { start: "2026-11-09", rest: [2, 5] });
    expect(sessions).toHaveLength(5 * routine.microcycles.length);
    expect(sessions.slice(0, 6)).toEqual([
      { date: "2026-11-09", microcycle: 0, day: training[0] },
      { date: "2026-11-10", microcycle: 0, day: training[1] },
      { date: "2026-11-12", microcycle: 0, day: training[2] },
      { date: "2026-11-13", microcycle: 0, day: training[3] },
      { date: "2026-11-15", microcycle: 0, day: training[4] },
      { date: "2026-11-16", microcycle: 1, day: training[0] },
    ]);
  });

  it("sabe si hoy toca entrenar, descansar o aún no ha empezado", async () => {
    const routine = await load("entreno-19");
    const schedule = { start: "2026-11-09", rest: [5, 6] };
    expect(todayPlan(routine, schedule, parseDate("2026-11-08")!)).toEqual({ kind: "before", start: "2026-11-09" });
    expect(todayPlan(routine, schedule, parseDate("2026-11-14")!)).toEqual({ kind: "rest" });
    expect(todayPlan(routine, schedule, parseDate("2026-11-11")!)).toMatchObject({ kind: "train", session: { microcycle: 0 } });
  });

  it("valida y guarda el calendario en las propiedades de Drive", () => {
    expect(isValidSchedule({ start: "2026-11-09", rest: [2, 5] })).toBe(true);
    expect(isValidSchedule({ start: "2026-02-30", rest: [] })).toBe(false);
    expect(isValidSchedule({ start: "2026-11-09", rest: [0, 1, 2, 3, 4, 5, 6] })).toBe(false);
    expect(isValidSchedule({ start: "2026-11-09", rest: [7] })).toBe(false);
    const props = scheduleToProperties({ start: "2026-11-09", rest: [5, 2] });
    expect(props).toEqual({ asymettryStart: "2026-11-09", asymettryRest: "2,5" });
    expect(scheduleFromProperties(props)).toEqual({ start: "2026-11-09", rest: [2, 5] });
    expect(scheduleFromProperties({ asymettryStart: "2026-11-09", asymettryRest: "" })).toEqual({ start: "2026-11-09", rest: [] });
    expect(scheduleFromProperties(undefined)).toBeNull();
  });
});

describe("nombres", () => {
  it("convierte los textos del Excel en títulos legibles", async () => {
    const routine = await load("entreno-7");
    expect(pretty("PRES BANCA")).toBe("Pres banca");
    expect(pretty("Press banca")).toBe("Press banca");
    expect(microcycleLabel("MICROCICLO 1")).toBe("Microciclo 1");
    expect(dayParts("Día 1: PULL ( ISQUIOS, ESPALDA, HOMBRO POSTERIOR,BICEPS)")).toEqual({
      focus: "Pull",
      muscles: "Isquios, espalda, hombro posterior, biceps",
    });
    // Los días se numeran contando solo los de entreno.
    expect(dayTitle(routine, trainingDays(routine)[2])).toBe("Día 3 · Legs");
  });

  it("reconoce la plantilla por las propiedades o por el nombre antiguo", () => {
    expect(templateOf({ name: "x.xlsx", appProperties: { asymettryTemplate: "entreno-19" } })?.number).toBe("Entreno 2");
    expect(templateOf({ name: "ENTRENO 7 (AppGym).xlsx" })?.number).toBe("Entreno 1");
    expect(templateOf({ name: TEMPLATES[1].fileName })?.id).toBe("entreno-19");
    expect(templateOf({ name: "Mi rutina.xlsx" })).toBeUndefined();
  });
});
