// Pas de système de fichiers dans le navigateur : seules les $ref internes sont résolues.
const unavailable = (path) => new Error(`Accès fichier impossible dans le navigateur : ${path}`);
export function readFile(path, _options, callback) {
  (typeof _options === "function" ? _options : callback)(unavailable(path));
}
export function readFileSync(path) {
  throw unavailable(path);
}
export default { readFile, readFileSync };
