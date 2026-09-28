import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  generateFromContent,
  generateFromDocument,
  parseDocument,
  type GenerateOptions,
  type GenerateResult,
  type SpecContent,
} from "./core.js";

export { parseDocument, type GenerateOptions, type GenerateResult, type SpecContent };

/** Normalise l'entrée : URL http(s) ou chemin de fichier local. */
export function toSourceUrl(input: string): URL {
  const trimmed = input.trim();
  if (/^(https?|file):\/\//i.test(trimmed)) return new URL(trimmed);
  return pathToFileURL(trimmed);
}

async function fetchText(source: URL, headers: Record<string, string> = {}): Promise<string> {
  if (source.protocol === "file:") return readFile(source, "utf8");
  const res = await fetch(source, {
    headers: { Accept: "application/json, application/yaml;q=0.9, */*;q=0.5", ...headers },
  });
  if (!res.ok) throw new Error(`Échec du téléchargement (${res.status} ${res.statusText}) : ${source.href}`);
  return res.text();
}

/**
 * Génère les déclarations TypeScript d'un document Swagger 2.0 / OpenAPI 3.x (JSON ou YAML)
 * avec openapi-typescript. L'entrée est une URL, un chemin local, ou un contenu brut.
 */
export async function generate(input: string | SpecContent, options: GenerateOptions = {}): Promise<GenerateResult> {
  if (typeof input !== "string") return generateFromContent(input, options);
  const source = toSourceUrl(input);
  const original = parseDocument(await fetchText(source, options.headers));
  return generateFromDocument(original, { source, options });
}
