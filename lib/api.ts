import { NextResponse } from "next/server";
import { ApiError } from "./google";
import { RoutineFormatError } from "./routine";

/** Rechaza escrituras que no vengan de la propia app (CSRF). */
export function assertSameOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") throw new ApiError(403, "Petición no permitida");
  const origin = request.headers.get("origin");
  if (origin && origin !== process.env.APP_URL) throw new ApiError(403, "Petición no permitida");
}

export async function handle(run: () => Promise<unknown>): Promise<NextResponse> {
  try {
    return NextResponse.json(await run(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof RoutineFormatError) {
      return NextResponse.json(
        { error: `Este Excel no tiene el formato de una rutina: ${error.message}.` },
        { status: 422 },
      );
    }
    console.error(error instanceof Error ? error.message : "Error desconocido");
    return NextResponse.json({ error: "Error inesperado en el servidor" }, { status: 500 });
  }
}
