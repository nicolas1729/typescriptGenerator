// Remplace node-fetch-h2 par le fetch natif (utilisé par swagger2openapi seulement pour les $ref externes).
const fetch = (...args) => globalThis.fetch(...args);
export default fetch;
export const Headers = globalThis.Headers;
export const Request = globalThis.Request;
export const Response = globalThis.Response;
