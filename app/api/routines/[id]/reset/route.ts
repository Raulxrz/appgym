import { assertSameOrigin, handle } from "@/lib/api";
import { ApiError, downloadFile, fileRevision, getFile, requireSession, setAppProperties, uploadFile } from "@/lib/google";
import { loggedCells, parseRoutine } from "@/lib/routine";
import { parseDate, scheduleFromProperties, scheduleToProperties } from "@/lib/schedule";
import { patchCells, readCells } from "@/lib/xlsx";

type Context = { params: Promise<{ id: string }> };

/** Borra todo lo apuntado en el Excel y hace que el calendario vuelva a empezar en `today`. */
export async function POST(request: Request, { params }: Context) {
  return handle(async () => {
    assertSameOrigin(request);
    const { id } = await params;
    const session = await requireSession();
    const { today } = (await request.json()) as { today?: unknown };
    // La fecha la manda el navegador porque el servidor puede estar en otra zona horaria.
    if (typeof today !== "string" || !parseDate(today)) throw new ApiError(400, "Fecha no válida");

    for (let attempt = 0; attempt < 3; attempt++) {
      const before = await fileRevision(session, id);
      const data = await downloadFile(session, id);
      const routine = parseRoutine(await readCells(data));
      const cells = loggedCells(routine);
      const patched = cells.length ? await patchCells(data, Object.fromEntries(cells.map((cell) => [cell, ""]))) : data;
      const current = await fileRevision(session, id);
      if (current.revision !== before.revision) continue;
      if (cells.length) await uploadFile(session, id, patched);

      let file = await getFile(session, id);
      const schedule = scheduleFromProperties(file.appProperties);
      // Un inicio ya pasado dejaría el primer día como atrasado. Si aún no ha llegado, se respeta.
      if (schedule && schedule.start < today) file = await setAppProperties(session, id, scheduleToProperties({ ...schedule, start: today }));
      return { file, routine: parseRoutine(await readCells(patched)) };
    }
    throw new ApiError(409, "El archivo está cambiando en Drive. Vuelve a intentarlo.");
  });
}
