import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { stringify as stringifyYaml } from "yaml";
// @ts-expect-error script JS sans déclarations de types
import { webBuildOptions } from "../scripts/build-web.mjs";
import { generate, type GenerateOptions, type SpecContent } from "../src/generate.js";
import { openapi3, swagger2 } from "./fixtures.js";

type Browser = typeof import("../src/browser.js");

/** Swagger 2.0 avec des cas qui passent par les shims (url.parse, STATUS_CODES). */
const swagger2Edge = {
  ...swagger2,
  schemes: ["https"],
  paths: {
    "/users": {
      get: {
        schemes: ["http"],
        responses: { "404": {}, "200": { description: "ok", schema: { $ref: "#/definitions/User" } } },
      },
    },
  },
};

const cases: [string, SpecContent, GenerateOptions][] = [
  ["OpenAPI 3 JSON", { content: JSON.stringify(openapi3), fileName: "a.json" }, {}],
  ["OpenAPI 3 avec options", { content: JSON.stringify(openapi3), fileName: "a.json" }, {
    enum: true, rootTypes: true, immutable: true, exportType: true, alphabetize: true, additionalProperties: true,
    propertiesRequiredByDefault: true, pathParamsAsTypes: true, arrayLength: true, defaultNonNullable: false,
  }],
  ["Swagger 2.0 YAML", { content: stringifyYaml(swagger2), fileName: "legacy.yaml" }, {}],
  ["Swagger 2.0 cas limites", { content: JSON.stringify(swagger2Edge), fileName: "edge.json" }, {}],
  ["sans info.title", { content: JSON.stringify({ ...openapi3, info: undefined }), fileName: "Mon API.yml" }, {}],
];

describe("bundle navigateur (public/generator.js)", () => {
  let dir: string;
  let browser: Browser;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "openapi-dts-web-"));
    const outfile = join(dir, "generator.mjs");
    await build({ ...webBuildOptions, outfile, logLevel: "error" });
    browser = await import(pathToFileURL(outfile).href);
  });

  after(() => rm(dir, { recursive: true, force: true }));

  /** Exécute le bundle sans le `Buffer` global de Node, absent des navigateurs. */
  async function withoutBuffer<T>(fn: () => Promise<T>): Promise<T> {
    const saved = globalThis.Buffer;
    // @ts-expect-error suppression volontaire du global Node
    delete globalThis.Buffer;
    try {
      return await fn();
    } finally {
      globalThis.Buffer = saved;
    }
  }

  for (const [name, input, options] of cases) {
    it(`produit le même résultat que Node : ${name}`, async () => {
      const expected = await generate(input, options);
      assert.deepEqual(await withoutBuffer(() => browser.generateFromContent(input, options)), expected);
    });
  }

  it("rejette un contenu invalide", async () => {
    const input = { content: "{ pas du json", fileName: "x.json" };
    await assert.rejects(withoutBuffer(() => browser.generateFromContent(input)), /JSON|YAML/);
  });
});
