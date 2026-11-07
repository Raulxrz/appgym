// Servidor que imita a Google para probar el flujo completo sin credenciales reales.
import http from "node:http";

const PORT = Number(process.env.FAKE_PORT ?? 4010);
const ACCESS_TTL = Number(process.env.FAKE_TTL ?? 3600);
const files = new Map();
let seq = 0;
let accessCounter = 0;
const failNext = { upload: 0 };

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
const read = (req) => new Promise((resolve) => {
  const parts = [];
  req.on("data", (d) => parts.push(d));
  req.on("end", () => resolve(Buffer.concat(parts)));
});
const revoked = new Set();
const authed = (req) => /^Bearer access-\d+$/.test(req.headers.authorization ?? "") && !revoked.has(req.headers.authorization);

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  if (path === "/auth") {
    const target = new URL(url.searchParams.get("redirect_uri"));
    target.searchParams.set("code", "code-ok");
    target.searchParams.set("state", url.searchParams.get("state"));
    res.writeHead(302, { Location: target.toString() });
    return res.end();
  }
  if (path === "/token") {
    const form = new URLSearchParams((await read(req)).toString());
    if (form.get("grant_type") === "refresh_token" && form.get("refresh_token") !== "refresh-1") return json(res, 400, { error: "invalid_grant" });
    if (form.get("grant_type") === "authorization_code" && !form.get("code_verifier")) return json(res, 400, { error: "missing_verifier" });
    return json(res, 200, {
      access_token: `access-${++accessCounter}`,
      expires_in: ACCESS_TTL,
      refresh_token: form.get("grant_type") === "authorization_code" ? "refresh-1" : undefined,
      scope: "openid email profile https://www.googleapis.com/auth/drive.file",
    });
  }
  if (path === "/userinfo") return json(res, 200, { email: "prueba@gmail.com", name: "Persona de prueba" });

  // Controles de prueba, sin autenticación.
  if (path === "/__control/fail-upload") { failNext.upload = Number(url.searchParams.get("n")); return json(res, 200, {}); }
  if (path === "/__control/stats") return json(res, 200, { accessCounter });
  if (path.startsWith("/__control/file/")) {
    const file = files.get(path.split("/").pop());
    if (!file) return json(res, 404, {});
    res.writeHead(200);
    return res.end(file.data);
  }
  if (path === "/__control/list") return json(res, 200, [...files.values()].map((f) => ({ id: f.id, name: f.name })));

  if (!authed(req)) return json(res, 401, { error: "unauthorized" });

  const fileMatch = /^\/drive\/v3\/files\/([\w-]+)$/.exec(path);
  if (path === "/drive/v3/files") {
    return json(res, 200, { files: [...files.values()].map(({ id, name, appProperties }) => ({ id, name, appProperties, modifiedTime: new Date().toISOString() })) });
  }
  if (fileMatch) {
    const file = files.get(fileMatch[1]);
    if (!file) return json(res, 404, {});
    if (req.method === "PATCH") {
      const { appProperties } = JSON.parse((await read(req)).toString("utf8"));
      file.appProperties = { ...file.appProperties, ...appProperties };
      return json(res, 200, { id: file.id, name: file.name, appProperties: file.appProperties });
    }
    if (url.searchParams.get("fields")?.includes("appProperties")) {
      return json(res, 200, { id: file.id, name: file.name, appProperties: file.appProperties });
    }
    if (url.searchParams.get("alt") === "media") {
      res.writeHead(200);
      return res.end(file.data);
    }
    return json(res, 200, { headRevisionId: `rev-${file.rev}`, size: String(file.data.length) });
  }
  if (path === "/upload/drive/v3/files" && req.method === "POST") {
    const body = await read(req);
    const boundary = /boundary=(.+)$/.exec(req.headers["content-type"])[1];
    const text = body.toString("latin1");
    const parts = text.split(`--${boundary}`);
    const meta = JSON.parse(Buffer.from(parts[1].split("\r\n\r\n")[1].trim(), "latin1").toString("utf8"));
    const content = parts[2].slice(parts[2].indexOf("\r\n\r\n") + 4, -2);
    const id = `file-${String(++seq).padStart(12, "0")}`;
    files.set(id, { id, name: meta.name, appProperties: meta.appProperties, data: Buffer.from(content, "latin1"), rev: 1 });
    return json(res, 200, { id, name: meta.name, appProperties: meta.appProperties });
  }
  const uploadMatch = /^\/upload\/drive\/v3\/files\/([\w-]+)$/.exec(path);
  if (uploadMatch && req.method === "PATCH") {
    const body = await read(req);
    if (failNext.upload > 0) { failNext.upload--; return json(res, 503, {}); }
    const file = files.get(uploadMatch[1]);
    if (!file) return json(res, 404, {});
    file.data = body;
    file.rev++;
    return json(res, 200, { id: file.id });
  }
  json(res, 404, {});
}).listen(PORT, () => console.log(`fake google on ${PORT}`));
