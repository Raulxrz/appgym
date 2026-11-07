// Sesión sin base de datos: los tokens de Google viajan en una cookie cifrada que el navegador no puede leer.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export type Session = {
  email: string;
  name?: string;
  accessToken: string;
  /** Instante de caducidad en milisegundos. */
  expiresAt: number;
  refreshToken: string;
};

const COOKIE = "asymettry_session";
const MAX_AGE = 60 * 60 * 24 * 180;

function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET debe tener al menos 32 caracteres");
  return Buffer.from(hkdfSync("sha256", secret, "asymettry", "session-cookie", 32));
}

export function seal(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function unseal<T>(token: string): T | null {
  try {
    const raw = Buffer.from(token, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")) as T;
  } catch {
    return null;
  }
}

export const secureCookies = () => (process.env.APP_URL ?? "").startsWith("https://");

export async function readSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? unseal<Session>(token) : null;
}

export async function writeSession(session: Session) {
  (await cookies()).set(COOKIE, seal(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}
