import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SCOPES, URLS, redirectUri } from "@/lib/google";
import { seal, secureCookies } from "@/lib/session";

export async function GET() {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  (await cookies()).set("asymettry_oauth", seal({ state, verifier }), {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/api/auth",
    maxAge: 600,
  });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    // Necesario para recibir el token que mantiene la sesión durante el entreno.
    access_type: "offline",
    prompt: "consent",
  });
  return NextResponse.redirect(`${URLS.auth}?${params}`);
}
