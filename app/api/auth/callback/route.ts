import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, fetchUser } from "@/lib/google";
import { unseal, writeSession } from "@/lib/session";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

function sameText(a: string, b: string) {
  const [x, y] = [Buffer.from(a), Buffer.from(b)];
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(request: NextRequest) {
  const fail = (code: string) => NextResponse.redirect(`${process.env.APP_URL}/?error=${code}`);
  const jar = await cookies();
  const pending = unseal<{ state: string; verifier: string }>(jar.get("appgym_oauth")?.value ?? "");
  jar.delete({ name: "appgym_oauth", path: "/api/auth" });

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (searchParams.get("error")) return fail("cancelado");
  if (!pending || !code || !state || !sameText(state, pending.state)) return fail("sesion");

  try {
    const token = await exchangeCode(code, pending.verifier);
    // En la pantalla de Google se puede desmarcar el acceso a Drive; sin él la app no funciona.
    if (!token.scope?.split(" ").includes(DRIVE_SCOPE)) return fail("permiso");
    if (!token.refresh_token) return fail("sesion");
    const user = await fetchUser(token.access_token);
    await writeSession({
      email: user.email,
      name: user.name,
      accessToken: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000,
      refreshToken: token.refresh_token,
    });
  } catch {
    return fail("google");
  }
  return NextResponse.redirect(`${process.env.APP_URL}/`);
}
