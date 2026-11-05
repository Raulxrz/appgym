// Lectura y edición de .xlsx tocando solo las celdas necesarias del XML.
// Así se conservan estilos, anchos de columna y tablas, que una librería que
// reescribe el libro entero podría perder.
import JSZip from "jszip";

const CELL_RE = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
const ROW_RE = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;

export type Cells = Map<string, string>;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isNaN(point) ? whole : String.fromCodePoint(point);
    }
    return ENTITIES[code] ?? whole;
  });
}

function escapeXml(text: string): string {
  return text
    // Caracteres de control no válidos en XML 1.0
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function attr(attrs: string, name: string): string | undefined {
  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
}

function textRuns(xml: string): string {
  const withoutPhonetic = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  return [...withoutPhonetic.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join("");
}

function splitCoord(coord: string): { column: string; row: number } {
  const match = /^([A-Z]{1,3})([1-9]\d*)$/.exec(coord);
  if (!match) throw new Error(`Celda no válida: ${coord}`);
  return { column: match[1], row: Number(match[2]) };
}

export function columnIndex(column: string): number {
  return [...column].reduce((sum, ch) => sum * 26 + ch.charCodeAt(0) - 64, 0);
}

export function columnName(index: number): string {
  let name = "";
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

async function firstSheetPath(zip: JSZip): Promise<string> {
  const workbook = await zip.file("xl/workbook.xml")?.async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!workbook || !rels) throw new Error("El archivo no es un Excel válido");
  const sheets = [...workbook.matchAll(/<sheet\b([^>]*?)\/?>/g)].map((m) => m[1]);
  const sheet = sheets.find((s) => (attr(s, "state") ?? "visible") === "visible");
  const relId = sheet && attr(sheet, "r:id");
  if (!relId) throw new Error("El Excel no tiene hojas visibles");
  for (const m of rels.matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    if (attr(m[1], "Id") !== relId) continue;
    const target = attr(m[1], "Target") ?? "";
    return target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  }
  throw new Error("No se encuentra la hoja del Excel");
}

export async function readCells(data: Uint8Array): Promise<Cells> {
  const zip = await JSZip.loadAsync(data);
  const xml = await zip.file(await firstSheetPath(zip))?.async("string");
  if (!xml) throw new Error("No se puede leer la hoja del Excel");
  const sharedXml = await zip.file("xl/sharedStrings.xml")?.async("string");
  const shared = sharedXml ? [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textRuns(m[1])) : [];

  const cells: Cells = new Map();
  for (const m of xml.matchAll(CELL_RE)) {
    const coord = attr(m[1], "r");
    const body = m[2];
    if (!coord || !body) continue;
    const type = attr(m[1], "t");
    let value: string;
    if (type === "inlineStr") value = textRuns(body);
    else {
      const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1];
      if (raw === undefined) continue;
      value = type === "s" ? (shared[Number(raw)] ?? "") : decode(raw);
    }
    if (value !== "") cells.set(coord, value);
  }
  return cells;
}

function renderCell(coord: string, style: string | undefined, value: string): string {
  const s = style === undefined ? "" : ` s="${style}"`;
  if (value === "") return `<c r="${coord}"${s}/>`;
  return `<c r="${coord}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function patchRowBody(body: string, coord: string, value: string): string {
  const target = columnIndex(splitCoord(coord).column);
  let insertAt = body.length;
  let leftStyle: string | undefined;
  for (const m of body.matchAll(CELL_RE)) {
    const cellCoord = attr(m[1], "r");
    if (!cellCoord) continue;
    const column = columnIndex(splitCoord(cellCoord).column);
    if (column === target) {
      return body.slice(0, m.index) + renderCell(coord, attr(m[1], "s"), value) + body.slice(m.index + m[0].length);
    }
    if (column > target) {
      insertAt = m.index;
      break;
    }
    leftStyle = attr(m[1], "s");
  }
  // Celda nueva: hereda el estilo de su vecina para no romper el aspecto de la fila.
  return body.slice(0, insertAt) + renderCell(coord, leftStyle, value) + body.slice(insertAt);
}

function patchSheet(xml: string, coord: string, value: string): string {
  const { row } = splitCoord(coord);
  let insertAt: number | undefined;
  for (const m of xml.matchAll(ROW_RE)) {
    const rowNumber = Number(attr(m[1], "r"));
    if (rowNumber === row) {
      const body = patchRowBody(m[2] ?? "", coord, value);
      return `${xml.slice(0, m.index)}<row${m[1]}>${body}</row>${xml.slice(m.index + m[0].length)}`;
    }
    if (rowNumber > row) {
      insertAt = m.index;
      break;
    }
  }
  const newRow = `<row r="${row}">${renderCell(coord, undefined, value)}</row>`;
  if (insertAt !== undefined) return xml.slice(0, insertAt) + newRow + xml.slice(insertAt);
  if (xml.includes("<sheetData/>")) return xml.replace("<sheetData/>", `<sheetData>${newRow}</sheetData>`);
  return xml.replace("</sheetData>", `${newRow}</sheetData>`);
}

export async function patchCells(data: Uint8Array, changes: Record<string, string>): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(data);
  const path = await firstSheetPath(zip);
  let xml = await zip.file(path)?.async("string");
  if (!xml) throw new Error("No se puede leer la hoja del Excel");
  for (const [coord, value] of Object.entries(changes)) xml = patchSheet(xml, coord, value);
  zip.file(path, xml, { createFolders: false });
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
