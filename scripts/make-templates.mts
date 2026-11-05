// Genera templates/*.xlsx a partir de los Excel originales, con los registros vacíos.
import { readFile, writeFile } from "node:fs/promises";
import { patchCells, readCells } from "../lib/xlsx";
import { parseRoutine, writableCells } from "../lib/routine";

const SOURCES = [
  ["ENTRENO 7. 31-08-2026 (2).xlsx", "templates/entreno-7.xlsx"],
  ["Copia de ENTRENO 19 ( 5 DIAS).xlsx", "templates/entreno-19.xlsx"],
];

for (const [source, target] of SOURCES) {
  const data = await readFile(source);
  const routine = parseRoutine(await readCells(data));
  const changes = Object.fromEntries([...writableCells(routine)].map((cell) => [cell, ""]));
  await writeFile(target, await patchCells(data, changes));
  console.log(`${target}: ${routine.days.length} días, ${Object.keys(changes).length} celdas de registro vacías`);
}
