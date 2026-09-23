#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { generate, type GenerateOptions } from "./generate.js";
import { startServer } from "./server.js";

const HELP = `
openapi-dts — génère des déclarations TypeScript (.d.ts) depuis un Swagger / OpenAPI

Usage :
  openapi-dts <url|fichier> [options]     Génère le fichier .d.ts
  openapi-dts serve [--port 3000]         Lance l'interface web locale

Options de sortie :
  -o, --output <fichier>      Fichier de sortie (défaut : ./generated/<titre-api>.d.ts)
      --stdout                Écrit le résultat sur la sortie standard
  -H, --header "Nom: valeur"  En-tête HTTP (répétable), ex. -H "Authorization: Bearer xxx"

Options openapi-typescript :
      --enum                        Vrais enums TypeScript
      --export-type                 "type" au lieu de "interface"
      --immutable                   Propriétés readonly
      --alphabetize                 Tri alphabétique
      --additional-properties       Autorise les propriétés supplémentaires
      --no-default-non-nullable     Les champs avec défaut restent optionnels
      --properties-required-by-default
      --exclude-deprecated          Ignore ce qui est déprécié
      --root-types                  Exporte chaque schéma en type de 1er niveau
      --path-params-as-types        Types littéraux pour les chemins
      --array-length                Tuples via minItems/maxItems

  -h, --help                  Affiche cette aide
`;

function parseHeaders(values: string[] | undefined): Record<string, string> | undefined {
  if (!values?.length) return undefined;
  const headers: Record<string, string> = {};
  for (const raw of values) {
    const i = raw.indexOf(":");
    if (i <= 0) throw new Error(`En-tête invalide : "${raw}" (format attendu "Nom: valeur")`);
    headers[raw.slice(0, i).trim()] = raw.slice(i + 1).trim();
  }
  return headers;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    allowNegative: true,
    options: {
      output: { type: "string", short: "o" },
      stdout: { type: "boolean" },
      header: { type: "string", short: "H", multiple: true },
      port: { type: "string", short: "p" },
      enum: { type: "boolean" },
      "export-type": { type: "boolean" },
      immutable: { type: "boolean" },
      alphabetize: { type: "boolean" },
      "additional-properties": { type: "boolean" },
      "default-non-nullable": { type: "boolean" },
      "properties-required-by-default": { type: "boolean" },
      "exclude-deprecated": { type: "boolean" },
      "root-types": { type: "boolean" },
      "path-params-as-types": { type: "boolean" },
      "array-length": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });

  const [first] = positionals;
  if (values.help || !first) {
    console.log(HELP);
    process.exit(values.help ? 0 : 1);
  }

  if (first === "serve") {
    await startServer(Number(values.port ?? process.env.PORT ?? 3000));
    return;
  }

  const options: GenerateOptions = {
    enum: values.enum,
    exportType: values["export-type"],
    immutable: values.immutable,
    alphabetize: values.alphabetize,
    additionalProperties: values["additional-properties"],
    defaultNonNullable: values["default-non-nullable"],
    propertiesRequiredByDefault: values["properties-required-by-default"],
    excludeDeprecated: values["exclude-deprecated"],
    rootTypes: values["root-types"],
    pathParamsAsTypes: values["path-params-as-types"],
    arrayLength: values["array-length"],
    headers: parseHeaders(values.header),
  };
  // Retire les options non renseignées pour garder les défauts d'openapi-typescript.
  for (const key of Object.keys(options) as (keyof GenerateOptions)[]) {
    if (options[key] === undefined) delete options[key];
  }

  const started = performance.now();
  const result = await generate(first, options);

  if (values.stdout) {
    process.stdout.write(result.code);
    return;
  }

  const outFile = resolve(values.output ?? `generated/${result.suggestedFileName}`);
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, result.code, "utf8");

  const ms = Math.round(performance.now() - started);
  const conversion = result.converted ? " → convertie en OpenAPI 3" : "";
  console.log(`✔ ${result.title} ${result.apiVersion} (spec ${result.specVersion}${conversion})`);
  console.log(`  ${result.stats.paths} chemins, ${result.stats.schemas} schémas, ${result.stats.lines} lignes — ${ms} ms`);
  console.log(`  → ${outFile}`);
}

main().catch((err: unknown) => {
  console.error(`✖ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
