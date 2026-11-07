// Acceso a Google con fetch: login OAuth y archivos de Drive.
import { readSession, writeSession, clearSession, type Session } from "./session";

// Permiso mínimo: solo los archivos que el usuario elige o que la app crea.
export const SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/drive.file"];
export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

// Servidor simulado para pruebas automáticas. Nunca se usa en producción.
const fake = process.env.NODE_ENV !== "production" ? process.env.GOOGLE_FAKE_BASE : undefined;
export const URLS = {
  auth: fake ? `${fake}/auth` : "https://accounts.google.com/o/oauth2/v2/auth",
  token: fake ? `${fake}/token` : "https://oauth2.googleapis.com/token",
  userinfo: fake ? `${fake}/userinfo` : "https://openidconnect.googleapis.com/v1/userinfo",
  drive: fake ? `${fake}/drive/v3` : "https://www.googleapis.com/drive/v3",
  upload: fake ? `${fake}/upload/drive/v3` : "https://www.googleapis.com/upload/drive/v3",
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const redirectUri = () => `${process.env.APP_URL}/api/auth/callback`;

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; scope?: string };

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(URLS.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...params,
    }),
  });
  if (!res.ok) throw new ApiError(res.status === 400 ? 401 : 502, "Google ha rechazado la sesión");
  return res.json();
}

export async function exchangeCode(code: string, verifier: string) {
  return tokenRequest({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirectUri() });
}

export async function fetchUser(accessToken: string): Promise<{ email: string; name?: string }> {
  const res = await fetch(URLS.userinfo, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new ApiError(502, "No se ha podido leer tu perfil de Google");
  return res.json();
}

/** Sesión actual con el token de acceso renovado si está a punto de caducar. */
export async function requireSession(): Promise<Session> {
  const session = await readSession();
  if (!session) throw new ApiError(401, "Inicia sesión para continuar");
  if (session.expiresAt - Date.now() > 60_000) return session;
  try {
    const token = await tokenRequest({ grant_type: "refresh_token", refresh_token: session.refreshToken });
    const renewed = { ...session, accessToken: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
    await writeSession(renewed);
    return renewed;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) await clearSession();
    throw error;
  }
}

/** Motivo que da Google en un error, sin registrar nada del contenido de la petición. */
async function errorReason(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  const error = body?.error;
  return error?.errors?.[0]?.reason ?? error?.details?.find((d: { reason?: string }) => d.reason)?.reason ?? error?.status ?? "desconocido";
}

async function driveFetch(session: Session, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store",
  });
  if (res.ok) return res;
  if (res.status === 401) throw new ApiError(401, "La sesión de Google ha caducado");
  if (res.status === 403) {
    const reason = await errorReason(res);
    console.error(`Drive respondió 403: ${reason}`);
    if (reason === "accessNotConfigured" || reason === "SERVICE_DISABLED") {
      throw new ApiError(503, "Google Drive API no está habilitada en el proyecto de Google Cloud de esta app.");
    }
    if (reason === "insufficientPermissions" || reason === "insufficientScopes" || reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT") {
      throw new ApiError(403, "Falta el permiso de Drive. Sal de la app y vuelve a entrar marcando la casilla de acceso a Drive.");
    }
    if (reason === "userRateLimitExceeded" || reason === "rateLimitExceeded") {
      throw new ApiError(503, "Google Drive está limitando las peticiones. Se reintentará.");
    }
    throw new ApiError(404, "La app no tiene acceso a este archivo. Vuelve a elegirlo desde Drive.");
  }
  if (res.status === 404) {
    throw new ApiError(404, "La app no tiene acceso a este archivo. Vuelve a elegirlo desde Drive.");
  }
  if (res.status === 429) throw new ApiError(503, "Google Drive está limitando las peticiones. Se reintentará.");
  throw new ApiError(502, "Google Drive no ha respondido correctamente");
}

export type DriveFile = { id: string; name: string; modifiedTime?: string; webViewLink?: string };

const assertFileId = (id: string) => {
  if (!/^[\w-]{10,200}$/.test(id)) throw new ApiError(400, "Identificador de archivo no válido");
};

export async function listFiles(session: Session): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q: `mimeType='${XLSX_MIME}' and trashed=false`,
    fields: "files(id,name,modifiedTime,webViewLink)",
    orderBy: "modifiedTime desc",
    pageSize: "50",
  });
  const res = await driveFetch(session, `${URLS.drive}/files?${params}`);
  return (await res.json()).files ?? [];
}

export async function fileRevision(session: Session, id: string): Promise<{ revision: string; size: number }> {
  assertFileId(id);
  const res = await driveFetch(session, `${URLS.drive}/files/${id}?fields=headRevisionId,size`);
  const data = await res.json();
  return { revision: data.headRevisionId ?? "", size: Number(data.size ?? 0) };
}

export async function downloadFile(session: Session, id: string): Promise<Uint8Array> {
  assertFileId(id);
  const { size } = await fileRevision(session, id);
  if (size > MAX_FILE_BYTES) throw new ApiError(413, "El archivo es demasiado grande para una rutina");
  const res = await driveFetch(session, `${URLS.drive}/files/${id}?alt=media`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function uploadFile(session: Session, id: string, data: Uint8Array) {
  assertFileId(id);
  await driveFetch(session, `${URLS.upload}/files/${id}?uploadType=media`, {
    method: "PATCH",
    headers: { "Content-Type": XLSX_MIME },
    body: Buffer.from(data),
  });
}

export async function createFile(session: Session, name: string, data: Uint8Array): Promise<DriveFile> {
  const boundary = `asymettry${crypto.randomUUID()}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, mimeType: XLSX_MIME })}\r\n` +
        `--${boundary}\r\nContent-Type: ${XLSX_MIME}\r\n\r\n`,
    ),
    Buffer.from(data),
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await driveFetch(session, `${URLS.upload}/files?uploadType=multipart&fields=id,name,modifiedTime,webViewLink`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return res.json();
}
