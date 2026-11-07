import { assertSameOrigin, handle } from "@/lib/api";
import { ApiError, downloadFile, fileRevision, getFile, requireSession, uploadFile } from "@/lib/google";
import { parseRoutine, writableCells } from "@/lib/routine";
import { patchCells, readCells } from "@/lib/xlsx";

type Context = { params: Promise<{ id: string }> };

const MAX_VALUE = 300;
const MAX_CHANGES = 100;

export async function GET(_request: Request, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    const session = await requireSession();
    const [file, data] = await Promise.all([getFile(session, id), downloadFile(session, id)]);
    return { file, routine: parseRoutine(await readCells(data)) };
  });
}

export async function PATCH(request: Request, { params }: Context) {
  return handle(async () => {
    assertSameOrigin(request);
    const { id } = await params;
    const session = await requireSession();
    const { changes } = (await request.json()) as { changes?: Record<string, unknown> };
    const entries = Object.entries(changes ?? {});
    if (!entries.length || entries.length > MAX_CHANGES) throw new ApiError(400, "Cambios no válidos");
    for (const [, value] of entries) {
      if (typeof value !== "string" || value.length > MAX_VALUE) throw new ApiError(400, "Valor no válido");
    }

    // Parte siempre de la última versión de Drive y cambia solo esas celdas, así se respeta lo que
    // se haya editado en el Excel. Si el archivo cambia mientras tanto, se repite la operación.
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = await fileRevision(session, id);
      const data = await downloadFile(session, id);
      const routine = parseRoutine(await readCells(data));
      const allowed = writableCells(routine);
      for (const [cell] of entries) {
        if (!allowed.has(cell)) throw new ApiError(400, `La celda ${cell} no es de registro`);
      }
      const patched = await patchCells(data, Object.fromEntries(entries) as Record<string, string>);
      const current = await fileRevision(session, id);
      if (current.revision !== before.revision) continue;
      await uploadFile(session, id, patched);
      return { routine: parseRoutine(await readCells(patched)) };
    }
    throw new ApiError(409, "El archivo está cambiando en Drive. Se reintentará.");
  });
}
