// Cœur de la génération, sans aucun module Node : partagé par le serveur et par le bundle navigateur.
import openapiTS, { astToString, type OpenAPI3, type OpenAPITSOptions } from "openapi-typescript";
import swagger2openapi from "swagger2openapi";
import { parse as parseYaml } from "yaml";

/** Options exposées à l'utilisateur (sous-ensemble utile d'OpenAPITSOptions). */
export interface GenerateOptions {
  /** Génère de vrais `enum` TypeScript au lieu d'unions de littéraux. */
  enum?: boolean;
  /** Utilise `type` au lieu de `interface`. */
  exportType?: boolean;
  /** Ajoute `readonly` partout. */
  immutable?: boolean;
  /** Trie les propriétés par ordre alphabétique. */
  alphabetize?: boolean;
  /** Autorise les propriétés supplémentaires (`[key: string]: unknown`). */
  additionalProperties?: boolean;
  /** Les champs avec valeur par défaut sont non-nullables (défaut v7 : true). */
  defaultNonNullable?: boolean;
  /** Toutes les propriétés sont requises sauf mention contraire. */
  propertiesRequiredByDefault?: boolean;
  /** Ignore les schémas / opérations dépréciés. */
  excludeDeprecated?: boolean;
  /** Exporte chaque schéma en alias de premier niveau (`export type Pet = …`). */
  rootTypes?: boolean;
  /** Types littéraux pour les paramètres de chemin (`/users/${string}`). */
  pathParamsAsTypes?: boolean;
  /** Tuples à partir de minItems / maxItems. */
  arrayLength?: boolean;
  /** En-têtes HTTP à envoyer pour récupérer le document (ex. Authorization). */
  headers?: Record<string, string>;
}

export interface GenerateResult {
  /** Contenu du fichier .d.ts */
  code: string;
  /** Titre de l'API (info.title) */
  title: string;
  /** Version de l'API (info.version) */
  apiVersion: string;
  /** Version de la spécification d'origine (ex. "2.0", "3.0.3", "3.1.0") */
  specVersion: string;
  /** Vrai si le document Swagger 2.0 a été converti en OpenAPI 3 */
  converted: boolean;
  /** Nom de fichier suggéré, ex. "petstore.d.ts" (".ts" si l'option enum est active) */
  suggestedFileName: string;
  /** Nombre de chemins et de schémas, pour information */
  stats: { paths: number; schemas: number; lines: number };
}

/** Contenu brut d'une spécification (ex. fichier importé depuis l'interface web). */
export interface SpecContent {
  /** Texte JSON ou YAML */
  content: string;
  /** Nom du fichier d'origine, utilisé à défaut de `info.title` */
  fileName?: string;
}

type AnyDoc = Record<string, any>;

/** Analyse un texte JSON ou YAML et vérifie qu'il s'agit bien d'une spécification Swagger/OpenAPI. */
export function parseDocument(text: string): AnyDoc {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    try {
      doc = parseYaml(text);
    } catch {
      throw new Error("Le document n'est ni du JSON ni du YAML valide.");
    }
  }
  if (!doc || typeof doc !== "object") throw new Error("Le document récupéré n'est pas un objet OpenAPI/Swagger.");
  const d = doc as AnyDoc;
  if (!d.swagger && !d.openapi) {
    throw new Error("Champ `swagger` ou `openapi` introuvable : ce n'est pas une spécification OpenAPI/Swagger.");
  }
  return d;
}

function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "api"
  );
}

/**
 * Génère les déclarations TypeScript d'un document déjà analysé.
 * `source` est l'emplacement du document, s'il en a un : il permet de résoudre ses $ref externes relatives.
 */
export async function generateFromDocument(
  original: AnyDoc,
  { source, fallbackName = "api", options = {} }: { source?: URL; fallbackName?: string; options?: GenerateOptions },
): Promise<GenerateResult> {
  const { headers, ...tsOptions } = options;

  let schema: OpenAPI3;
  let converted = false;
  const specVersion = String(original.openapi ?? original.swagger);

  if (original.swagger) {
    // openapi-typescript v7 ne supporte que OpenAPI 3.x : conversion préalable.
    const out = await swagger2openapi.convertObj(original as any, {
      patch: true,
      warnOnly: true,
      resolve: Boolean(source),
      ...(source && { source: source.href }),
    });
    schema = out.openapi as unknown as OpenAPI3;
    converted = true;
  } else {
    schema = original as OpenAPI3;
  }

  const openapiOptions: OpenAPITSOptions = { silent: true, ...tsOptions };
  // Passer l'URL permet à openapi-typescript de résoudre les $ref externes relatives,
  // mais uniquement quand il n'y a ni en-têtes à transmettre ni document converti.
  const ast = await openapiTS(source && !converted && !headers ? source : schema, openapiOptions);
  const code = astToString(ast);

  const title = String(original.info?.title ?? fallbackName);
  return {
    code,
    title,
    apiVersion: String(original.info?.version ?? ""),
    specVersion,
    converted,
    // Un `enum` dans un .d.ts est purement ambiant (aucune valeur à l'exécution) : on produit un .ts.
    suggestedFileName: `${slugify(title)}${tsOptions.enum ? ".ts" : ".d.ts"}`,
    stats: {
      paths: Object.keys(schema.paths ?? {}).length,
      schemas: Object.keys(schema.components?.schemas ?? {}).length,
      lines: code.split("\n").length,
    },
  };
}

/** Génère depuis un contenu brut : aucun accès réseau ni fichier, utilisable tel quel dans le navigateur. */
export async function generateFromContent(input: SpecContent, options: GenerateOptions = {}): Promise<GenerateResult> {
  // Un contenu brut n'a pas d'emplacement : ses éventuelles $ref externes relatives ne peuvent pas être résolues.
  const fallbackName = (input.fileName ?? "api").replace(/\.(json|ya?ml)$/i, "");
  return generateFromDocument(parseDocument(input.content), { fallbackName, options });
}
