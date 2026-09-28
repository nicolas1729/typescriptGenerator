// Sous-ensemble du module `url` de Node, construit sur l'API WHATWG URL.
export function fileURLToPath(url) {
  return decodeURIComponent(new URL(url).pathname);
}
export function pathToFileURL(path) {
  return new URL(`file://${path.startsWith("/") ? "" : "/"}${path}`);
}
export function resolve(from, to) {
  return new URL(to, new URL(from, "resolve://")).href.replace(/^resolve:\/\//, "");
}
/** `url.parse` : objet mutable dont `format()` reflète le `protocol` modifié (usage de swagger2openapi). */
export function parse(input) {
  let u;
  try {
    u = new URL(input);
  } catch {
    return { href: input, protocol: null, format() { return this.protocol ? `${this.protocol}//${input.replace(/^\/\//, "")}` : input; } };
  }
  return {
    href: u.href, protocol: u.protocol, host: u.host, hostname: u.hostname, port: u.port, pathname: u.pathname,
    search: u.search, hash: u.hash,
    format() {
      const protocol = this.protocol.endsWith(":") ? this.protocol : `${this.protocol}:`;
      return `${protocol}//${u.host}${u.pathname === "/" && !input.endsWith("/") ? "" : u.pathname}${u.search}${u.hash}`;
    },
  };
}
export function format(u) {
  return typeof u === "string" ? u : u.format ? u.format() : String(u.href ?? "");
}
export const URL = globalThis.URL;
export default { fileURLToPath, pathToFileURL, resolve, parse, format, URL };
