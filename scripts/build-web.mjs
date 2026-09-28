// Construit public/generator.js : la génération embarquée dans le navigateur (aucun envoi au serveur).
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const shim = (name) => fileURLToPath(new URL(`./web-shims/${name}.js`, import.meta.url));

/** Options esbuild, réutilisées par les tests pour vérifier le bundle. */
export const webBuildOptions = {
  entryPoints: [fileURLToPath(new URL("../src/browser.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "none",
  // Modules Node utilisés par openapi-typescript et swagger2openapi, remplacés par des équivalents navigateur.
  alias: {
    fs: shim("fs"),
    http: shim("http"),
    buffer: shim("buffer"),
    "node-fetch-h2": shim("fetch"),
    path: shim("path"),
    url: shim("url"),
    "node:url": shim("url"),
    "node:stream": shim("stream"),
    "node:perf_hooks": shim("perf_hooks"),
  },
  inject: [shim("process")],
  plugins: [
    {
      // openapi-typescript teste `schema instanceof Buffer` sans vérifier que Buffer existe : sans objet dans le navigateur.
      name: "sans-buffer",
      setup(b) {
        b.onLoad({ filter: /openapi-typescript[\\/]dist[\\/]lib[\\/]redoc\.mjs$/ }, async ({ path }) => {
          const source = await readFile(path, "utf8");
          if (!source.includes("schema instanceof Buffer")) throw new Error(`Motif introuvable dans ${path}`);
          return { contents: source.replace("schema instanceof Buffer", "false"), loader: "js" };
        });
      },
    },
  ],
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await build({ ...webBuildOptions, outfile: fileURLToPath(new URL("../public/generator.js", import.meta.url)) });
}
