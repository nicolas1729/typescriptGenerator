import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generate, type GenerateOptions } from "../src/generate.js";

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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  const payload = req.body as any;
  const url = typeof payload?.url === "string" ? payload.url.trim() : "";
  // L'interface web n'accepte que des URL http(s) : pas de lecture de fichiers locaux depuis le navigateur.
  if (!/^https?:\/\//i.test(url)) {
    res.status(400).json({ error: "Veuillez saisir une URL http(s) valide." });
    return;
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
    res.status(200).json(await generate(url, options));
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
