import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { stringify as stringifyYaml } from "yaml";
import { generate } from "../src/generate.js";
import { openapi3, swagger2 } from "./fixtures.js";

/** Vérifie que le code généré compile réellement comme un fichier .d.ts */
async function assertValidDts(code: string): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "openapi-dts-"));
  const file = join(dir, "api.d.ts");
  await writeFile(file, code, "utf8");
  const program = ts.createProgram([file], { strict: true, noEmit: true, types: [] });
  const diagnostics = ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  assert.deepEqual(diagnostics, []);
}

describe("generate", () => {
  let server: Server;
  let base: string;

  before(async () => {
    server = createServer((req, res) => {
      if (req.url === "/private.json" && req.headers.authorization !== "Bearer secret") {
        res.writeHead(401).end();
        return;
      }
      const body = req.url === "/swagger.json" ? swagger2 : req.url?.endsWith(".json") ? openapi3 : null;
      if (!body) return void res.writeHead(404).end();
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(body));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const addr = server.address();
    base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  });

  after(() => server.close());

  it("génère un .d.ts valide depuis une URL OpenAPI 3", async () => {
    const r = await generate(`${base}/openapi.json`);
    assert.equal(r.converted, false);
    assert.equal(r.specVersion, "3.0.3");
    assert.equal(r.suggestedFileName, "demo-boutique.d.ts");
    assert.deepEqual({ paths: r.stats.paths, schemas: r.stats.schemas }, { paths: 1, schemas: 1 });
    assert.match(r.code, /export interface paths/);
    assert.match(r.code, /Pet: \{/);
    assert.match(r.code, /"available" \| "sold"/);
    await assertValidDts(r.code);
  });

  it("convertit automatiquement un Swagger 2.0", async () => {
    const r = await generate(`${base}/swagger.json`);
    assert.equal(r.converted, true);
    assert.equal(r.specVersion, "2.0");
    assert.match(r.code, /User: \{/);
    assert.match(r.code, /email: string/);
    await assertValidDts(r.code);
  });

  it("applique les options openapi-typescript", async () => {
    const r = await generate(`${base}/openapi.json`, { rootTypes: true, immutable: true, exportType: true });
    assert.match(r.code, /export type SchemaPet = /);
    assert.match(r.code, /readonly name: string/);
    // openapi-typescript conserve `interface operations` même avec exportType.
    assert.match(r.code, /export type paths = /);
    assert.match(r.code, /export type components = /);
    await assertValidDts(r.code);
  });

  it("transmet les en-têtes HTTP", async () => {
    await assert.rejects(generate(`${base}/private.json`), /401/);
    const r = await generate(`${base}/private.json`, { headers: { Authorization: "Bearer secret" } });
    assert.match(r.code, /Pet/);
  });

  it("génère depuis un contenu JSON importé", async () => {
    const r = await generate({ content: JSON.stringify(openapi3), fileName: "boutique.json" });
    assert.equal(r.converted, false);
    assert.equal(r.suggestedFileName, "demo-boutique.d.ts");
    assert.match(r.code, /Pet: \{/);
    await assertValidDts(r.code);
  });

  it("génère depuis un contenu YAML Swagger 2.0 importé", async () => {
    const r = await generate({ content: stringifyYaml(swagger2), fileName: "legacy.yaml" });
    assert.equal(r.converted, true);
    assert.match(r.code, /email: string/);
    await assertValidDts(r.code);
  });

  it("utilise le nom du fichier importé à défaut de info.title", async () => {
    const { info, ...sansInfo } = openapi3;
    const r = await generate({ content: JSON.stringify(sansInfo), fileName: "Mon API.yml" });
    assert.equal(r.suggestedFileName, "mon-api.d.ts");
  });

  it("rejette un contenu importé invalide", async () => {
    await assert.rejects(generate({ content: "{ pas du json", fileName: "x.json" }), /JSON|YAML/);
  });

  it("rejette un document qui n'est pas une spécification", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openapi-dts-"));
    const file = join(dir, "x.json");
    await writeFile(file, JSON.stringify({ hello: "world" }));
    await assert.rejects(generate(file), /swagger|openapi/);
  });
});
