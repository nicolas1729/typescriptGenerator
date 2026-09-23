# openapi-dts

Génère des déclarations TypeScript (`.d.ts`) à partir de l'URL d'un `swagger.json` / `openapi.json` (ou YAML),
en s'appuyant sur [openapi-typescript](https://openapi-ts.dev/) v7.

- **Swagger 2.0 accepté** : converti automatiquement en OpenAPI 3 (via `swagger2openapi`), car openapi-typescript v7 ne gère que OpenAPI 3.x.
- **Deux usages** : une CLI, et une interface web locale (aperçu, copie, téléchargement).
- **Spécifications protégées** : en-têtes HTTP personnalisés (`Authorization`, etc.).
- URL `http(s)`, `file://` ou chemin local (CLI uniquement).

## Installation

```bash
npm install
npm run build
```

## CLI

```bash
npm run gen -- https://petstore3.swagger.io/api/v3/openapi.json
```

Le fichier est écrit dans `generated/<titre-de-l-api>.d.ts`. Options utiles :

```bash
npm run gen -- https://petstore.swagger.io/v2/swagger.json -o src/types/petstore.d.ts --root-types --alphabetize
npm run gen -- https://api.exemple.fr/openapi.json -H "Authorization: Bearer xxx"
npm run gen -- ./specs/api.yaml --stdout
```

> Sous PowerShell, `npm run gen -- …` peut avaler certaines options. Dans ce cas, appelez directement
> `npx tsx src/cli.ts <url> [options]` ou, après build, `node dist/cli.js <url> [options]`.

`npx tsx src/cli.ts --help` affiche la liste complète des options.

| Option CLI | Effet |
|---|---|
| `--enum` | Vrais `enum` TS (le fichier suggéré devient `.ts`, un enum dans un `.d.ts` n'existe pas à l'exécution) |
| `--export-type` | `type` au lieu de `interface` |
| `--root-types` | `export type SchemaPet = components["schemas"]["Pet"]` pour chaque schéma |
| `--immutable` | Propriétés `readonly` |
| `--alphabetize` | Tri alphabétique |
| `--additional-properties` | Index `[key: string]: unknown` sur les objets |
| `--no-default-non-nullable` | Les champs avec valeur par défaut restent optionnels |
| `--properties-required-by-default` | Propriétés requises sauf mention contraire |
| `--exclude-deprecated` | Ignore ce qui est déprécié |
| `--path-params-as-types` | Chemins typés (`/users/${string}`) |
| `--array-length` | Tuples via `minItems` / `maxItems` |

## Interface web

```bash
npm run serve          # dev (tsx), http://localhost:3000
npm start              # après build
```

Saisissez l'URL, cochez les options, puis copiez ou téléchargez le résultat. Le serveur écoute uniquement sur
`127.0.0.1`, car il télécharge les URL qu'on lui donne.

## Utiliser les types générés

```ts
import type { paths, components } from "./generated/petstore";

type Pet = components["schemas"]["Pet"];
type FindByStatus = paths["/pet/findByStatus"]["get"]["responses"][200]["content"]["application/json"];
```

Pour un client HTTP typé à partir de ces types, voir [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/).

## Utilisation en bibliothèque

```ts
import { generate } from "./src/generate.js";

const { code, suggestedFileName, stats } = await generate("https://…/swagger.json", { rootTypes: true });
```

## Tests

```bash
npm test
```

Les tests démarrent un serveur HTTP local qui sert des spécifications OpenAPI 3 et Swagger 2.0, puis vérifient
que le code généré **compile réellement** comme un `.d.ts` avec le compilateur TypeScript.
