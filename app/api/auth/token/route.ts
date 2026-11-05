import { assertSameOrigin, handle } from "@/lib/api";
import { requireSession } from "@/lib/google";

// El selector de Google se ejecuta en el navegador y necesita un token de acceso temporal.
export async function GET(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    return { accessToken: session.accessToken };
  });
}
