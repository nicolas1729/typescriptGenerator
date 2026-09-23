import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { generate, type GenerateOptions } from "./generate.js";

const INDEX_HTML = fileURLToPath(new URL("../public/index.html", import.meta.url));
const MAX_BODY = 64 * 1024;

const BOOLEAN_OPTIONS = [
  "enum",
  "exportType",
  "immutable",
  "alphabetize",
  "additionalProperties",
  "defaultNonNullable",
  "propertiesRequiredByDefault",
  "excludeDeprecated",
  "rootTypes",
  "pathParamsAsTypes",
  "arrayLength",
] as const;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("Requête trop volumineuse.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function handleGenerate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let payload: any;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: "Corps JSON invalide." });
  }

  const url = typeof payload?.url === "string" ? payload.url.trim() : "";
  // L'interface web n'accepte que des URL http(s) : pas de lecture de fichiers locaux depuis le navigateur.
  if (!/^https?:\/\//i.test(url)) {
    return sendJson(res, 400, { error: "Veuillez saisir une URL http(s) valide." });
  }

  const options: GenerateOptions = {};
  for (const key of BOOLEAN_OPTIONS) {
    if (typeof payload.options?.[key] === "boolean") options[key] = payload.options[key];
  }
  if (payload.headers && typeof payload.headers === "object") {
    const headers = Object.fromEntries(
      Object.entries(payload.headers).filter(([k, v]) => k.trim() && typeof v === "string"),
    ) as Record<string, string>;
    if (Object.keys(headers).length) options.headers = headers;
  }

  try {
    sendJson(res, 200, await generate(url, options));
  } catch (err) {
    sendJson(res, 422, { error: err instanceof Error ? err.message : String(err) });
  }
}

export function startServer(port = 3000, host = "127.0.0.1"): Promise<void> {
  const server = createServer(async (req, res) => {
    try {
      if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(await readFile(INDEX_HTML));
        return;
      }
      if (req.method === "POST" && req.url === "/api/generate") {
        await handleGenerate(req, res);
        return;
      }
      sendJson(res, 404, { error: "Introuvable." });
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  return new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    // Écoute uniquement en local : le serveur télécharge des URL arbitraires.
    server.listen(port, host, () => {
      console.log(`Interface disponible sur http://localhost:${port}`);
      resolvePromise();
    });
  });
}
