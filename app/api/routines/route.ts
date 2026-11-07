import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertSameOrigin, handle } from "@/lib/api";
import { ApiError, createFile, listFiles, requireSession } from "@/lib/google";
import { TEMPLATES, TEMPLATE_PROPERTY } from "@/lib/templates";

export async function GET() {
  return handle(async () => ({ files: await listFiles(await requireSession()) }));
}

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    const { template } = (await request.json()) as { template?: string };
    const found = TEMPLATES.find((t) => t.id === template);
    if (!found) throw new ApiError(400, "Plantilla desconocida");
    const data = await readFile(path.join(process.cwd(), "templates", `${found.id}.xlsx`));
    return { file: await createFile(session, found.fileName, data, { [TEMPLATE_PROPERTY]: found.id }) };
  });
}
