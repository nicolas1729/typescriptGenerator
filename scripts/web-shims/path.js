// Sous-ensemble POSIX du module `path` : utilisé seulement pour la résolution de $ref externes, désactivée ici.
export const sep = "/";
function normalize(p) {
  const abs = p.startsWith("/");
  const out = [];
  for (const part of p.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return (abs ? "/" : "") + out.join("/") || (abs ? "/" : ".");
}
export function join(...parts) {
  return normalize(parts.filter(Boolean).join("/"));
}
export function resolve(...parts) {
  let p = "";
  for (const part of parts) p = part.startsWith("/") ? part : `${p}/${part}`;
  return normalize(p.startsWith("/") ? p : `/${p}`);
}
export function dirname(p) {
  const i = p.replace(/\/+$/, "").lastIndexOf("/");
  return i < 0 ? "." : i === 0 ? "/" : p.slice(0, i);
}
export function basename(p, ext) {
  const base = p.replace(/\/+$/, "").split("/").pop() ?? "";
  return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
}
export function extname(p) {
  const m = /\.[^./]*$/.exec(basename(p));
  return m ? m[0] : "";
}
export function isAbsolute(p) {
  return p.startsWith("/");
}
export const posix = { sep, join, resolve, dirname, basename, extname, isAbsolute, normalize };
export default { ...posix, posix };
