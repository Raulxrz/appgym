import { assertSameOrigin, handle } from "@/lib/api";
import { clearSession } from "@/lib/session";

// No se revoca el permiso en Google: se perdería el acceso a los Excel ya elegidos y a otros dispositivos.
export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    await clearSession();
    return { ok: true };
  });
}
