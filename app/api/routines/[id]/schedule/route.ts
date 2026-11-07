import { assertSameOrigin, handle } from "@/lib/api";
import { ApiError, requireSession, setAppProperties } from "@/lib/google";
import { isValidSchedule, scheduleToProperties } from "@/lib/schedule";

type Context = { params: Promise<{ id: string }> };

/** Guarda la fecha de inicio y los días de descanso en las propiedades del archivo de Drive. */
export async function PUT(request: Request, { params }: Context) {
  return handle(async () => {
    assertSameOrigin(request);
    const { id } = await params;
    const session = await requireSession();
    const { schedule } = (await request.json()) as { schedule?: unknown };
    if (!isValidSchedule(schedule)) throw new ApiError(400, "Calendario no válido");
    return { file: await setAppProperties(session, id, scheduleToProperties(schedule)) };
  });
}
